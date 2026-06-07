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
app.use(cors());
app.use(express.json());

// 3. Rate Limiting: Prevent abuse (max 10 requests per 15 mins per IP)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/compress', limiter);

app.get('/', (req, res) => {
  res.send('PDF Compressor API is online.');
});

// 4. Worker Threads: Run heavy compression in background thread
function runCompressionWorker(workerData) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'compress-worker.js'), {
      workerData
    });
    worker.on('message', (result) => {
      if (result.error) reject(new Error(result.error));
      else resolve(result);
    });
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
    });
  });
}

app.post('/api/compress', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded.');

  const inputPath = req.file.path;
  const outputPath = path.join('uploads', `compressed_${req.file.filename}.pdf`);

  try {
    const quality = req.body.quality ? parseFloat(req.body.quality) : 0.9;
    const scale = req.body.scale ? parseFloat(req.body.scale) : 3.0;

    const startTime = Date.now();
    await runCompressionWorker({
      inputPath,
      outputPath,
      quality,
      scale
    });

    const originalSize = fs.statSync(inputPath).size;
    const compressedSize = fs.statSync(outputPath).size;
    const timeTaken = (Date.now() - startTime) / 1000;

    // 1. Comparison Headers: Send stats to frontend
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

  // Automated Cleanup: Every 30 minutes, delete files older than 1 hour
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
