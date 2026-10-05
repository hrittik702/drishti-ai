// IndexedDB local storage engine for CASEGUARD with dual-persistence sync
const DB_NAME = 'caseguard_db';
const DB_VERSION = 3;

let dbInstance = null;
export const blobMemoryCache = new Map();

const inMemoryStorage = new Map();

function getStorage() {
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage && typeof globalThis.localStorage.getItem === 'function') {
      globalThis.localStorage.getItem('__test__');
      return globalThis.localStorage;
    }
  } catch (_) {
    // In Node.js without --localstorage-file, falls through to in-memory map
  }
  return {
    getItem: (key) => inMemoryStorage.has(key) ? inMemoryStorage.get(key) : null,
    setItem: (key, val) => inMemoryStorage.set(key, String(val)),
    removeItem: (key) => inMemoryStorage.delete(key),
    clear: () => inMemoryStorage.clear()
  };
}

export function saveLocal(key, value) {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`localStorage save warning for ${key}:`, err);
  }
}

export function loadLocal(key, defaultValue = []) {
  const storage = getStorage();
  if (!storage) return defaultValue;
  try {
    const data = storage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch (err) {
    console.warn(`localStorage load warning for ${key}:`, err);
    return defaultValue;
  }
}

export function openDatabase() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // 1. Cases store
      if (!db.objectStoreNames.contains('cases')) {
        const caseStore = db.createObjectStore('cases', { keyPath: 'id' });
        caseStore.createIndex('caseNumber', 'caseNumber', { unique: true });
        caseStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // 2. Documents store
      if (!db.objectStoreNames.contains('documents')) {
        const docStore = db.createObjectStore('documents', { keyPath: 'id' });
        docStore.createIndex('caseId', 'caseId', { unique: false });
        docStore.createIndex('name', 'name', { unique: false });
        docStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // 3. Document Versions store (stores real binary Blobs)
      if (!db.objectStoreNames.contains('versions')) {
        const versionStore = db.createObjectStore('versions', { keyPath: 'id' });
        versionStore.createIndex('documentId', 'documentId', { unique: false });
        versionStore.createIndex('versionNumber', 'versionNumber', { unique: false });
      }

      // 4. Real Audit Events store
      if (!db.objectStoreNames.contains('audit_events')) {
        const auditStore = db.createObjectStore('audit_events', { keyPath: 'id' });
        auditStore.createIndex('timestamp', 'timestamp', { unique: false });
        auditStore.createIndex('caseId', 'caseId', { unique: false });
        auditStore.createIndex('targetId', 'targetId', { unique: false });
      }

      // 5. Training Centres store
      if (!db.objectStoreNames.contains('centres')) {
        const centreStore = db.createObjectStore('centres', { keyPath: 'id' });
        centreStore.createIndex('centreCode', 'centreCode', { unique: true });
        centreStore.createIndex('complianceStatus', 'complianceStatus', { unique: false });
        centreStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // 6. Compliance Events store
      if (!db.objectStoreNames.contains('compliance_events')) {
        const eventStore = db.createObjectStore('compliance_events', { keyPath: 'id' });
        eventStore.createIndex('centreId', 'centreId', { unique: false });
        eventStore.createIndex('timestamp', 'timestamp', { unique: false });
        eventStore.createIndex('severity', 'severity', { unique: false });
      }

      // 7. Evidence store
      if (!db.objectStoreNames.contains('evidence')) {
        const evidenceStore = db.createObjectStore('evidence', { keyPath: 'id' });
        evidenceStore.createIndex('centreId', 'centreId', { unique: false });
        evidenceStore.createIndex('eventId', 'eventId', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      dbInstance.onversionchange = () => {
        try { dbInstance.close(); } catch (_) {}
        dbInstance = null;
      };
      dbInstance.onclose = () => {
        dbInstance = null;
      };
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('IndexedDB open error:', event.target.error);
      reject(new Error('Failed to open IndexedDB: ' + event.target.error));
    };
  });
}

// Generic transaction helper
export async function getStore(storeName, mode = 'readonly') {
  const db = await openDatabase();
  const tx = db.transaction(storeName, mode);
  return tx.objectStore(storeName);
}

