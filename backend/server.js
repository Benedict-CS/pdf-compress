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
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

const app = express();
app.use(cors({
  exposedHeaders: ['X-Original-Size', 'X-Compressed-Size', 'X-Compression-Time', 'X-Total-Pages']
}));
app.use(express.json());

// 2. Concurrency Control: Only allow 2 heavy compression tasks at a time
const queue = new PQueue({ concurrency: 2 });

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // Increased for preview + compress usage
  message: 'Too many requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

const activeJobs = new Map();

app.get('/', (req, res) => res.send('PDF Compressor API is online.'));

app.get('/api/progress/:jobId', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  const { jobId } = req.params;
  const interval = setInterval(() => {
    const job = activeJobs.get(jobId);
    if (job) {
      res.write(`data: ${JSON.stringify(job)}\n\n`);
      if (job.status === 'done' || job.status === 'error') {
        clearInterval(interval);
        res.end();
        activeJobs.delete(jobId);
      }
    }
  }, 500);
  req.on('close', () => clearInterval(interval));
});

function runWorker(workerData, jobId) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'compress-worker.js'), { workerData });
    worker.on('message', (msg) => {
      if (msg.type === 'start') activeJobs.set(jobId, { status: 'processing', current: 0, total: msg.total });
      else if (msg.type === 'progress') activeJobs.set(jobId, { status: 'processing', current: msg.current, total: msg.total });
      else if (msg.type === 'done') resolve(msg);
      else if (msg.type === 'error') reject(new Error(msg.error));
    });
    worker.on('error', reject);
  });
}

// 1. Instant Preview Endpoint
app.post('/api/preview', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).send('No file.');
  try {
    const result = await runWorker({
      type: 'preview',
      inputPath: req.file.path,
      quality: parseFloat(req.body.quality) || 0.9,
      scale: parseFloat(req.body.scale) || 2.0
    }, 'preview-' + Date.now());
    res.json({ preview: result.preview });
  } catch (error) {
    res.status(500).send(error.message);
  } finally {
    if (req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
  }
});

app.post('/api/compress', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).send('No file.');
  const jobId = req.body.jobId || Math.random().toString(36).substring(7);
  const inputPath = req.file.path;
  const outputPath = path.join('uploads', `compressed_${req.file.filename}.pdf`);

  try {
    const quality = parseFloat(req.body.quality) || 0.9;
    const scale = parseFloat(req.body.scale) || 3.0;

    // Use Queue to limit concurrency
    const result = await queue.add(() => runWorker({
      type: 'compress',
      inputPath,
      outputPath,
      quality,
      scale
    }, jobId));

    const originalSize = fs.statSync(inputPath).size;
    const compressedSize = fs.statSync(outputPath).size;
    
    res.set({ 'X-Original-Size': originalSize, 'X-Compressed-Size': compressedSize });
    res.download(outputPath, req.file.originalname, () => {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      activeJobs.set(jobId, { status: 'done' });
    });
  } catch (error) {
    activeJobs.set(jobId, { status: 'error', error: error.message });
    res.status(500).send(error.message);
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
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
  }, 1800000);
});
