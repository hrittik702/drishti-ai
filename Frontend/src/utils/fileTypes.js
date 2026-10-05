/**
 * CASEGUARD Central File Type Registry & Matrix
 * Maps MIME types and file extensions to specialized viewer types, categories, and OCR capabilities.
 */

export const VIEWER_TYPES = {
  PDF: 'PDF',
  DOCX: 'DOCX',
  SPREADSHEET: 'SPREADSHEET',
  PPTX: 'PPTX',
  IMAGE: 'IMAGE',
  VIDEO: 'VIDEO',
  AUDIO: 'AUDIO',
  TEXT: 'TEXT',
  ARCHIVE: 'ARCHIVE',
  UNSUPPORTED: 'UNSUPPORTED'
};

export const FILE_CATEGORIES = {
  DOCUMENT: 'Document',
  SPREADSHEET: 'Spreadsheet',
  PRESENTATION: 'Presentation',
  IMAGE: 'Image',
  VIDEO: 'Video',
  AUDIO: 'Audio',
  TEXT: 'Text / Code',
  ARCHIVE: 'Archive',
  OTHER: 'Binary / Other'
};

/**
 * Extract clean file extension without leading dot
 */
export function getFileExtension(filename = '') {
  if (!filename || typeof filename !== 'string') return '';
  const clean = filename.split('?')[0].split('#')[0];
  const parts = clean.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

/**
 * Determine viewer type, category, and OCR eligibility for a file
 */
export function getFileInfo(mimeType = '', filename = '') {
  const mime = (mimeType || '').toLowerCase().trim();
  const ext = getFileExtension(filename);

  // 1. PDF
  if (mime === 'application/pdf' || ext === 'pdf') {
    return {
      viewerType: VIEWER_TYPES.PDF,
      category: FILE_CATEGORIES.DOCUMENT,
      label: 'PDF Document',
      ocrEligible: true,
      badgeColor: 'red'
    };
  }

  // 2. Modern DOCX
  if (
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === 'docx'
  ) {
    return {
      viewerType: VIEWER_TYPES.DOCX,
      category: FILE_CATEGORIES.DOCUMENT,
      label: 'Word Document (DOCX)',
      ocrEligible: true, // text extraction via mammoth
      badgeColor: 'blue'
    };
  }

  // 3. Spreadsheet (XLSX, XLS, CSV, TSV)
  if (
    ext === 'xlsx' ||
    ext === 'xls' ||
    ext === 'csv' ||
    ext === 'tsv' ||
    mime.includes('spreadsheet') ||
    mime.includes('excel') ||
    mime === 'text/csv' ||
    mime === 'text/tab-separated-values'
  ) {
    return {
      viewerType: VIEWER_TYPES.SPREADSHEET,
      category: FILE_CATEGORIES.SPREADSHEET,
      label: ext === 'csv' ? 'CSV Dataset' : ext === 'tsv' ? 'TSV Dataset' : 'Excel Workbook',
      ocrEligible: ext === 'csv' || ext === 'tsv',
      badgeColor: 'emerald'
    };
  }

  // 4. PPTX Presentation (Modern OpenXML)
  if (
    mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    ext === 'pptx'
  ) {
    return {
      viewerType: VIEWER_TYPES.PPTX,
      category: FILE_CATEGORIES.PRESENTATION,
      label: 'PowerPoint Presentation',
      ocrEligible: false,
      badgeColor: 'orange'
    };
  }

  // 4b. Legacy PPT Presentation
  if (
    mime === 'application/vnd.ms-powerpoint' ||
    ext === 'ppt'
  ) {
    return {
      viewerType: VIEWER_TYPES.UNSUPPORTED,
      category: FILE_CATEGORIES.PRESENTATION,
      label: 'Legacy Presentation (.ppt)',
      ocrEligible: false,
      badgeColor: 'zinc',
      isLegacy: true,
      customMessage: 'Preview unavailable for this format'
    };
  }

  // 5. Image (PNG, JPG, JPEG, WEBP, GIF, SVG, BMP)
  if (
    mime.startsWith('image/') ||
    ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'ico', 'tiff'].includes(ext)
  ) {
    const isRaster = ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tiff'].includes(ext) || (mime.startsWith('image/') && !mime.includes('svg'));
    return {
      viewerType: VIEWER_TYPES.IMAGE,
      category: FILE_CATEGORIES.IMAGE,
      label: ext.toUpperCase() || 'Image',
      ocrEligible: isRaster,
      badgeColor: 'purple'
    };
  }

  // 6. Video
  if (
    mime.startsWith('video/') ||
    ['mp4', 'webm', 'ogv', 'mov', 'm4v', 'mkv'].includes(ext)
  ) {
    return {
      viewerType: VIEWER_TYPES.VIDEO,
      category: FILE_CATEGORIES.VIDEO,
      label: 'Video Media',
      ocrEligible: false,
      badgeColor: 'pink'
    };
  }

  // 7. Audio
  if (
    mime.startsWith('audio/') ||
    ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext)
  ) {
    return {
      viewerType: VIEWER_TYPES.AUDIO,
      category: FILE_CATEGORIES.AUDIO,
      label: 'Audio Recording',
      ocrEligible: false,
      badgeColor: 'amber'
    };
  }

  // 8. Text / Code / JSON / XML / Markdown
  if (
    mime.startsWith('text/') ||
    mime === 'application/json' ||
    mime === 'application/xml' ||
    ['txt', 'json', 'xml', 'md', 'log', 'yaml', 'yml', 'js', 'html', 'css'].includes(ext)
  ) {
    return {
      viewerType: VIEWER_TYPES.TEXT,
      category: FILE_CATEGORIES.TEXT,
      label: ext === 'json' ? 'JSON Data' : ext === 'xml' ? 'XML Document' : ext === 'md' ? 'Markdown' : 'Plain Text',
      ocrEligible: true,
      badgeColor: 'slate'
    };
  }

  // 9. Archives (ZIP)
  if (
    mime === 'application/zip' ||
    mime === 'application/x-zip-compressed' ||
    ext === 'zip'
  ) {
    return {
      viewerType: VIEWER_TYPES.ARCHIVE,
      category: FILE_CATEGORIES.ARCHIVE,
      label: 'ZIP Archive',
      ocrEligible: false,
      badgeColor: 'indigo'
    };
  }

  // 10. Legacy Office & Unsupported
  const isLegacyOffice = ['doc', 'ppt', 'rtf'].includes(ext);
  return {
    viewerType: VIEWER_TYPES.UNSUPPORTED,
    category: FILE_CATEGORIES.OTHER,
    label: isLegacyOffice ? `Legacy Office (${ext.toUpperCase()})` : (ext.toUpperCase() || 'Binary File'),
    ocrEligible: false,
    badgeColor: 'zinc',
    isLegacy: isLegacyOffice
  };
}

