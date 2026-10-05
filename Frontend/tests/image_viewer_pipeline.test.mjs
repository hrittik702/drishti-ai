import test from 'node:test';
import assert from 'node:assert/strict';
import { detectMimeType, ensureRenderableBlob, getFileInfo, VIEWER_TYPES } from '../src/utils/fileTypes.js';
import { DocumentRepository } from '../src/services/documentRepository.js';
import { blobMemoryCache } from '../src/services/db.js';

test('Image Pipeline: detectMimeType preserves and resolves image MIME types accurately', () => {
  // 1. JPEG
  assert.equal(detectMimeType(new Blob(['data'], { type: 'image/jpeg' }), 'photo.jpg'), 'image/jpeg');
  assert.equal(detectMimeType(new Blob(['data']), 'photo.jpeg'), 'image/jpeg');
  assert.equal(detectMimeType(new Blob(['data'], { type: 'application/octet-stream' }), 'evidence.jpg'), 'image/jpeg');

  // 2. PNG
  assert.equal(detectMimeType(new Blob(['data'], { type: 'image/png' }), 'scan.png'), 'image/png');
  assert.equal(detectMimeType(new Blob(['data']), 'scan.png'), 'image/png');

  // 3. WEBP
  assert.equal(detectMimeType(new Blob(['data'], { type: 'image/webp' }), 'compressed.webp'), 'image/webp');
  assert.equal(detectMimeType(new Blob(['data']), 'compressed.webp'), 'image/webp');

  // 4. GIF
  assert.equal(detectMimeType(new Blob(['data'], { type: 'image/gif' }), 'animation.gif'), 'image/gif');
  assert.equal(detectMimeType(new Blob(['data']), 'cctv_loop.gif'), 'image/gif');

  // 5. SVG
  assert.equal(detectMimeType(new Blob(['<svg></svg>'], { type: 'image/svg+xml' }), 'diagram.svg'), 'image/svg+xml');
  assert.equal(detectMimeType(new Blob(['<svg></svg>'], { type: 'text/plain' }), 'diagram.svg'), 'image/svg+xml');
  assert.equal(detectMimeType(new Blob(['<svg></svg>']), 'diagram.svg'), 'image/svg+xml');

  // 6. BMP
  assert.equal(detectMimeType(new Blob(['data'], { type: 'image/bmp' }), 'raw_scan.bmp'), 'image/bmp');
  assert.equal(detectMimeType(new Blob(['data']), 'raw_scan.bmp'), 'image/bmp');
});

test('Image Pipeline: ensureRenderableBlob constructs valid renderable Blobs', () => {
  // ArrayBuffer input
  const buffer = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]).buffer;
  const fromBuffer = ensureRenderableBlob(buffer, 'fingerprint.png');
  assert.ok(fromBuffer instanceof Blob);
  assert.equal(fromBuffer.type, 'image/png');
  assert.equal(fromBuffer.size, 8);

  // Uint8Array input
  const uint8 = new Uint8Array([255, 216, 255, 224]);
  const fromUint8 = ensureRenderableBlob(uint8, 'scene.jpg');
  assert.ok(fromUint8 instanceof Blob);
  assert.equal(fromUint8.type, 'image/jpeg');
  assert.equal(fromUint8.size, 4);

  // Blob with missing type gets corrected
  const untypedBlob = new Blob(['sample-svg'], { type: '' });
  const fixedBlob = ensureRenderableBlob(untypedBlob, 'floorplan.svg');
  assert.ok(fixedBlob instanceof Blob);
  assert.equal(fixedBlob.type, 'image/svg+xml');

  // Blob with valid type is preserved without unnecessary conversion
  const validWebp = new Blob(['webp-data'], { type: 'image/webp' });
  const preservedBlob = ensureRenderableBlob(validWebp, 'photo.webp');
  assert.equal(preservedBlob, validWebp);

  // Invalid / null
  assert.equal(ensureRenderableBlob(null), null);
  assert.equal(ensureRenderableBlob(undefined), null);
});

test('Image Pipeline: File type matrix routes all image extensions to ImageViewer', () => {
  const exts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp'];
  for (const ext of exts) {
    const info = getFileInfo('', `sample.${ext}`);
    assert.equal(info.viewerType, VIEWER_TYPES.IMAGE, `Expected extension ${ext} to map to VIEWER_TYPES.IMAGE`);
  }
});

test('Image Pipeline: Full lifecycle Upload → Stored → Retrieve Blob → Close → Reopen', async () => {
  // 1. Mock file
  const testBytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);
  const originalBlob = new Blob([testBytes], { type: 'image/jpeg' });
  const mockUser = { name: 'Inspector Roy', role: 'IO' };

  // 2. Upload and store
  const createdDoc = await DocumentRepository.createDocumentWithFile(
    { caseId: 'INV-2026-TEST', name: 'evidence_scene.jpg', classification: 'Confidential' },
    originalBlob,
    mockUser
  );

  assert.ok(createdDoc.id);
  assert.ok(createdDoc.currentVersionId);
  assert.equal(createdDoc.mimeType, 'image/jpeg');
  assert.equal(createdDoc.size, testBytes.length);

  // 3. Retrieval via DocumentRepository.getVersionBlob
  const retrievedBlob = await DocumentRepository.getVersionBlob(createdDoc.currentVersionId, createdDoc.id);
  assert.ok(retrievedBlob);
  assert.ok(retrievedBlob instanceof Blob);
  assert.equal(retrievedBlob.size, testBytes.length);
  assert.equal(retrievedBlob.type, 'image/jpeg');

  // 4. Simulate viewer close (memory cache eviction test)
  blobMemoryCache.delete(createdDoc.currentVersionId);

  // 5. Reopen document (fetches from IndexedDB or documents store fallback)
  const reopenedBlob = await DocumentRepository.getVersionBlob(createdDoc.currentVersionId, createdDoc.id);
  assert.ok(reopenedBlob);
  assert.ok(reopenedBlob instanceof Blob);
  assert.equal(reopenedBlob.size, testBytes.length);
  assert.equal(reopenedBlob.type, 'image/jpeg');

  // 6. Cleanup
  await DocumentRepository.deleteDocument(createdDoc.id);
});

test('Image Pipeline: Large image payload is stored and retrieved with exact byte size', async () => {
  // 1MB mock image buffer
  const largeBytes = new Uint8Array(1024 * 1024);
  largeBytes.fill(42);
  const largeBlob = new Blob([largeBytes], { type: 'image/png' });

  const doc = await DocumentRepository.createDocumentWithFile(
    { caseId: 'INV-2026-TEST', name: 'high_res_satellite.png' },
    largeBlob,
    { name: 'Officer' }
  );

  const retrieved = await DocumentRepository.getVersionBlob(doc.currentVersionId, doc.id);
  assert.ok(retrieved instanceof Blob);
  assert.equal(retrieved.size, 1024 * 1024);
  assert.equal(retrieved.type, 'image/png');

  await DocumentRepository.deleteDocument(doc.id);
});
