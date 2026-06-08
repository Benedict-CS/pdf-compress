import express from 'express';
import multer from 'multer';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Worker } from 'worker_threads';
import { rateLimit } from 'express-rate-limit';
import PQueue from 'p-queue';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const upload = multer({ dest: 'uploads/', limits: { fileSize: 50 * 1024 * 1024 } });
const app = express();
app.use(cors({ exposedHeaders: ['X-Original-Size', 'X-Compressed-Size', 'X-Output-Name'] }));
app.use(express.json());

const queue = new PQueue({ concurrency: 2 });
const limiter = rateLimit({ windowMs: 15*60*1000, max: 100, standardHeaders: true, legacyHeaders: false });
app.use('/api/', limiter);

const activeJobs = new Map();
const shareableFiles = new Map();

app.get('/api/download/:jobId', (req, res) => {
  const info = shareableFiles.get(req.params.jobId);
  if (!info) return res.status(404).send('Not found.');
  res.download(path.join(__dirname, 'uploads', info.internalName), info.originalName);
});

app.get('/api/progress/:jobId', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  const interval = setInterval(() => {
    const job = activeJobs.get(req.params.jobId);
    if (job) {
      res.write(`data: ${JSON.stringify(job)}\n\n`);
      if (job.status === 'done' || job.status === 'error') { clearInterval(interval); res.end(); }
    }
  }, 500);
  req.on('close', () => clearInterval(interval));
});

// --- NEW: Cancel Job Endpoint ---
app.post('/api/cancel/:jobId', (req, res) => {
  const job = activeJobs.get(req.params.jobId);
  if (job && job.worker) {
    job.worker.terminate();
    activeJobs.set(req.params.jobId, { status: 'error', error: 'Cancelled by user' });
    res.send('Cancelled');
  } else {
    res.status(404).send('Not found');
  }
});

function runWorker(workerData, jobId) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'compress-worker.js'), { workerData });
    if (jobId) {
      const job = activeJobs.get(jobId) || {};
      activeJobs.set(jobId, { ...job, status: 'processing', current: 0, total: 0, worker });
    }
    worker.on('message', (msg) => {
      if (jobId) {
        const job = activeJobs.get(jobId);
        if (job) {
          if (msg.type === 'start' || msg.type === 'progress') activeJobs.set(jobId, { ...job, current: msg.current || 0, total: msg.total });
          else if (msg.type === 'done') activeJobs.set(jobId, { ...job, status: 'done' });
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
  } catch (e) { res.status(500).send(e.message); }
  finally { if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); }
});

app.post('/api/preview', upload.array('files', 20), async (req, res) => {
  if (!req.files || req.files.length === 0) return res.status(400).send('No file.');
  const inputFiles = req.files.map(f => ({ id: f.originalname, path: f.path }));
  try {
    const result = await runWorker({
      type: 'preview', inputFiles, quality: parseFloat(req.body.quality) || 0.9, pageConfigs: JSON.parse(req.body.pageConfigs || '[]')
    }, null);
    res.json(result);
  } catch (e) { res.status(500).send(e.message); }
  finally { inputFiles.forEach(f => { if(fs.existsSync(f.path)) fs.unlinkSync(f.path); }); }
});

app.post('/api/compress', upload.array('files', 20), async (req, res) => {
  if (!req.files || req.files.length === 0) return res.status(400).send('No files.');
  const jobId = req.body.jobId || Math.random().toString(36).substring(7);
  const mode = req.body.mode || 'rasterize';
  const internalName = `compressed_${Date.now()}.pdf`;
  const outputPath = path.join('uploads', internalName);
  
  const inputFiles = req.files.map(f => ({ id: f.originalname, path: f.path }));
  activeJobs.set(jobId, { status: 'queued', current: 0, total: 0 });

  try {
    await queue.add(async () => {
      const job = activeJobs.get(jobId);
      if (job && job.status === 'error') throw new Error('Cancelled by user');
      return runWorker({
        mode, type: 'compress', inputFiles, outputPath, 
        quality: parseFloat(req.body.quality) || 0.9, 
        scale: parseFloat(req.body.scale) || 3.0, 
        pageConfigs: JSON.parse(req.body.pageConfigs || '[]')
      }, jobId);
    });

    const originalSize = inputFiles.reduce((acc, f) => acc + fs.statSync(f.path).size, 0);
    const compressedSize = fs.statSync(outputPath).size;
    const outName = req.files.length > 1 ? 'merged_output.pdf' : `${mode === 'direct' ? 'edited_' : 'compressed_'}${req.files[0].originalname}`;

    shareableFiles.set(jobId, { internalName, originalName: outName, createdAt: Date.now() });
    res.set({ 'X-Original-Size': originalSize, 'X-Compressed-Size': compressedSize, 'X-Output-Name': encodeURIComponent(outName) });
    res.download(outputPath, outName, () => {
      inputFiles.forEach(f => { if(fs.existsSync(f.path)) fs.unlinkSync(f.path); });
    });
  } catch (error) {
    if(error.message !== 'Cancelled by user') activeJobs.set(jobId, { status: 'error', error: error.message });
    if(!res.headersSent) res.status(500).send(error.message);
    inputFiles.forEach(f => { if(fs.existsSync(f.path)) fs.unlinkSync(f.path); });
  }
});

app.listen(3001, () => {
  if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
  setInterval(() => {
    const dir = path.join(__dirname, 'uploads');
    fs.readdir(dir, (err, files) => {
      if (err) return;
      const now = Date.now();
      files.forEach(f => {
        const p = path.join(dir, f);
        fs.stat(p, (err, s) => { if (!err && (now - s.mtimeMs) > 3600000) fs.unlink(p, () => {}); });
      });
    });
  }, 600000);
});
