import { parentPort, workerData } from 'worker_threads';
import fs from 'fs';
import { createCanvas, Image, ImageData, DOMMatrix } from 'canvas';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import PDFDocument from 'pdfkit';
import { PDFDocument as PDFLibDoc, degrees } from 'pdf-lib';

// --- POLYFILLS FOR WORKER (REQUIRED for pdfjs-dist in Node — do not remove) ---
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
  navigator: { userAgent: 'node' },
};
Object.assign(global, polyfills);
Object.assign(globalThis, polyfills);

// --- Tunables ---
const THUMBNAIL_PAGE_CAP = 50;          // Hard limit for memory safety
const THUMBNAIL_SCALE = 0.3;
const THUMBNAIL_JPEG_QUALITY = 0.5;

class NodeCanvasFactory {
  create(w, h) { const c = createCanvas(w, h); return { canvas: c, context: c.getContext('2d') }; }
  reset(cc, w, h) { cc.canvas.width = w; cc.canvas.height = h; }
  destroy(cc) { cc.canvas.width = 0; cc.canvas.height = 0; }
}

async function safeDestroy(pdfDoc) {
  if (!pdfDoc) return;
  try { await pdfDoc.cleanup(); } catch (_) { /* noop */ }
  try { await pdfDoc.destroy(); } catch (_) { /* noop */ }
}