/**
 * Accurately detects and preserves MIME types for uploaded files,
 * especially ensuring images carry their native browser-renderable MIME type.
 */
export function detectMimeType(fileBlob, filename = '') {
  let mime = (fileBlob?.type || '').toLowerCase().trim();
  const ext = getFileExtension(filename || fileBlob?.name || '');

  const extMap = {
    // Images
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    bmp: 'image/bmp',
    ico: 'image/x-icon',
    tiff: 'image/tiff',
    tif: 'image/tiff',
    // Documents
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ppt: 'application/vnd.ms-powerpoint',
    txt: 'text/plain',
    csv: 'text/csv',
    tsv: 'text/tab-separated-values',
    json: 'application/json',
    xml: 'application/xml',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    zip: 'application/zip'
  };

  if (!mime || mime === 'application/octet-stream' || (mime.startsWith('text/') && extMap[ext]?.startsWith('image/'))) {
    if (extMap[ext]) {
      return extMap[ext];
    }
  }

  return mime || 'application/octet-stream';
}

/**
 * Ensures an image or binary source is a valid renderable Blob with the correct MIME type.
 * Handles Blobs, Files, ArrayBuffers, and Uint8Arrays without unnecessary conversions.
 */
export function ensureRenderableBlob(blob, filename = '', fallbackMime = '') {
  if (!blob) return null;
  if (typeof blob === 'string') return blob;

  const targetMime = fallbackMime || detectMimeType(blob, filename);

  // If ArrayBuffer or TypedArray view
  if (blob instanceof ArrayBuffer || ArrayBuffer.isView(blob)) {
    return new Blob([blob], { type: targetMime });
  }

  // If Blob or File
  if (blob instanceof Blob) {
    const ext = getFileExtension(filename || blob.name || '');
    // If blob type is missing or generic octet-stream, or for SVG if not image/svg+xml
    if (!blob.type || blob.type === 'application/octet-stream' || (ext === 'svg' && blob.type !== 'image/svg+xml')) {
      return new Blob([blob], { type: targetMime });
    }
    return blob;
  }

  return null;
}

