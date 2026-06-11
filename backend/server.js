import express from 'express';
import multer from 'multer';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { Worker } from 'worker_threads';
import { rateLimit } from 'express-rate-limit';
import PQueue from 'p-queue';
import helmet from 'helmet';
import compression from 'compression';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const JOB_TTL_MS = 60 * 60 * 1000;        // 1h — shareable + activeJobs cleanup
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 min
const SSE_HEARTBEAT_MS = 15 * 1000;

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// --- Multer: random hex filename + strict PDF filter ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, `${crypto.randomBytes(16).toString('hex')}.pdf`),
});
const pdfFileFilter = (req, file, cb) => {
  const ok = file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
  if (!ok) return cb(new Error('Only PDF files are allowed'), false);
  cb(null, true);
};
const upload = multer({
  storage,
  fileFilter: pdfFileFilter,
  limits: { fileSize: 50 * 1024 * 1024 },
});

const app = express();

// --- Security headers (helmet) ---
// crossOriginResourcePolicy relaxed so the SPA on another origin can fetch downloads.
// CSP disabled here because the API serves data, not HTML, and a too-strict CSP can
// interfere with EventSource/SSE proxies and dev hot-reload pages.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
}));

// --- gzip/brotli for JSON. Skip SSE, file downloads, and anything explicitly opting out. ---
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    const ct = res.getHeader('Content-Type') || '';
    if (typeof ct === 'string') {
      if (ct.includes('text/event-stream')) return false;
      if (ct.includes('application/pdf')) return false;
      if (ct.includes('application/octet-stream')) return false;
    }
    return compression.filter(req, res);
  },
}));

app.use(cors({ exposedHeaders: ['X-Original-Size', 'X-Compressed-Size', 'X-Output-Name'] }));
app.use(express.json());

const queue = new PQueue({ concurrency: 2 });
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false });
app.use('/api/', limiter);

const activeJobs = new Map();      // jobId -> { status, current, total, worker?, error?, updatedAt }
const shareableFiles = new Map();  // jobId -> { internalName, originalName, createdAt }

let shuttingDown = false;
app.use((req, res, next) => {
  if (shuttingDown) {
    res.set('Connection', 'close');
    return res.status(503).send('Server is shutting down');
  }
  next();
});

function setJob(jobId, patch) {
  const prev = activeJobs.get(jobId) || {};
  activeJobs.set(jobId, { ...prev, ...patch, updatedAt: Date.now() });
}

app.get('/', (req, res) => res.send('PDF Compressor API is online.'));
app.get('/api/', (req, res) => res.send('PDF Compressor API is online.'));

app.get('/api/download/:jobId', (req, res) => {
  const info = shareableFiles.get(req.params.jobId);
  if (!info) return res.status(404).send('Not found.');
  res.download(path.join(UPLOADS_DIR, info.internalName), info.originalName);
});

// --- SSE progress: initial event + heartbeats + proper cleanup ---
app.get('/api/progress/:jobId', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  const jobId = req.params.jobId;
  let closed = false;
  let pollInterval = null;
  let heartbeatInterval = null;

  const cleanup = () => {
    if (closed) return;
    closed = true;
    if (pollInterval) clearInterval(pollInterval);
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    try { res.end(); } catch (_) { /* noop */ }
  };

  // Initial "open" event so client knows the stream is live.
  const initial = activeJobs.get(jobId) || { status: 'queued', current: 0, total: 0 };
  res.write(`event: open\ndata: ${JSON.stringify({ jobId, ...initial })}\n\n`);

  let lastSerialized = '';
  pollInterval = setInterval(() => {
    if (closed) return;
    const job = activeJobs.get(jobId);
    if (!job) return;
    const payload = { status: job.status, current: job.current, total: job.total, error: job.error };
    const serialized = JSON.stringify(payload);
    if (serialized !== lastSerialized) {
      res.write(`data: ${serialized}\n\n`);
      lastSerialized = serialized;
    }
    if (job.status === 'done' || job.status === 'error') {
      cleanup();
    }
  }, 500);

  heartbeatInterval = setInterval(() => {
    if (closed) return;
    res.write(`: heartbeat ${Date.now()}\n\n`);
  }, SSE_HEARTBEAT_MS);

  req.on('close', cleanup);
  req.on('aborted', cleanup);
  res.on('error', cleanup);
});

app.post('/api/cancel/:jobId', (req, res) => {
  const jobId = req.params.jobId;
  const job = activeJobs.get(jobId);
  if (!job) return res.status(404).send('Not found');
  if (job.worker) {
    try { job.worker.terminate(); } catch (_) { /* noop */ }
  }
  setJob(jobId, { status: 'error', error: 'Cancelled by user', worker: null });
  res.send('Cancelled');
});

function runWorker(workerData, jobId) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'compress-worker.js'), { workerData });
    if (jobId) setJob(jobId, { status: 'processing', current: 0, total: 0, worker });
    worker.on('message', (msg) => {
      if (jobId) {
        const job = activeJobs.get(jobId);
        if (job) {
          if (msg.type === 'start' || msg.type === 'progress') {
            setJob(jobId, { current: msg.current || 0, total: msg.total });
          } else if (msg.type === 'done') {
            setJob(jobId, { status: 'done', worker: null });
          }
        }
      }
      if (msg.type === 'done') resolve(msg);
      else if (msg.type === 'error') reject(new Error(msg.error));
    });
    worker.on('error', reject);
    worker.on('exit', (code) => { if (code !== 0) reject(new Error(`Worker stopped with code ${code}`)); });
  });
}