async function processTask() {
  const { mode, type, inputPath, inputFiles, outputPath, quality, scale, pageConfigs } = workerData;

  // --- 0. THUMBNAILS MODE (Single File) ---
  if (type === 'thumbnails') {
    let data = new Uint8Array(fs.readFileSync(inputPath));
    const canvasFactory = new NodeCanvasFactory();
    const loadingTask = pdfjsLib.getDocument({ data, canvasFactory, disableFontFace: true, useSystemFonts: false });
    const pdfDoc = await loadingTask.promise;
    try {
      const count = pdfDoc.numPages;
      const thumbs = [];
      const limit = Math.min(count, THUMBNAIL_PAGE_CAP);
      for (let i = 1; i <= limit; i++) {
        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale: THUMBNAIL_SCALE });
        const cc = canvasFactory.create(viewport.width, viewport.height);
        try {
          cc.context.fillStyle = 'white';
          cc.context.fillRect(0, 0, viewport.width, viewport.height);
          await page.render({ canvasContext: cc.context, viewport, canvasFactory, disableCreateImageBitmap: true }).promise;
          thumbs.push({ id: i, src: `data:image/jpeg;base64,${cc.canvas.toBuffer('image/jpeg', { quality: THUMBNAIL_JPEG_QUALITY }).toString('base64')}` });
        } finally {
          try { page.cleanup(); } catch (_) {}
          canvasFactory.destroy(cc);
        }
      }
      return { success: true, thumbnails: thumbs, totalPages: count };
    } finally {
      await safeDestroy(pdfDoc);
      data = null; // release buffer
    }
  }

  // --- 1. LOSSLESS DIRECT EDIT & MERGE MODE ---
  if (mode === 'direct' && type === 'compress') {
    const newDoc = await PDFLibDoc.create();
    newDoc.setProducer('PDF Master v5.0');
    newDoc.setCreator('PDF Master v5.0');
    try { newDoc.setAuthor(''); newDoc.setSubject(''); } catch (_) {}

    const loadedDocs = new Map();
    try {
      for (const f of inputFiles) {
        let data = new Uint8Array(fs.readFileSync(f.path));
        loadedDocs.set(f.id, await PDFLibDoc.load(data));
        data = null;
      }

      parentPort.postMessage({ type: 'start', total: pageConfigs.length });

      for (let i = 0; i < pageConfigs.length; i++) {
        const config = pageConfigs[i];
        const pdfDoc = loadedDocs.get(config.fileId);
        const [copiedPage] = await newDoc.copyPages(pdfDoc, [config.index - 1]);
        if (config.rotation) copiedPage.setRotation(degrees(config.rotation));
        newDoc.addPage(copiedPage);
        parentPort.postMessage({ type: 'progress', current: i + 1, total: pageConfigs.length });
      }

      let bytes = await newDoc.save();
      fs.writeFileSync(outputPath, bytes);
      bytes = null;
    } finally {
      loadedDocs.clear();
    }
    return { success: true };
  }

  // --- 2. RASTERIZE PREVIEW & COMPRESS MODES ---
  const canvasFactory = new NodeCanvasFactory();
  const loadedDocs = new Map();
  try {
    for (const f of inputFiles) {
      let data = new Uint8Array(fs.readFileSync(f.path));
      const loadingTask = pdfjsLib.getDocument({ data, canvasFactory, disableFontFace: true, useSystemFonts: false });
      loadedDocs.set(f.id, await loadingTask.promise);
      data = null;
    }

    if (type === 'preview') {
      if (!pageConfigs || pageConfigs.length === 0) return { success: true, preview: null };
      const config = pageConfigs[0];
      const pdfDoc = loadedDocs.get(config.fileId);
      const page = await pdfDoc.getPage(config.index);
      const viewport = page.getViewport({ scale: 1.5, rotation: config.rotation || 0 });
      const cc = canvasFactory.create(viewport.width, viewport.height);
      try {
        cc.context.fillStyle = 'white';
        cc.context.fillRect(0, 0, viewport.width, viewport.height);
        await page.render({ canvasContext: cc.context, viewport, canvasFactory, disableCreateImageBitmap: true, intent: 'print' }).promise;
        let buf = cc.canvas.toBuffer('image/jpeg', { quality });
        const preview = `data:image/jpeg;base64,${buf.toString('base64')}`;
        buf = null;
        return { success: true, preview };
      } finally {
        try { page.cleanup(); } catch (_) {}
        canvasFactory.destroy(cc);
      }
    }

    // COMPRESS (RASTERIZE)
    parentPort.postMessage({ type: 'start', total: pageConfigs.length });
    const doc = new PDFDocument({
      autoFirstPage: false,
      compress: true,
      info: { Producer: 'PDF Master v5.0', Creator: 'PDF Master v5.0' },
    });
    const writeStream = fs.createWriteStream(outputPath);
    doc.pipe(writeStream);

    for (let i = 0; i < pageConfigs.length; i++) {
      const config = pageConfigs[i];
      const pdfDoc = loadedDocs.get(config.fileId);
      const page = await pdfDoc.getPage(config.index);
      const viewport = page.getViewport({ scale, rotation: config.rotation || 0 });
      const cc = canvasFactory.create(viewport.width, viewport.height);
      try {
        cc.context.fillStyle = 'white';
        cc.context.fillRect(0, 0, viewport.width, viewport.height);
        await page.render({ canvasContext: cc.context, viewport, canvasFactory, disableCreateImageBitmap: true, intent: 'print' }).promise;
        const pageW = viewport.width / scale;
        const pageH = viewport.height / scale;
        doc.addPage({ size: [pageW, pageH], margin: 0 });
        let imgBuf = cc.canvas.toBuffer('image/jpeg', { quality });
        doc.image(imgBuf, 0, 0, { width: pageW, height: pageH });
        imgBuf = null;
        parentPort.postMessage({ type: 'progress', current: i + 1, total: pageConfigs.length });
      } finally {
        try { page.cleanup(); } catch (_) {}
        canvasFactory.destroy(cc);
      }
    }
    doc.end();
    await new Promise((res, rej) => { writeStream.on('finish', res); writeStream.on('error', rej); });
    return { success: true };
  } finally {
    for (const pdfDoc of loadedDocs.values()) {
      await safeDestroy(pdfDoc);
    }
    loadedDocs.clear();
  }
}

processTask()
  .then(result => parentPort.postMessage({ type: 'done', ...result }))
  .catch(err => parentPort.postMessage({ type: 'error', error: err.message }));
