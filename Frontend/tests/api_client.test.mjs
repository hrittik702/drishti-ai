import test from 'node:test';
import assert from 'node:assert/strict';
import { apiUrl, resolveMediaUrl, API_BASE_URL } from '../src/services/api.js';

test('API Client: apiUrl handles paths correctly', () => {
  // Relative paths
  assert.equal(apiUrl('/api/health'), `${API_BASE_URL}/api/health`);
  assert.equal(apiUrl('api/videos'), `${API_BASE_URL}/api/videos`);

  // Empty path
  assert.equal(apiUrl(''), '');
  assert.equal(apiUrl(null), '');

  // Absolute paths already containing http/https are preserved
  assert.equal(apiUrl('https://custom.backend/api/health'), 'https://custom.backend/api/health');
  assert.equal(apiUrl('http://localhost:8000/api/health'), 'http://localhost:8000/api/health');
});

test('API Client: resolveMediaUrl handles various URL schemes', () => {
  // Empty or null
  assert.equal(resolveMediaUrl(''), '');
  assert.equal(resolveMediaUrl(null), '');

  // Blob URLs
  assert.equal(resolveMediaUrl('blob:http://localhost:5173/uuid-123'), 'blob:http://localhost:5173/uuid-123');

  // Data URLs
  assert.equal(resolveMediaUrl('data:video/mp4;base64,AAAA'), 'data:video/mp4;base64,AAAA');

  // Absolute http/https
  assert.equal(resolveMediaUrl('https://cdn.example.com/video.mp4'), 'https://cdn.example.com/video.mp4');

  // Relative backend endpoints
  assert.equal(resolveMediaUrl('/api/jobs/job-123/output'), `${API_BASE_URL}/api/jobs/job-123/output`);
});
