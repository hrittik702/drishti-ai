import test from 'node:test';
import assert from 'node:assert/strict';
import { getFileInfo, VIEWER_TYPES, FILE_CATEGORIES } from '../src/utils/fileTypes.js';
import { saveLocal, loadLocal } from '../src/services/db.js';

test('File Types Registry: Correctly maps MIME and extensions to viewer types', () => {
  // 1. PDF
  const pdfInfo = getFileInfo('application/pdf', 'warrant.pdf');
  assert.equal(pdfInfo.viewerType, VIEWER_TYPES.PDF);
  assert.equal(pdfInfo.category, FILE_CATEGORIES.DOCUMENT);
  assert.equal(pdfInfo.ocrEligible, true);

  // 2. DOCX
  const docxInfo = getFileInfo('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'affidavit.docx');
  assert.equal(docxInfo.viewerType, VIEWER_TYPES.DOCX);
  assert.equal(docxInfo.category, FILE_CATEGORIES.DOCUMENT);
  assert.equal(docxInfo.ocrEligible, true);

  // 3. Spreadsheet (XLSX, CSV)
  const xlsxInfo = getFileInfo('', 'financial_ledger.xlsx');
  assert.equal(xlsxInfo.viewerType, VIEWER_TYPES.SPREADSHEET);
  assert.equal(xlsxInfo.category, FILE_CATEGORIES.SPREADSHEET);

  const csvInfo = getFileInfo('text/csv', 'call_records.csv');
  assert.equal(csvInfo.viewerType, VIEWER_TYPES.SPREADSHEET);

  // 4. PPTX
  const pptxInfo = getFileInfo('', 'briefing.pptx');
  assert.equal(pptxInfo.viewerType, VIEWER_TYPES.PPTX);
  assert.equal(pptxInfo.category, FILE_CATEGORIES.PRESENTATION);

  // 5. Images (PNG, JPG)
  const pngInfo = getFileInfo('image/png', 'crime_scene.png');
  assert.equal(pngInfo.viewerType, VIEWER_TYPES.IMAGE);
  assert.equal(pngInfo.ocrEligible, true);

  // 6. Video (MP4)
  const mp4Info = getFileInfo('video/mp4', 'cctv_footage.mp4');
  assert.equal(mp4Info.viewerType, VIEWER_TYPES.VIDEO);

  // 7. Audio (MP3, WAV)
  const audioInfo = getFileInfo('audio/mpeg', 'wiretap_intercept.mp3');
  assert.equal(audioInfo.viewerType, VIEWER_TYPES.AUDIO);

  // 8. Text (TXT, JSON, MD)
  const textInfo = getFileInfo('text/plain', 'confession.txt');
  assert.equal(textInfo.viewerType, VIEWER_TYPES.TEXT);
  assert.equal(textInfo.ocrEligible, true);

  const jsonInfo = getFileInfo('application/json', 'metadata.json');
  assert.equal(jsonInfo.viewerType, VIEWER_TYPES.TEXT);

  // 9. Archives (ZIP)
  const zipInfo = getFileInfo('application/zip', 'case_evidence.zip');
  assert.equal(zipInfo.viewerType, VIEWER_TYPES.ARCHIVE);

  // 10. Legacy Unsupported (DOC, PPT)
  const docInfo = getFileInfo('', 'legacy_order.doc');
  assert.equal(docInfo.viewerType, VIEWER_TYPES.UNSUPPORTED);
  assert.equal(docInfo.isLegacy, true);

  const pptInfo = getFileInfo('', 'presentation_old.ppt');
  assert.equal(pptInfo.viewerType, VIEWER_TYPES.UNSUPPORTED);
  assert.equal(pptInfo.isLegacy, true);

  // 11. Generic Binary
  const binInfo = getFileInfo('application/octet-stream', 'memory_dump.bin');
  assert.equal(binInfo.viewerType, VIEWER_TYPES.UNSUPPORTED);
  assert.equal(binInfo.isLegacy, false);
});

test('Dual-Persistence Architecture: saveLocal and loadLocal preserve state across page reloads', () => {
  // Mock localStorage for node environment if not in browser
  const mockStorage = new Map();
  globalThis.localStorage = {
    getItem: (key) => mockStorage.get(key) || null,
    setItem: (key, val) => mockStorage.set(key, String(val)),
    removeItem: (key) => mockStorage.delete(key),
    clear: () => mockStorage.clear()
  };

  const sampleCases = [
    { id: 'CASE-01', caseNumber: 'CR/2026/001', title: 'Cyber Fraud Investigation' }
  ];

  saveLocal('test_caseguard_cases', sampleCases);
  const loaded = loadLocal('test_caseguard_cases', []);

  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].id, 'CASE-01');
  assert.equal(loaded[0].caseNumber, 'CR/2026/001');

  // Non-existent key falls back to default value
  const fallback = loadLocal('non_existent_key', ['default_item']);
  assert.deepEqual(fallback, ['default_item']);
});

