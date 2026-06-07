import express from 'express';
import multer from 'multer';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Worker } from 'worker_threads';
import { rateLimit } from 'express-rate-limit';

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

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/compress', limiter);

// In-memory progress tracking
const activeJobs = new Map();

app.get('/', (req, res) => {
  res.send('PDF Compressor API is online.');
});

// Progress SSE endpoint
app.get('/api/progress/:jobId', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const { jobId } = req.params;
  
  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  const interval = setInterval(() => {
    const job = activeJobs.get(jobId);
    if (job) {
      send(job);
      if (job.status === 'done' || job.status === 'error') {
        clearInterval(interval);
        res.end();
        activeJobs.delete(jobId);
      }
    }
  }, 500);

  req.on('close', () => clearInterval(interval));
});

function runCompressionWorker(workerData, jobId) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'compress-worker.js'), {
      workerData
    });
    
    worker.on('message', (msg) => {
      if (msg.type === 'start') {
        activeJobs.set(jobId, { status: 'processing', current: 0, total: msg.total });
      } else if (msg.type === 'progress') {
        activeJobs.set(jobId, { status: 'processing', current: msg.current, total: msg.total });
      } else if (msg.type === 'done') {
        activeJobs.set(jobId, { status: 'done' });
        resolve(msg);
      } else if (msg.type === 'error') {
        activeJobs.set(jobId, { status: 'error', error: msg.error });
        reject(new Error(msg.error));
      }
    });
    
    worker.on('error', (err) => {
      activeJobs.set(jobId, { status: 'error', error: err.message });
      reject(err);
    });
  });
}

app.post('/api/compress', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded.');

  const jobId = req.body.jobId || Math.random().toString(36).substring(7);
  const inputPath = req.file.path;
  const outputPath = path.join('uploads', `compressed_${req.file.filename}.pdf`);

  try {
    const quality = req.body.quality ? parseFloat(req.body.quality) : 0.9;
    const scale = req.body.scale ? parseFloat(req.body.scale) : 3.0;

    const startTime = Date.now();
    const result = await runCompressionWorker({
      inputPath,
      outputPath,
      quality,
      scale
    }, jobId);

    const originalSize = fs.statSync(inputPath).size;
    const compressedSize = fs.statSync(outputPath).size;
    const timeTaken = (Date.now() - startTime) / 1000;

    res.set({
      'X-Original-Size': originalSize,
      'X-Compressed-Size': compressedSize,
      'X-Compression-Time': timeTaken
    });

    res.download(outputPath, req.file.originalname, (err) => {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    });
  } catch (error) {
    console.error('Compression error:', error);
    res.status(500).send('Error processing PDF: ' + error.message);
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

  setInterval(() => {
    const uploadsDir = path.join(__dirname, 'uploads');
    fs.readdir(uploadsDir, (err, files) => {
      if (err) return;
      const now = Date.now();
      files.forEach(file => {
        if (file === '.gitkeep') return;
        const filePath = path.join(uploadsDir, file);
        fs.stat(filePath, (err, stats) => {
          if (!err && (now - stats.mtimeMs) > 3600000) {
            fs.unlink(filePath, () => {});
          }
        });
      });
    });
  }, 1800000);
});
