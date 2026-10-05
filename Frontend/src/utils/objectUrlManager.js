/**
 * Memory-safe Object URL Manager for CASEGUARD
 * Prevents memory leaks by tracking created Blob URLs and revoking them
 * when documents switch, viewers unmount, or page unloads.
 */

class ObjectUrlManager {
  constructor() {
    this.activeUrls = new Set();
  }

  create(blob) {
    if (!blob || !(blob instanceof Blob)) {
      return null;
    }
    const url = URL.createObjectURL(blob);
    this.activeUrls.add(url);
    return url;
  }

  revoke(url) {
    if (url && this.activeUrls.has(url)) {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {
        console.warn('Error revoking Object URL:', e);
      }
      this.activeUrls.delete(url);
    }
  }

  revokeAll() {
    for (const url of this.activeUrls) {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {
        console.warn('Error revoking Object URL:', e);
      }
    }
    this.activeUrls.clear();
  }
}

export const objectUrlManager = new ObjectUrlManager();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    objectUrlManager.revokeAll();
  });
}