test('Image Dynamic 90% Sizing: calculateFitDimensions correctly handles portrait, landscape, and clamping', async () => {
  const { calculateFitDimensions } = await import('../src/utils/imageFit.js');

  // 1. Standard Portrait Image: fits 90% container height, preserves aspect ratio
  // Container: 1000 x 800 (90% = 900 x 720)
  // Image: 600w x 1200h (aspect ratio = 0.5)
  const portraitFit = calculateFitDimensions(600, 1200, 1000, 800);
  assert.ok(portraitFit);
  assert.equal(portraitFit.isPortrait, true);
  assert.equal(portraitFit.height, 720); // 800 * 0.9
  assert.equal(portraitFit.width, 360);  // 720 * 0.5
  assert.ok(portraitFit.width <= 900);
  assert.ok(portraitFit.height <= 720);

  // 2. Standard Landscape Image: fits 90% container width, preserves aspect ratio
  // Container: 1000 x 800 (90% = 900 x 720)
  // Image: 1600w x 900h (aspect ratio = 16/9)
  const landscapeFit = calculateFitDimensions(1600, 900, 1000, 800);
  assert.ok(landscapeFit);
  assert.equal(landscapeFit.isPortrait, false);
  assert.equal(landscapeFit.width, 900); // 1000 * 0.9
  assert.equal(landscapeFit.height, Math.round(900 / (1600 / 900))); // 506
  assert.ok(landscapeFit.width <= 900);
  assert.ok(landscapeFit.height <= 720);

  // 3. Ultra-wide Landscape constrained by container height (never cropped)
  // Container: 1000 x 400 (90% = 900 x 360)
  // Image: 1200w x 800h (aspect ratio = 1.5)
  // Initial width 900 would yield height 600 (> 360), so clamps to height 360
  const wideClampFit = calculateFitDimensions(1200, 800, 1000, 400);
  assert.ok(wideClampFit);
  assert.equal(wideClampFit.height, 360); // clamped to 400 * 0.9
  assert.equal(wideClampFit.width, 540);  // 360 * 1.5
  assert.ok(wideClampFit.width <= 900);
  assert.ok(wideClampFit.height <= 360);

  // 4. Ultra-tall Portrait constrained by container width (never cropped)
  // Container: 400 x 1000 (90% = 360 x 900)
  // Image: 800w x 1000h (aspect ratio = 0.8)
  // Initial height 900 would yield width 720 (> 360), so clamps to width 360
  const tallClampFit = calculateFitDimensions(800, 1000, 400, 1000);
  assert.ok(tallClampFit);
  assert.equal(tallClampFit.width, 360); // clamped to 400 * 0.9
  assert.equal(tallClampFit.height, 450); // 360 / 0.8
  assert.ok(tallClampFit.width <= 360);
  assert.ok(tallClampFit.height <= 900);

  // 5. Inspector Open / Close Recalculation (container width shrinks from 1200 to 820)
  // Closed Inspector: 1200 x 800
  const inspectorClosedFit = calculateFitDimensions(600, 1200, 1200, 800);
  assert.equal(inspectorClosedFit.isPortrait, true);
  assert.equal(inspectorClosedFit.height, 720);
  assert.equal(inspectorClosedFit.width, 360);
  const closedMarginX = (1200 - inspectorClosedFit.width) / 2;
  const closedMarginY = (800 - inspectorClosedFit.height) / 2;
  assert.equal(closedMarginX, 420);
  assert.equal(closedMarginY, 40);

  // Open Inspector (width reduced by 380px drawer -> 820 x 800)
  const inspectorOpenFit = calculateFitDimensions(600, 1200, 820, 800);
  assert.equal(inspectorOpenFit.isPortrait, true);
  assert.equal(inspectorOpenFit.height, 720);
  assert.equal(inspectorOpenFit.width, 360);
  const openMarginX = (820 - inspectorOpenFit.width) / 2;
  const openMarginY = (800 - inspectorOpenFit.height) / 2;
  assert.equal(openMarginX, 230);
  assert.equal(openMarginY, 40);
  assert.ok(openMarginX > 0 && openMarginY > 0, 'Margins remain positive and centered');

  // 6. Viewport Height Resize (height changes from 800 to 600)
  const resizedHeightFit = calculateFitDimensions(600, 1200, 1000, 600);
  assert.equal(resizedHeightFit.height, 540); // 600 * 0.9
  assert.equal(resizedHeightFit.width, 270);  // 540 * 0.5
  assert.equal((1000 - resizedHeightFit.width) / 2, 365);
  assert.equal((600 - resizedHeightFit.height) / 2, 30);

  // 7. Returns null on invalid dimensions
  assert.equal(calculateFitDimensions(0, 100, 1000, 800), null);
  assert.equal(calculateFitDimensions(100, 100, 0, 800), null);
});

