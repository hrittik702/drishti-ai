/**
 * Centralized API configuration and URL resolver for Drishti AI.
 * Supports Vercel deployment with cross-origin Railway backend
 * as well as local Vite development proxy and Node test environments.
 */

const RAW_API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.VITE_API_BASE_URL) ||
  '';

// Base URL without trailing slash; empty string in development to use Vite proxy
export const API_BASE_URL = RAW_API_BASE
  ? String(RAW_API_BASE).trim().replace(/\/+$/, '')
  : '';

/**
 * Resolve an API endpoint path to a fully qualified URL or proxied path.
 * @param {string} path - API endpoint path (e.g. '/api/health')
 * @returns {string} - Fully qualified or relative API URL
 */
export function apiUrl(path) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
}

/**
 * Resolve media and video download/playback URLs.
 * Ensures video players on Vercel point directly to the backend storage origin.
 * @param {string} url - Relative or absolute media URL
 * @returns {string} - Resolved media URL
 */
export function resolveMediaUrl(url) {
  if (!url) return '';
  if (
    url.startsWith('blob:') ||
    url.startsWith('data:') ||
    url.startsWith('http://') ||
    url.startsWith('https://')
  ) {
    return url;
  }
  return apiUrl(url);
}
