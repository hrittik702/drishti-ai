import { createWorker } from 'tesseract.js';
import { processPdfOcr } from './pdfOcrService.js';
import mammoth from 'mammoth';

let sharedWorker = null;
let currentLanguage = 'eng';
let activeProgressCallback = null;

/**
 * Checks whether a given file/mime-type is eligible for OCR or text extraction
 */
export function isOcrSupported(mimeType = '', filename = '') {
  const mime = (mimeType || '').toLowerCase();
  const ext = (filename || '').split('.').pop().toLowerCase();

  // 1. Image formats
  if (
    mime.startsWith('image/') ||
    ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'pbm', 'tiff'].includes(ext)
  ) {
    return { supported: true, type: 'IMAGE' };
  }

  // 2. PDF
  if (mime === 'application/pdf' || ext === 'pdf') {
    return { supported: true, type: 'PDF' };
  }

  // 3. DOCX (Native document text extraction via mammoth)
  if (
    mime.includes('wordprocessingml') ||
    mime.includes('msword') ||
    ext === 'docx'
  ) {
    return { supported: true, type: 'DOCX' };
  }

  // 4. Plain text / CSV (Direct text readable)
  if (
    mime.startsWith('text/') ||
    ['txt', 'csv', 'json', 'log'].includes(ext)
  ) {
    return { supported: true, type: 'TEXT' };
  }

  return { 
    supported: false, 
    type: 'UNSUPPORTED', 
    reason: 'OCR not applicable for audio, video, or binary archive formats.' 
  };
}

/**
 * Reusable worker initializer
 */
export async function initializeOCR(language = 'eng', onProgress = null) {
  activeProgressCallback = onProgress;

  if (sharedWorker && currentLanguage === language) {
    return sharedWorker;
  }

  if (sharedWorker) {
    await terminateOCR();
  }

  sharedWorker = await createWorker(language, 1, {
    logger: (m) => {
      if (activeProgressCallback) {
        activeProgressCallback({
          stage: m.status,
          status: m.status === 'recognizing text' ? `Extracting text (${Math.round((m.progress || 0) * 100)}%)...` : m.status,
          progress: m.progress || 0
        });
      }
    }
  });

  currentLanguage = language;
  return sharedWorker;
}

/**
 * Terminates the OCR worker and frees system resources
 */
export async function terminateOCR() {
  if (sharedWorker) {
    const worker = sharedWorker;
    sharedWorker = null;
    activeProgressCallback = null;
    try {
      await worker.terminate();
    } catch (err) {
      console.warn('Error terminating OCR worker:', err);
    }
  }
}

/**
 * Extract text from an image Blob/File using Tesseract.js
 */
export async function recognizeImage(imageBlob, options = {}) {
  const language = options.language || 'eng';
  const onProgress = options.onProgress || (() => {});
  const signal = options.signal;

  if (signal?.aborted) {
    throw new DOMException('OCR operation cancelled', 'AbortError');
  }

  onProgress({ stage: 'init', status: 'Initializing OCR engine...', progress: 0.1 });

  const worker = await initializeOCR(language, onProgress);

  if (signal?.aborted) {
    await terminateOCR();
    throw new DOMException('OCR operation cancelled', 'AbortError');
  }

  onProgress({ stage: 'recognize', status: 'Extracting text from image...', progress: 0.4 });

  const result = await worker.recognize(imageBlob);

  if (signal?.aborted) {
    await terminateOCR();
    throw new DOMException('OCR operation cancelled', 'AbortError');
  }

  return {
    text: (result.data?.text || '').trim(),
    pageCount: 1,
    confidence: result.data?.confidence,
    language
  };
}

/**
 * Extract text from a PDF Blob using canvas rendering and Tesseract.js
 */
export async function recognizePDF(pdfBlob, options = {}) {
  const language = options.language || 'eng';
  const onProgress = options.onProgress || (() => {});
  const signal = options.signal;

  if (signal?.aborted) {
    throw new DOMException('OCR operation cancelled', 'AbortError');
  }

  const worker = await initializeOCR(language, onProgress);

  return await processPdfOcr(pdfBlob, worker, {
    maxPages: options.maxPages || 20,
    onProgress,
    signal
  });
}

/**
 * Extract text directly from a DOCX Blob using mammoth
 */
export async function extractDocxText(docxBlob) {
  const arrayBuffer = await docxBlob.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return {
    text: (result.value || '').trim(),
    pageCount: 1,
    language: 'eng'
  };
}

/**
 * Universal document OCR / text extraction entrypoint
 */
export async function recognizeDocument(fileBlob, metadata = {}, options = {}) {
  const mimeType = fileBlob.type || metadata.mimeType || '';
  const filename = metadata.name || fileBlob.name || '';
  const support = isOcrSupported(mimeType, filename);

  if (!support.supported) {
    return {
      status: 'NOT_APPLICABLE',
      text: '',
      pageCount: 0,
      language: options.language || 'eng',
      error: support.reason
    };
  }

  const onProgress = options.onProgress || (() => {});
  const signal = options.signal;

  try {
    let result;

    if (support.type === 'IMAGE') {
      result = await recognizeImage(fileBlob, { ...options, onProgress, signal });
    } else if (support.type === 'PDF') {
      result = await recognizePDF(fileBlob, { ...options, onProgress, signal });
    } else if (support.type === 'DOCX') {
      onProgress({ stage: 'parsing_docx', status: 'Extracting text from DOCX...', progress: 0.5 });
      result = await extractDocxText(fileBlob);
    } else if (support.type === 'TEXT') {
      onProgress({ stage: 'reading_text', status: 'Reading text payload...', progress: 0.5 });
      const text = await fileBlob.text();
      result = { text: text.trim(), pageCount: 1, language: 'eng' };
    }

    onProgress({ stage: 'completed', status: 'Text extraction completed.', progress: 1 });

    return {
      status: 'COMPLETED',
      text: result.text || '',
      pageCount: result.pageCount || 1,
      language: options.language || 'eng',
      processedAt: new Date().toISOString(),
      error: null
    };

  } catch (err) {
    if (err.name === 'AbortError' || signal?.aborted) {
      await terminateOCR();
      return {
        status: 'CANCELLED',
        text: '',
        pageCount: 0,
        language: options.language || 'eng',
        processedAt: new Date().toISOString(),
        error: 'OCR processing was cancelled by user.'
      };
    }

    console.error('OCR Extraction failed:', err);
    return {
      status: 'FAILED',
      text: '',
      pageCount: 0,
      language: options.language || 'eng',
      processedAt: new Date().toISOString(),
      error: err.message || 'Unable to extract text from document.'
    };
  }
}
