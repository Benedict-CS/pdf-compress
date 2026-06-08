import { parentPort, workerData } from 'worker_threads';
import fs from 'fs';
import { createCanvas, Image, ImageData, DOMMatrix } from 'canvas';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import PDFDocument from 'pdfkit';
import { PDFDocument as PDFLibDoc, degrees } from 'pdf-lib';

// --- POLYFILLS FOR WORKER ---
const Canvas = createCanvas(1, 1).constructor;
const polyfills = {
  window: global,
  document: { createElement: (n) => n === 'canvas' ? createCanvas(1, 1) : {} },
  Image, ImageData, DOMMatrix,
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
  create(w, h) { const c = createCanvas(w, h); return { canvas: c, context: c.getContext('2d') }; }
  reset(cc, w, h) { cc.canvas.width = w; cc.canvas.height = h; }
  destroy(cc) { cc.canvas.width = 0; cc.canvas.height = 0; }
}

async function processTask() {
  const { mode, type, inputPath, outputPath, quality, scale, pageConfigs } = workerData;
  const data = new Uint8Array(fs.readFileSync(inputPath));

  // --- 1. LOSSLESS DIRECT EDIT MODE (Super Fast) ---
  if (mode === 'direct' && type === 'compress') {
    const pdfDoc = await PDFLibDoc.load(data);
    const newDoc = await PDFLibDoc.create();
    
    parentPort.postMessage({ type: 'start', total: pageConfigs.length });
    
    for (let i = 0; i < pageConfigs.length; i++) {
      const config = pageConfigs[i];
      const [copiedPage] = await newDoc.copyPages(pdfDoc, [config.index - 1]);
      if (config.rotation) {
        copiedPage.setRotation(degrees(config.rotation));
      }
      newDoc.addPage(copiedPage);
      parentPort.postMessage({ type: 'progress', current: i + 1, total: pageConfigs.length });
    }
    
    const pdfBytes = await newDoc.save();
    fs.writeFileSync(outputPath, pdfBytes);
    return { success: true };
  }

  // --- 2. EXISTING RASTERIZE MODES ---
  const canvasFactory = new NodeCanvasFactory();
  const loadingTask = pdfjsLib.getDocument({
    data, canvasFactory, useWorkerFetch: false, isEvalSupported: false, disableFontFace: true, useSystemFonts: false,
  });

  const pdfDoc = await loadingTask.promise;

  if (type === 'thumbnails') {
    const count = pdfDoc.numPages;
    const thumbs = [];
    const limit = Math.min(count, 50);
    for (let i = 1; i <= limit; i++) {
      const page = await pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale: 0.4 });
      const cc = canvasFactory.create(viewport.width, viewport.height);
      try {
        cc.context.fillStyle = 'white'; cc.context.fillRect(0, 0, viewport.width, viewport.height);
        await page.render({ canvasContext: cc.context, viewport, canvasFactory, disableCreateImageBitmap: true }).promise;
        thumbs.push({ id: i, src: `data:image/jpeg;base64,${cc.canvas.toBuffer('image/jpeg', { quality: 0.5 }).toString('base64')}` });
      } finally { canvasFactory.destroy(cc); }
    }
    return { success: true, thumbnails: thumbs, totalPages: count };
  }

  if (type === 'preview') {
    const page = await pdfDoc.getPage(1);
    const rotation = pageConfigs?.[0]?.rotation || 0;
    const viewport = page.getViewport({ scale: 1.5, rotation });
    const cc = canvasFactory.create(viewport.width, viewport.height);
    try {
      cc.context.fillStyle = 'white'; cc.context.fillRect(0, 0, viewport.width, viewport.height);
      await page.render({ canvasContext: cc.context, viewport, canvasFactory, disableCreateImageBitmap: true, intent: 'print' }).promise;
      return { success: true, preview: `data:image/jpeg;base64,${cc.canvas.toBuffer('image/jpeg', { quality }).toString('base64')}` };
    } finally { canvasFactory.destroy(cc); }
  }

  // COMPRESS (RASTERIZE)
  const finalConfigs = pageConfigs || Array.from({ length: pdfDoc.numPages }, (_, i) => ({ index: i + 1, rotation: 0 }));
  const numPages = finalConfigs.length;
  parentPort.postMessage({ type: 'start', total: numPages });
  const doc = new PDFDocument({ autoFirstPage: false, compress: true });
  const writeStream = fs.createWriteStream(outputPath);
  doc.pipe(writeStream);

  for (let i = 0; i < numPages; i++) {
    const config = finalConfigs[i];
    const page = await pdfDoc.getPage(config.index);
    const viewport = page.getViewport({ scale, rotation: config.rotation || 0 });
    const cc = canvasFactory.create(viewport.width, viewport.height);
    try {
      cc.context.fillStyle = 'white'; cc.context.fillRect(0, 0, viewport.width, viewport.height);
      await page.render({ canvasContext: cc.context, viewport, canvasFactory, disableCreateImageBitmap: true, intent: 'print' }).promise;
      const pageW = viewport.width / scale;
      const pageH = viewport.height / scale;
      doc.addPage({ size: [pageW, pageH], margin: 0 });
      doc.image(cc.canvas.toBuffer('image/jpeg', { quality }), 0, 0, { width: pageW, height: pageH });
      parentPort.postMessage({ type: 'progress', current: i + 1, total: numPages });
    } finally { canvasFactory.destroy(cc); }
  }
  doc.end();
  await new Promise((res, rej) => { writeStream.on('finish', res); writeStream.on('error', rej); });
  return { success: true };
}

processTask()
  .then(result => parentPort.postMessage({ type: 'done', ...result }))
  .catch(err => parentPort.postMessage({ type: 'error', error: err.message }));
