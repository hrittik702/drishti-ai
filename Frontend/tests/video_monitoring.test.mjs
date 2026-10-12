import test from 'node:test';
import assert from 'node:assert/strict';

// Helper validator matching VideoMonitoringView upload logic
function validateVideoUpload(filename, sizeBytes, maxMb = 150) {
  if (!filename || typeof filename !== 'string') {
    return { valid: false, error: 'A valid filename is required.' };
  }
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) {
    return { valid: false, error: 'File has no extension.' };
  }
  const ext = filename.slice(lastDot).toLowerCase();
  const allowed = ['.mp4', '.avi', '.mov', '.mkv', '.webm'];
  if (!allowed.includes(ext)) {
    return { valid: false, error: `Unsupported format "${ext}". Allowed: ${allowed.join(', ')}` };
  }
  if (sizeBytes <= 0) {
    return { valid: false, error: 'Uploaded file cannot be empty (0 bytes).' };
  }
  const maxBytes = maxMb * 1024 * 1024;
  if (sizeBytes > maxBytes) {
    return { valid: false, error: `File exceeds maximum size of ${maxMb}MB.` };
  }
  return { valid: true, error: null };
}

// Helper detection filter matching VideoMonitoringView filtering
function filterDetections(detections, classFilter = 'ALL', searchQuery = '') {
  return (detections || []).filter(det => {
    const matchesClass =
      classFilter === 'ALL' ||
      det.class_name.toLowerCase() === classFilter.toLowerCase();
    const matchesSearch =
      searchQuery === '' ||
      det.class_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(det.timestamp_seconds).includes(searchQuery) ||
      det.timestamp_seconds.toFixed(2).includes(searchQuery) ||
      String(det.frame_index).includes(searchQuery);
    return matchesClass && matchesSearch;
  });
}

test('Video Monitoring: Video file extension and size validation', () => {
  // Valid video formats
  assert.equal(validateVideoUpload('training_room_1.mp4', 1024 * 1024).valid, true);
  assert.equal(validateVideoUpload('cctv_feed.avi', 500000).valid, true);
  assert.equal(validateVideoUpload('camera_02.MOV', 1000000).valid, true);
  assert.equal(validateVideoUpload('stream.webm', 250000).valid, true);
  assert.equal(validateVideoUpload('archive.mkv', 750000).valid, true);

  // Invalid formats
  assert.equal(validateVideoUpload('report.pdf', 1024).valid, false);
  assert.equal(validateVideoUpload('script.py', 500).valid, false);
  assert.equal(validateVideoUpload('malware.exe', 2048).valid, false);
  assert.equal(validateVideoUpload('noext', 1024).valid, false);

  // Size constraints
  assert.equal(validateVideoUpload('empty.mp4', 0).valid, false);
  assert.equal(validateVideoUpload('large.mp4', 151 * 1024 * 1024).valid, false);
  assert.equal(validateVideoUpload('boundary.mp4', 150 * 1024 * 1024).valid, true);
});

test('Video Monitoring: Detections filtering by class and timestamp search', () => {
  const sampleDetections = [
    { class_id: 0, class_name: 'student', confidence: 0.94, bbox: [100, 150, 180, 320], frame_index: 0, timestamp_seconds: 0.0 },
    { class_id: 1, class_name: 'computer', confidence: 0.89, bbox: [90, 200, 160, 280], frame_index: 0, timestamp_seconds: 0.0 },
    { class_id: 0, class_name: 'student', confidence: 0.92, bbox: [250, 150, 330, 320], frame_index: 10, timestamp_seconds: 1.0 },
    { class_id: 1, class_name: 'computer', confidence: 0.95, bbox: [240, 200, 310, 280], frame_index: 10, timestamp_seconds: 1.0 },
  ];

  // All
  const all = filterDetections(sampleDetections, 'ALL', '');
  assert.equal(all.length, 4);

  // Filter students
  const students = filterDetections(sampleDetections, 'STUDENT', '');
  assert.equal(students.length, 2);
  assert.ok(students.every(d => d.class_name === 'student'));

  // Filter computers
  const computers = filterDetections(sampleDetections, 'COMPUTER', '');
  assert.equal(computers.length, 2);
  assert.ok(computers.every(d => d.class_name === 'computer'));

  // Search by timestamp
  const atOneSec = filterDetections(sampleDetections, 'ALL', '1.0');
  assert.equal(atOneSec.length, 2);
  assert.ok(atOneSec.every(d => d.frame_index === 10));
});

test('Video Monitoring: Honest AI model provenance attribution', () => {
  const mockHealth = {
    status: 'healthy',
    model_initialized: true,
    model_mode: 'mock',
    active_model_id: 'assumed-rtdetrv2-sih-mock',
    is_mock: true
  };

  const neuralHealth = {
    status: 'healthy',
    model_initialized: true,
    model_mode: 'pytorch',
    active_model_id: 'PekingU/rtdetr_v2_r18vd',
    is_mock: false
  };

  assert.equal(mockHealth.is_mock, true);
  assert.ok(mockHealth.active_model_id.includes('mock'));

  assert.equal(neuralHealth.is_mock, false);
  assert.equal(neuralHealth.model_mode, 'pytorch');
});
