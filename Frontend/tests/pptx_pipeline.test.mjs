import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { detectMimeType, ensureRenderableBlob, getFileInfo, VIEWER_TYPES } from '../src/utils/fileTypes.js';
import { DocumentRepository } from '../src/services/documentRepository.js';
import { blobMemoryCache } from '../src/services/db.js';

// OpenXML Presentation parser for testing
async function parsePptx(buffer) {
  if (!buffer || buffer.byteLength === 0) {
    throw new Error('Empty PPTX binary (0 bytes)');
  }
  let zip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch (err) {
    throw new Error('Invalid OpenXML archive format: ' + err.message);
  }

  const presFile = zip.file('ppt/presentation.xml');
  if (!presFile) {
    throw new Error('Missing ppt/presentation.xml');
  }

  const presXml = await presFile.async('text');
  const szMatch = presXml.match(/<p:sldSz[^>]*cx="(\d+)"[^>]*cy="(\d+)"/);
  const cx = szMatch ? parseInt(szMatch[1], 10) : 9144000;
  const cy = szMatch ? parseInt(szMatch[2], 10) : 5143500;

  const slideFiles = Object.keys(zip.files)
    .filter(k => /^ppt\/slides\/slide\d+\.xml$/.test(k))
    .sort();

  if (slideFiles.length === 0) {
    throw new Error('No slides found in PPTX');
  }

  const slides = await Promise.all(slideFiles.map(async (file, index) => {
    const xml = await zip.file(file).async('text');
    const hasImage = xml.includes('<p:pic>') || /<a:blip[^>]*r:embed=/.test(xml);
    return {
      index,
      file,
      hasImage,
      nodes: hasImage ? [{ type: 'shape' }, { type: 'picture', src: 'blob:mock-evidence' }] : [{ type: 'shape' }]
    };
  }));

  return {
    width: Math.round(cx / 9525),
    height: Math.round(cy / 9525),
    slides
  };
}

// Helper to generate genuine OpenXML PPTX binary buffers for testing
async function generateTestPptx({ slides = 1, width = 9144000, height = 5143500, hasImage = false } = {}) {
  const zip = new JSZip();
  let types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>`;

  let presRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`;

  let sldIdLst = '';

  for (let i = 1; i <= slides; i++) {
    types += `<Override PartName="/ppt/slides/slide${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
    presRels += `<Relationship Id="rId${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i}.xml"/>`;
    sldIdLst += `<p:sldId id="${255 + i}" r:id="rId${i}"/>`;

    let slideRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`;

    let imageXml = '';
    if (hasImage && i === 1) {
      zip.file('ppt/media/evidence_photo.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
      slideRels += `<Relationship Id="img1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/evidence_photo.png"/>`;
      imageXml = `<p:pic>
        <p:nvPicPr><p:cNvPr id="4" name="Evidence 1"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>
        <p:blipFill><a:blip r:embed="img1"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>
        <p:spPr><a:xfrm><a:off x="500000" y="500000"/><a:ext cx="2000000" cy="2000000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>
      </p:pic>`;
    }

    slideRels += `</Relationships>`;
    zip.file(`ppt/slides/_rels/slide${i}.xml.rels`, slideRels);

    zip.file(`ppt/slides/slide${i}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="1000000" y="1000000"/><a:ext cx="7000000" cy="1500000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:p><a:r><a:t>Slide ${i}: Forensic Briefing</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>
      ${imageXml}
    </p:spTree>
  </p:cSld>
</p:sld>`);
  }

  types += `</Types>`;
  presRels += `</Relationships>`;

  zip.file('[Content_Types].xml', types);
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`);

  zip.file('ppt/presentation.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldIdLst>${sldIdLst}</p:sldIdLst>
  <p:sldSz cx="${width}" cy="${height}"/>
</p:presentation>`);

  zip.file('ppt/_rels/presentation.xml.rels', presRels);

  return await zip.generateAsync({ type: 'arraybuffer' });
}

