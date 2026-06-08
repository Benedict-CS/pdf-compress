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
app.use(cors({ exposedHeaders: ['X-Original-Size', 'X-Compressed-Size'] }));
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

function runWorker(workerData, jobId) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'compress-worker.js'), { workerData });
    worker.on('message', (msg) => {
      if (msg.type === 'start' || msg.type === 'progress') activeJobs.set(jobId, { status: 'processing', current: msg.current || 0, total: msg.total });
      else if (msg.type === 'done') resolve(msg);
      else if (msg.type === 'error') reject(new Error(msg.error));
    });
    worker.on('error', reject);
  });
}

app.post('/api/thumbnails', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).send('No file.');
  try {
    const result = await runWorker({ type: 'thumbnails', inputPath: req.file.path }, 'thumbs-' + Date.now());
    res.json(result);
  } catch (e) { res.status(500).send(e.message); }
  finally { if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); }
});

app.post('/api/preview', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).send('No file.');
  try {
    const result = await runWorker({
      type: 'preview', inputPath: req.file.path, quality: parseFloat(req.body.quality) || 0.9, pageConfigs: JSON.parse(req.body.pageConfigs || 'null')
    }, 'prev-' + Date.now());
    res.json(result);
  } catch (e) { res.status(500).send(e.message); }
  finally { if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); }
});

app.post('/api/compress', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).send('No file.');
  const jobId = req.body.jobId || Math.random().toString(36).substring(7);
  const mode = req.body.mode || 'rasterize';
  const internalName = `compressed_${req.file.filename}.pdf`;
  const outputPath = path.join('uploads', internalName);

  try {
    await queue.add(() => runWorker({
      mode, type: 'compress', inputPath: req.file.path, outputPath, quality: parseFloat(req.body.quality) || 0.9, scale: parseFloat(req.body.scale) || 3.0, pageConfigs: JSON.parse(req.body.pageConfigs || 'null')
    }, jobId));

    shareableFiles.set(jobId, { internalName, originalName: req.file.originalname, createdAt: Date.now() });
    res.set({ 'X-Original-Size': fs.statSync(req.file.path).size, 'X-Compressed-Size': fs.statSync(outputPath).size });
    res.download(outputPath, req.file.originalname, () => {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      activeJobs.set(jobId, { status: 'done' });
    });
  } catch (error) {
    activeJobs.set(jobId, { status: 'error', error: error.message });
    res.status(500).send(error.message);
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
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
