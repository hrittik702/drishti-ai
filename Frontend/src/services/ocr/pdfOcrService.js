import * as pdfjsLib from 'pdfjs-dist';

// Initialize PDF.js worker locally for client-side execution
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).href;
  } catch (e) {
    console.warn('PDF worker URL initialization deferred:', e);
  }
}

export const MAX_PDF_PAGES_DEFAULT = 20;

/**
 * Renders PDF pages to offscreen canvas and passes each page to Tesseract worker
 * @param {Blob|File|ArrayBuffer} pdfInput 
 * @param {Object} worker - Initialized Tesseract worker
 * @param {Object} options - { maxPages, onProgress, signal }
 * @returns {Promise<{ text: string, pageCount: number }>}
 */
export async function processPdfOcr(pdfInput, worker, options = {}) {
  const maxPages = options.maxPages || MAX_PDF_PAGES_DEFAULT;
  const onProgress = options.onProgress || (() => {});
  const signal = options.signal;

  let arrayBuffer;
  if (pdfInput instanceof ArrayBuffer) {
    arrayBuffer = pdfInput;
  } else if (pdfInput && typeof pdfInput.arrayBuffer === 'function') {
    arrayBuffer = await pdfInput.arrayBuffer();
  } else {
    throw new Error('Invalid PDF input type.');
  }

  if (signal?.aborted) {
    throw new DOMException('OCR operation cancelled', 'AbortError');
  }

  onProgress({
    stage: 'loading_pdf',
    status: 'Reading PDF document structure...',
    progress: 0.05
  });

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true
  });

  const pdf = await loadingTask.promise;
  const totalDocPages = pdf.numPages;
  const pagesToProcess = Math.min(totalDocPages, maxPages);

  if (pagesToProcess === 0) {
    return { text: '', pageCount: 0, totalPages: totalDocPages };
  }

  const pageTexts = [];

  for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
    if (signal?.aborted) {
      throw new DOMException('OCR operation cancelled', 'AbortError');
    }

    onProgress({
      stage: 'rendering_page',
      status: `Rendering page ${pageNum} of ${pagesToProcess}...`,
      page: pageNum,
      totalPages: pagesToProcess,
      progress: (pageNum - 1) / pagesToProcess
    });

    const page = await pdf.getPage(pageNum);
    
    // Scale 1.5 offers optimal trade-off between OCR precision and memory
    const viewport = page.getViewport({ scale: 1.5 });
    
    // Create an offscreen canvas
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d');

    const renderContext = {
      canvasContext: ctx,
      viewport: viewport
    };

    await page.render(renderContext).promise;

    if (signal?.aborted) {
      canvas.width = 0;
      canvas.height = 0;
      throw new DOMException('OCR operation cancelled', 'AbortError');
    }

    onProgress({
      stage: 'recognizing_page',
      status: `Extracting text: page ${pageNum} of ${pagesToProcess}...`,
      page: pageNum,
      totalPages: pagesToProcess,
      progress: (pageNum - 0.5) / pagesToProcess
    });

    // Feed canvas directly to Tesseract.js worker
    const result = await worker.recognize(canvas);
    const extractedPageText = (result.data?.text || '').trim();

    pageTexts.push(`--- Page ${pageNum} ---\n${extractedPageText}`);

    // Free canvas memory
    canvas.width = 0;
    canvas.height = 0;
  }

  let combinedText = pageTexts.join('\n\n');
  if (totalDocPages > pagesToProcess) {
    combinedText += `\n\n[Note: Document exceeds ${pagesToProcess}-page browser OCR limit. Remaining ${totalDocPages - pagesToProcess} pages not processed.]`;
  }

  return {
    text: combinedText,
    pageCount: pagesToProcess,
    totalDocPages: totalDocPages
  };
}
