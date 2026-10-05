import { openDatabase, saveLocal, loadLocal } from './db.js';

const STORAGE_KEY = 'caseguard_cases';

export const CaseRepository = {
  async getAllCases() {
    const localCases = loadLocal(STORAGE_KEY, []);
    try {
      const db = await openDatabase();
      return new Promise((resolve) => {
        const tx = db.transaction('cases', 'readonly');
        const store = tx.objectStore('cases');
        const request = store.getAll();

        request.onsuccess = () => {
          let cases = request.result || [];
          if (cases.length === 0 && localCases.length > 0) {
            // Restore local backup into IndexedDB
            this.restoreLocalBackup(localCases).catch(console.warn);
            cases = localCases;
          } else if (cases.length > 0) {
            saveLocal(STORAGE_KEY, cases);
          }
          cases.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          resolve(cases);
        };
        request.onerror = () => {
          console.warn('Error reading cases from IndexedDB, using local storage backup:', request.error);
          resolve(localCases);
        };
      });
    } catch (err) {
      console.warn('IndexedDB unavailable, falling back to local storage for cases:', err);
      return localCases;
    }
  },

  async restoreLocalBackup(cases) {
    try {
      const db = await openDatabase();
      const tx = db.transaction('cases', 'readwrite');
      const store = tx.objectStore('cases');
      for (const c of cases) {
        store.put(c);
      }
    } catch (e) {
      console.warn('Failed to restore cases to IndexedDB:', e);
    }
  },

  async getCaseById(id) {
    try {
      const db = await openDatabase();
      return new Promise((resolve) => {
        const tx = db.transaction('cases', 'readonly');
        const store = tx.objectStore('cases');
        const request = store.get(id);

        request.onsuccess = () => {
          if (request.result) return resolve(request.result);
          const localCases = loadLocal(STORAGE_KEY, []);
          resolve(localCases.find(c => c.id === id || c.caseNumber === id) || null);
        };
        request.onerror = () => {
          const localCases = loadLocal(STORAGE_KEY, []);
          resolve(localCases.find(c => c.id === id || c.caseNumber === id) || null);
        };
      });
    } catch (err) {
      const localCases = loadLocal(STORAGE_KEY, []);
      return localCases.find(c => c.id === id || c.caseNumber === id) || null;
    }
  },

  async createCase(caseData) {
    const newCase = {
      id: caseData.id || `CASE-${Date.now().toString(36).toUpperCase()}`,
      caseNumber: caseData.caseNumber.trim(),
      title: caseData.title.trim(),
      type: caseData.type || 'Investigation',
      description: caseData.description || '',
      priority: caseData.priority || 'Medium',
      status: caseData.status || 'Active',
      createdAt: caseData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Immediately persist to localStorage for zero data loss on immediate refresh
    const localCases = loadLocal(STORAGE_KEY, []);
    saveLocal(STORAGE_KEY, [newCase, ...localCases.filter(c => c.id !== newCase.id && c.caseNumber !== newCase.caseNumber)]);

    try {
      const db = await openDatabase();
      return new Promise((resolve) => {
        const tx = db.transaction('cases', 'readwrite');
        const store = tx.objectStore('cases');
        store.put(newCase);

        tx.oncomplete = () => resolve(newCase);
        tx.onerror = () => {
          console.warn('IndexedDB write error for case, localStorage preserved:', tx.error);
          resolve(newCase);
        };
      });
    } catch (err) {
      console.warn('IndexedDB unavailable during createCase, preserved in localStorage:', err);
      return newCase;
    }
  },

  async updateCase(id, updates) {
    const localCases = loadLocal(STORAGE_KEY, []);
    const updatedLocal = localCases.map(c => c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c);
    saveLocal(STORAGE_KEY, updatedLocal);

    try {
      const db = await openDatabase();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('cases', 'readwrite');
        const store = tx.objectStore('cases');
        const getReq = store.get(id);

        getReq.onsuccess = () => {
          const existing = getReq.result || localCases.find(c => c.id === id);
          if (!existing) {
            return resolve(null);
          }
          const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
          store.put(updated);
          tx.oncomplete = () => resolve(updated);
        };
        getReq.onerror = () => reject(getReq.error);
      });
    } catch (err) {
      return updatedLocal.find(c => c.id === id) || null;
    }
  },

  async deleteCase(id) {
    const localCases = loadLocal(STORAGE_KEY, []);
    saveLocal(STORAGE_KEY, localCases.filter(c => c.id !== id));

    try {
      const db = await openDatabase();
      return new Promise((resolve) => {
        const tx = db.transaction('cases', 'readwrite');
        const store = tx.objectStore('cases');
        store.delete(id);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(true);
      });
    } catch (err) {
      return true;
    }
  }
};