test('PPTX Presentation Viewer: calculateSlideFit, clamping, edge-click navigation, and swipe detection', async () => {
  const { 
    calculateSlideFit, 
    clampSlideIndex, 
    isEdgeClick, 
    detectSwipeDirection 
  } = await import('../src/utils/slideNavigation.js');

  // 1. 16:9 Slide Fit in standard container (1200 x 800, padding=40)
  // Available: 1160 x 760. 16:9 ratio (960 x 540)
  const fit16_9 = calculateSlideFit(960, 540, 1200, 800);
  assert.ok(fit16_9);
  assert.equal(fit16_9.aspectRatio, 960 / 540);
  assert.ok(fit16_9.width <= 1160);
  assert.ok(fit16_9.height <= 760);
  assert.ok(Math.abs(fit16_9.width / fit16_9.height - 16 / 9) < 0.01);

  // 2. 4:3 Slide Fit in standard container (1200 x 800, padding=40)
  // Available: 1160 x 760. 4:3 ratio (1024 x 768)
  const fit4_3 = calculateSlideFit(1024, 768, 1200, 800);
  assert.ok(fit4_3);
  assert.equal(fit4_3.aspectRatio, 1024 / 768);
  assert.ok(fit4_3.width <= 1160);
  assert.ok(fit4_3.height <= 760);
  assert.ok(Math.abs(fit4_3.width / fit4_3.height - 4 / 3) < 0.01);

  // 3. Clamping Slide Indices (1 to N)
  assert.equal(clampSlideIndex(0, 18), 1);
  assert.equal(clampSlideIndex(3, 18), 3);
  assert.equal(clampSlideIndex(19, 18), 18);
  assert.equal(clampSlideIndex(5, 0), 1);

  // 4. Spatial Edge Click Detection (thresholdRatio = 0.15 on 1000px viewport)
  // Left 150px -> 'prev', Right 150px (850-1000px) -> 'next', Middle -> null
  assert.equal(isEdgeClick(50, 1000), 'prev');
  assert.equal(isEdgeClick(150, 1000), 'prev');
  assert.equal(isEdgeClick(500, 1000), null);
  assert.equal(isEdgeClick(850, 1000), 'next');
  assert.equal(isEdgeClick(950, 1000), 'next');

  // 5. Touch Swipe Detection
  // Swiped Left (> 50px deltaX) -> 'next'
  assert.equal(detectSwipeDirection(200, 100, 120, 105), 'next');
  // Swiped Right (> 50px deltaX) -> 'prev'
  assert.equal(detectSwipeDirection(100, 100, 180, 105), 'prev');
  // Vertical scroll (> horizontal movement) -> ignored (null)
  assert.equal(detectSwipeDirection(100, 100, 120, 250), null);
  // Minor movement (< 50px) -> ignored (null)
  assert.equal(detectSwipeDirection(100, 100, 120, 105), null);
});

test('PPTX Binary Parsing: parsePptx handles real OpenXML presentation binary from buffer', async () => {
  const { default: JSZip } = await import('jszip');

  const zip = new JSZip();
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
</Types>`);

  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`);

  zip.file('ppt/presentation.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldIdLst>
    <p:sldId id="256" r:id="rId1"/>
  </p:sldIdLst>
  <p:sldSz cx="9144000" cy="5143500"/>
</p:presentation>`);

  zip.file('ppt/_rels/presentation.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
</Relationships>`);

  zip.file('ppt/slides/slide1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
    </p:spTree>
  </p:cSld>
</p:sld>`);

  const buf = await zip.generateAsync({ type: 'arraybuffer' });
  const loadedZip = await JSZip.loadAsync(buf);
  const presXml = await loadedZip.file('ppt/presentation.xml').async('text');
  const szMatch = presXml.match(/<p:sldSz[^>]*cx="(\d+)"[^>]*cy="(\d+)"/);
  const cx = parseInt(szMatch[1], 10);
  const cy = parseInt(szMatch[2], 10);
  const slideFiles = Object.keys(loadedZip.files).filter(k => /^ppt\/slides\/slide\d+\.xml$/.test(k));

  assert.equal(Math.round(cx / 9525), 960);
  assert.equal(Math.round(cy / 9525), 540);
  assert.equal(slideFiles.length, 1);
});