app.post('/api/thumbnails', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).send('No file.');
  try {
    const result = await runWorker({ type: 'thumbnails', inputPath: req.file.path }, null);
    res.json(result);
  } catch (e) {
    console.error('[thumbnails] error:', { msg: e.message });
    res.status(500).send('Failed to render thumbnails');
  } finally {
    if (fs.existsSync(req.file.path)) fs.unlink(req.file.path, () => {});
  }
});

app.post('/api/preview', upload.array('files', 20), async (req, res) => {
  if (!req.files || req.files.length === 0) return res.status(400).send('No file.');
  const inputFiles = req.files.map(f => ({ id: f.originalname, path: f.path }));
  try {
    const result = await runWorker({
      type: 'preview',
      inputFiles,
      quality: parseFloat(req.body.quality) || 0.9,
      pageConfigs: JSON.parse(req.body.pageConfigs || '[]'),
    }, null);
    res.json(result);
  } catch (e) {
    console.error('[preview] error:', { msg: e.message });
    res.status(500).send('Failed to render preview');
  } finally {
    inputFiles.forEach(f => { if (fs.existsSync(f.path)) fs.unlink(f.path, () => {}); });
  }
});

app.post('/api/compress', upload.array('files', 20), async (req, res) => {
  if (!req.files || req.files.length === 0) return res.status(400).send('No files.');
  const jobId = req.body.jobId || crypto.randomBytes(8).toString('hex');
  const mode = req.body.mode || 'rasterize';
  const internalName = `compressed_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.pdf`;
  const outputPath = path.join(UPLOADS_DIR, internalName);

  const inputFiles = req.files.map(f => ({ id: f.originalname, path: f.path }));
  setJob(jobId, { status: 'queued', current: 0, total: 0 });

  try {
    await queue.add(async () => {
      // Robust cancellation check: short-circuit before spawning the worker.
      const job = activeJobs.get(jobId);
      if (!job || job.status === 'error') {
        throw new Error('Cancelled by user');
      }
      return runWorker({
        mode,
        type: 'compress',
        inputFiles,
        outputPath,
        quality: parseFloat(req.body.quality) || 0.9,
        scale: parseFloat(req.body.scale) || 3.0,
        pageConfigs: JSON.parse(req.body.pageConfigs || '[]'),
      }, jobId);
    });

    const originalSize = inputFiles.reduce((acc, f) => acc + (fs.existsSync(f.path) ? fs.statSync(f.path).size : 0), 0);
    const compressedSize = fs.statSync(outputPath).size;
    const outName = req.files.length > 1
      ? 'merged_output.pdf'
      : `${mode === 'direct' ? 'edited_' : 'compressed_'}${req.files[0].originalname}`;

    shareableFiles.set(jobId, { internalName, originalName: outName, createdAt: Date.now() });
    res.set({
      'X-Original-Size': originalSize,
      'X-Compressed-Size': compressedSize,
      'X-Output-Name': encodeURIComponent(outName),
    });
    res.download(outputPath, outName, () => {
      inputFiles.forEach(f => { if (fs.existsSync(f.path)) fs.unlink(f.path, () => {}); });
    });
  } catch (error) {
    console.error('[compress] error:', { jobId, mode, msg: error.message });
    if (error.message !== 'Cancelled by user') {
      setJob(jobId, { status: 'error', error: error.message, worker: null });
    }
    if (!res.headersSent) res.status(500).send('Compression failed');
    inputFiles.forEach(f => { if (fs.existsSync(f.path)) fs.unlink(f.path, () => {}); });
  }
});

// --- Cleanup: uploads dir + shareableFiles + stale activeJobs ---
function runCleanup() {
  const now = Date.now();

  // 1) uploads dir
  fs.readdir(UPLOADS_DIR, (err, files) => {
    if (err) return;
    files.forEach(f => {
      const p = path.join(UPLOADS_DIR, f);
      fs.stat(p, (err, s) => {
        if (!err && (now - s.mtimeMs) > JOB_TTL_MS) fs.unlink(p, () => {});
      });
    });
  });

  // 2) shareableFiles map (also delete the file if still present)
  for (const [jobId, info] of shareableFiles.entries()) {
    if ((now - info.createdAt) > JOB_TTL_MS) {
      const p = path.join(UPLOADS_DIR, info.internalName);
      fs.unlink(p, () => {});
      shareableFiles.delete(jobId);
    }
  }

  // 3) finished/stale activeJobs entries
  for (const [jobId, job] of activeJobs.entries()) {
    const ts = job.updatedAt || 0;
    if ((job.status === 'done' || job.status === 'error') && (now - ts) > JOB_TTL_MS) {
      activeJobs.delete(jobId);
    }
  }
}

async function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[shutdown] received ${signal}, draining queue...`);
  try {
    queue.pause();
    await queue.onIdle();
  } catch (e) {
    console.error('[shutdown] queue drain error', e);
  }
  process.exit(0);
}

const PORT = process.env.PORT || 3001;
let cleanupTimer = null;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`PDF Compressor API listening on :${PORT}`);
  });
  cleanupTimer = setInterval(runCleanup, CLEANUP_INTERVAL_MS);
  if (cleanupTimer.unref) cleanupTimer.unref();
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

export default app;
export { runCleanup, activeJobs, shareableFiles };
