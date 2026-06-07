import express from 'express';
import multer from 'multer';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createCanvas, Image, ImageData, DOMMatrix } from 'canvas';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import PDFDocument from 'pdfkit';

// Polyfills for pdfjs
if (!globalThis.Image) globalThis.Image = Image;
if (!globalThis.ImageData) globalThis.ImageData = ImageData;
if (!globalThis.DOMMatrix) globalThis.DOMMatrix = DOMMatrix;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const upload = multer({ dest: 'uploads/' });

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('PDF Compressor API is online.');
});

class NodeCanvasFactory {
  create(width, height) {
    const canvas = createCanvas(width, height);
    return { canvas, context: canvas.getContext('2d') };
  }
  reset(canvasAndContext, width, height) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }
  destroy(canvasAndContext) {
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
  }
}

async function compressPDF(inputPath, outputPath, quality = 0.7, scale = 1.2) {
  const data = new Uint8Array(fs.readFileSync(inputPath));
  const canvasFactory = new NodeCanvasFactory();

  const loadingTask = pdfjsLib.getDocument({
    data,
    canvasFactory,
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
  });

  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;

  const doc = new PDFDocument({ autoFirstPage: false, compress: true });
  const writeStream = fs.createWriteStream(outputPath);
  doc.pipe(writeStream);

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvasAndCtx = canvasFactory.create(viewport.width, viewport.height);

    await page.render({
      canvasContext: canvasAndCtx.context,
      viewport,
      canvasFactory,
    }).promise;

    const imgBuffer = canvasAndCtx.canvas.toBuffer('image/jpeg', { quality });

    const pageW = viewport.width / scale * 72 / 96;
    const pageH = viewport.height / scale * 72 / 96;
    doc.addPage({ size: [pageW, pageH], margin: 0 });
    doc.image(imgBuffer, 0, 0, { width: pageW, height: pageH });
  }

  doc.end();

  return new Promise((resolve, reject) => {
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });
}

app.post('/api/compress', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded.');

  const inputPath = req.file.path;
  const outputPath = path.join('uploads', `compressed_${req.file.filename}.pdf`);

  try {
    const quality = parseFloat(req.body.quality) || 0.7;
    const scale = parseFloat(req.body.scale) || 1.2;

    await compressPDF(inputPath, outputPath, quality, scale);

    res.download(outputPath, req.file.originalname, (err) => {
      // Cleanup files after download
      fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    });
  } catch (error) {
    console.error('Compression error:', error);
    res.status(500).send('Error processing PDF: ' + error.message);
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
});