test('PPTX Pipeline: detectMimeType and getFileInfo correctly classify PPTX and legacy PPT', () => {
  // Modern PPTX
  const pptxMime = detectMimeType(new Blob(['test']), 'briefing.pptx');
  assert.equal(pptxMime, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');

  const pptxInfo = getFileInfo('application/vnd.openxmlformats-officedocument.presentationml.presentation', 'briefing.pptx');
  assert.equal(pptxInfo.viewerType, VIEWER_TYPES.PPTX);
  assert.equal(pptxInfo.badgeColor, 'orange');

  // Legacy PPT
  const pptMime = detectMimeType(new Blob(['test']), 'legacy_report.ppt');
  assert.equal(pptMime, 'application/vnd.ms-powerpoint');

  const pptInfo = getFileInfo('application/vnd.ms-powerpoint', 'legacy_report.ppt');
  assert.equal(pptInfo.viewerType, VIEWER_TYPES.UNSUPPORTED);
  assert.equal(pptInfo.isLegacy, true);
  assert.equal(pptInfo.customMessage, 'Preview unavailable for this format');
});

test('PPTX Pipeline: ensureRenderableBlob preserves valid presentation Blob and ArrayBuffer', () => {
  const pptxMime = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  const rawBuffer = new Uint8Array([80, 75, 3, 4]).buffer; // PK header
  const blobFromBuffer = ensureRenderableBlob(rawBuffer, 'evidence.pptx', pptxMime);

  assert.ok(blobFromBuffer instanceof Blob);
  assert.equal(blobFromBuffer.type, pptxMime);
  assert.equal(blobFromBuffer.size, 4);

  const existingBlob = new Blob([rawBuffer], { type: pptxMime });
  const preserved = ensureRenderableBlob(existingBlob, 'evidence.pptx');
  assert.equal(preserved, existingBlob);
});

test('PPTX Pipeline: parsePptx parses 16:9, 4:3, multi-slide, and image presentations from ArrayBuffer', async () => {
  // 1. Small 1-slide presentation
  const smallBuf = await generateTestPptx({ slides: 1 });
  const p1 = await parsePptx(smallBuf);
  assert.equal(p1.slides.length, 1);
  assert.ok(p1.width > 0 && p1.height > 0);

  // 2. Multi-slide presentation (3 slides)
  const multiBuf = await generateTestPptx({ slides: 3 });
  const p2 = await parsePptx(multiBuf);
  assert.equal(p2.slides.length, 3);
  assert.equal(p2.slides[0].index, 0);
  assert.equal(p2.slides[2].index, 2);

  // 3. 16:9 Aspect Ratio
  const wideBuf = await generateTestPptx({ width: 9144000, height: 5143500 });
  const p3 = await parsePptx(wideBuf);
  assert.equal(p3.width, 960);
  assert.equal(p3.height, 540);
  assert.ok(Math.abs(p3.width / p3.height - 16 / 9) < 0.01);

  // 4. 4:3 Aspect Ratio
  const stdBuf = await generateTestPptx({ width: 9144000, height: 6858000 });
  const p4 = await parsePptx(stdBuf);
  assert.equal(p4.width, 960);
  assert.equal(p4.height, 720);
  assert.ok(Math.abs(p4.width / p4.height - 4 / 3) < 0.01);

  // 5. Embedded image slide
  const imgBuf = await generateTestPptx({ slides: 1, hasImage: true });
  const p5 = await parsePptx(imgBuf);
  assert.equal(p5.slides[0].nodes.length, 2);
  const picNode = p5.slides[0].nodes.find(n => n.type === 'picture');
  assert.ok(picNode);
  assert.ok(picNode.src.startsWith('blob:'));
});

test('PPTX Pipeline: Full lifecycle Upload → IndexedDB/Repository → Retrieve Blob → ArrayBuffer → Reopen', async () => {
  const pptxMime = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  const originalBuffer = await generateTestPptx({ slides: 2 });
  const originalBlob = new Blob([originalBuffer], { type: pptxMime });

  // 1. Ingest via DocumentRepository
  const doc = await DocumentRepository.createDocumentWithFile(
    {
      caseId: 'INV-2026-TEST',
      name: 'Courtroom_Exhibit_Slides.pptx',
      classification: 'Confidential',
      category: 'Evidence Record'
    },
    originalBlob,
    { name: 'Officer Test', designation: 'Forensic Lead' }
  );

  assert.ok(doc.id);
  assert.equal(doc.name, 'Courtroom_Exhibit_Slides.pptx');
  assert.equal(doc.mimeType, pptxMime);
  assert.equal(doc.size, originalBlob.size);

  // 2. Clear version memory cache to simulate document closing / navigation
  blobMemoryCache.delete(doc.currentVersionId);

  // 3. Re-fetch Blob from repository storage
  const retrievedBlob = await DocumentRepository.getVersionBlob(doc.currentVersionId, doc.id);
  assert.ok(retrievedBlob instanceof Blob);
  assert.equal(retrievedBlob.size, originalBlob.size);
  assert.equal(retrievedBlob.type, pptxMime);

  // 4. Convert retrieved Blob to ArrayBuffer as required by viewer pipeline
  const arrayBuffer = await retrievedBlob.arrayBuffer();
  assert.ok(arrayBuffer instanceof ArrayBuffer);
  assert.equal(arrayBuffer.byteLength, originalBlob.size);

  // 5. Verify the retrieved binary renders cleanly via parsePptx
  const parsed = await parsePptx(arrayBuffer);
  assert.equal(parsed.slides.length, 2);
  assert.equal(parsed.width, 960);
  assert.equal(parsed.height, 540);

  // 6. Cleanup
  await DocumentRepository.deleteDocument(doc.id);
});

test('PPTX Pipeline: Corrupted or 0-byte buffer fails gracefully without crashing', async () => {
  // Empty buffer (0 bytes)
  const emptyBuf = new ArrayBuffer(0);
  await assert.rejects(async () => {
    await parsePptx(emptyBuf);
  });

  // Corrupted non-zip payload
  const corruptedBuf = new Uint8Array([0x00, 0xFF, 0xEE, 0xDD]).buffer;
  await assert.rejects(async () => {
    await parsePptx(corruptedBuf);
  });
});
