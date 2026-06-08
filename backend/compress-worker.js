import { parentPort, workerData } from 'worker_threads';
import fs from 'fs';
import { createCanvas, Image, ImageData, DOMMatrix } from 'canvas';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import PDFDocument from 'pdfkit';

// --- POLYFILLS FOR WORKER ---
const Canvas = createCanvas(1, 1).constructor;
const polyfills = {
  window: global,
  document: {
    createElement: (name) => {
      if (name === 'canvas') return createCanvas(1, 1);
      return {};
    }
  },
  Image: Image,
  ImageData: ImageData,
  DOMMatrix: DOMMatrix,
  HTMLElement: class {},
  HTMLCanvasElement: Canvas,
  HTMLImageElement: Image,
  requestAnimationFrame: (cb) => setTimeout(cb, 0),
  cancelAnimationFrame: (id) => clearTimeout(id),
  navigator: { userAgent: 'node' }
};
Object.assign(global, polyfills);
Object.assign(globalThis, polyfills);

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

async function processTask() {
  const { type, inputPath, outputPath, quality, scale } = workerData;
  const data = new Uint8Array(fs.readFileSync(inputPath));
  const canvasFactory = new NodeCanvasFactory();

  const loadingTask = pdfjsLib.getDocument({
    data,
    canvasFactory,
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
  });

  const pdfDoc = await loadingTask.promise;

  // --- PREVIEW MODE: Only render first page and exit ---
  if (type === 'preview') {
    const page = await pdfDoc.getPage(1);
    const viewport = page.getViewport({ scale: 1.5 }); // High enough for preview
    const canvasAndCtx = canvasFactory.create(viewport.width, viewport.height);
    const ctx = canvasAndCtx.context;

    try {
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, viewport.width, viewport.height);
      await page.render({
        canvasContext: ctx,
        viewport,
        canvasFactory,
        disableCreateImageBitmap: true,
        intent: 'print',
      }).promise;

      const base64 = canvasAndCtx.canvas.toBuffer('image/jpeg', { quality }).toString('base64');
      return { success: true, preview: `data:image/jpeg;base64,${base64}` };
    } finally {
      canvasFactory.destroy(canvasAndCtx);
    }
  }

  // --- COMPRESS MODE: Full PDF re-generation ---
  const numPages = pdfDoc.numPages;
  parentPort.postMessage({ type: 'start', total: numPages });

  const doc = new PDFDocument({ autoFirstPage: false, compress: true });
  const writeStream = fs.createWriteStream(outputPath);
  doc.pipe(writeStream);

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvasAndCtx = canvasFactory.create(viewport.width, viewport.height);
    const ctx = canvasAndCtx.context;

    try {
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, viewport.width, viewport.height);

      await page.render({
        canvasContext: ctx,
        viewport,
        canvasFactory,
        disableCreateImageBitmap: true,
        intent: 'print',
      }).promise;

      const imgBuffer = canvasAndCtx.canvas.toBuffer('image/jpeg', { quality });
      const pageW = viewport.width / scale;
      const pageH = viewport.height / scale;
      doc.addPage({ size: [pageW, pageH], margin: 0 });
      doc.image(imgBuffer, 0, 0, { width: pageW, height: pageH });
      
      parentPort.postMessage({ type: 'progress', current: i, total: numPages });
    } finally {
      canvasFactory.destroy(canvasAndCtx);
    }
  }

  doc.end();

  await new Promise((resolve, reject) => {
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });

  return { success: true };
}

processTask()
  .then(result => parentPort.postMessage({ type: 'done', ...result }))
  .catch(err => parentPort.postMessage({ type: 'error', error: err.message }));
