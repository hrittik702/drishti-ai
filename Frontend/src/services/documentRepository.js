import { openDatabase, saveLocal, loadLocal, blobMemoryCache } from './db.js';
import { computeSHA256, hashFileSHA256 } from './cryptoService.js';
import { detectMimeType, ensureRenderableBlob } from '../utils/fileTypes.js';

const STORAGE_KEY = 'caseguard_documents';

export const DocumentRepository = {
  async getAllDocuments() {
    const localDocs = loadLocal(STORAGE_KEY, []);
    try {
      const db = await openDatabase();
      return new Promise((resolve) => {
        const tx = db.transaction('documents', 'readonly');
        const store = tx.objectStore('documents');
        const request = store.getAll();

        request.onsuccess = () => {
          let docs = request.result || [];
          if (docs.length === 0 && localDocs.length > 0) {
            this.restoreLocalBackup(localDocs).catch(console.warn);
            docs = localDocs;
          } else if (docs.length > 0) {
            saveLocal(STORAGE_KEY, docs);
          }
          docs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          resolve(docs);
        };
        request.onerror = () => {
          console.warn('Error reading documents from IndexedDB, using local storage backup:', request.error);
          resolve(localDocs);
        };
      });
    } catch (err) {
      console.warn('IndexedDB unavailable, falling back to local storage for documents:', err);
      return localDocs;
    }
  },

  async restoreLocalBackup(docs) {
    try {
      const db = await openDatabase();
      const tx = db.transaction('documents', 'readwrite');
      const store = tx.objectStore('documents');
      for (const d of docs) {
        store.put(d);
      }
    } catch (e) {
      console.warn('Failed to restore documents to IndexedDB:', e);
    }
  },

  async getDocumentsByCase(caseId) {
    const all = await this.getAllDocuments();
    return all.filter(d => d.caseId === caseId);
  },

  async getDocumentById(id) {
    try {
      const db = await openDatabase();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('documents', 'readonly');
        const store = tx.objectStore('documents');
        const request = store.get(id);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      const localDocs = loadLocal(STORAGE_KEY, []);
      return localDocs.find(d => d.id === id) || null;
    }
  },

  async findDuplicateDocument(caseId, hash, filename = '') {
    const docs = await this.getDocumentsByCase(caseId);
    
    // 1. Exact hash duplicate
    if (hash) {
      const exactMatch = docs.find(d => (d.storedHash === hash) || (d.hash === hash));
      if (exactMatch) {
        return {
          isDuplicate: true,
          type: 'EXACT_HASH',
          existingDoc: exactMatch,
          message: `A document with this identical SHA-256 fingerprint already exists in this case: "${exactMatch.name}".`
        };
      }
    }
    
    // 2. Same filename duplicate
    if (filename) {
      const cleanTarget = filename.trim().toLowerCase();
      const nameMatch = docs.find(d => d.name.trim().toLowerCase() === cleanTarget);
      if (nameMatch) {
        return {
          isDuplicate: true,
          type: 'SAME_NAME',
          existingDoc: nameMatch,
          message: `A document named "${nameMatch.name}" already exists in this case.`
        };
      }
    }

    return { isDuplicate: false };
  },

  async createDocumentWithFile(metadata, fileBlob, user, onProgress) {
    if (!fileBlob || !(fileBlob instanceof Blob)) {
      throw new Error('Valid file binary payload is required.');
    }

    const docId = `DOC-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
    const versionId = `VER-${Date.now().toString(36).toUpperCase()}-1`;
    const now = new Date().toISOString();

    // 1. Calculate genuine SHA-256 from actual file bytes with streaming & fallback
    const hash = await hashFileSHA256(fileBlob, onProgress);

    const filename = metadata.name || fileBlob.name || 'Untitled Document';
    const mimeType = detectMimeType(fileBlob, filename);

    // Preserve original fileBlob with exact MIME type (ensuring images have proper browser-renderable type)
    const storedBlob = (fileBlob.type && fileBlob.type === mimeType) 
      ? fileBlob 
      : new Blob([fileBlob], { type: mimeType });

    const versionRecord = {
      id: versionId,
      documentId: docId,
      versionNumber: 1,
      versionLabel: 'V1',
      fileBlob: storedBlob,
      size: storedBlob.size,
      mimeType,
      hash,
      createdAt: now,
      createdBy: user?.name || 'Authorized Officer',
      changeNote: 'Initial upload and cryptographic anchoring.'
    };

    const isImage = mimeType.startsWith('image/');
    const isPdf = mimeType === 'application/pdf';
    const isDocx = mimeType.includes('wordprocessingml');
    const ocrApplicable = isImage || isPdf || isDocx;

    const docRecord = {
      id: docId,
      caseId: metadata.caseId,
      name: filename,
      mimeType,
      size: storedBlob.size,
      classification: metadata.classification || 'Confidential',
      category: metadata.category || 'Evidence Record',
      tags: metadata.tags || [],
      currentVersion: 'V1',
      currentVersionId: versionId,
      storedHash: hash,
      hash,
      originalBlob: storedBlob, // kept for tamper-restore demonstration
      ocr: {
        status: ocrApplicable ? 'AVAILABLE' : 'NOT_APPLICABLE',
        text: '',
        language: 'eng',
        processedAt: null,
        pageCount: 0,
        error: null
      },
      createdAt: now,
      updatedAt: now,
      createdBy: user?.name || 'Authorized Officer',
      isTampered: false
    };

    // Store in IndexedDB atomically
    // Cache blob in memory for instant zero-latency retrieval
    blobMemoryCache.set(versionId, storedBlob);
    blobMemoryCache.set(docId, storedBlob);
    blobMemoryCache.set(`pristine_${docId}`, storedBlob);
    blobMemoryCache.set(`pristine_${versionId}`, storedBlob);

    // Immediately persist metadata to localStorage for zero data loss on immediate refresh
    const localDocs = loadLocal(STORAGE_KEY, []);
    saveLocal(STORAGE_KEY, [docRecord, ...localDocs.filter(d => d.id !== docId)]);

    // Store in IndexedDB atomically if available
    try {
      const db = await openDatabase();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(['documents', 'versions'], 'readwrite');
        const docStore = tx.objectStore('documents');
        const verStore = tx.objectStore('versions');

        docStore.put(docRecord);
        verStore.put(versionRecord);

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed.'));
      });
    } catch (err) {
      console.warn('IndexedDB write warning during document creation, preserved in memory & local storage:', err);
    }

    return docRecord;
  },

  async updateDocumentOcr(documentId, ocrData) {
    const localDocs = loadLocal(STORAGE_KEY, []);
    const updatedLocal = localDocs.map(d => {
      if (d.id === documentId) {
        return {
          ...d,
          ocr: {
            ...(d.ocr || {}),
            ...ocrData,
            processedAt: ocrData.processedAt || new Date().toISOString()
          },
          updatedAt: new Date().toISOString()
        };
      }
      return d;
    });
    saveLocal(STORAGE_KEY, updatedLocal);

    try {
      const db = await openDatabase();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('documents', 'readwrite');
        const store = tx.objectStore('documents');
        const getReq = store.get(documentId);

        getReq.onsuccess = () => {
          const doc = getReq.result || localDocs.find(d => d.id === documentId);
          if (!doc) {
            return resolve(null);
          }
          const updated = {
            ...doc,
            ocr: {
              ...(doc.ocr || {}),
              ...ocrData,
              processedAt: ocrData.processedAt || new Date().toISOString()
            },
            updatedAt: new Date().toISOString()
          };
          store.put(updated);
          tx.oncomplete = () => resolve(updated);
        };
        getReq.onerror = () => reject(getReq.error);
      });
    } catch (err) {
      return updatedLocal.find(d => d.id === documentId) || null;
    }
  },

  async addVersion(documentId, fileBlob, user, changeNote, onProgress) {
    if (!fileBlob || !(fileBlob instanceof Blob)) {
      throw new Error('Valid file binary payload is required.');
    }

    const doc = await this.getDocumentById(documentId);
    if (!doc) throw new Error('Document not found.');

    const versions = await this.getDocumentVersions(documentId);
    const nextVerNumber = versions.length + 1;
    const versionLabel = `V${nextVerNumber}`;
    const versionId = `VER-${Date.now().toString(36).toUpperCase()}-${nextVerNumber}`;
    const now = new Date().toISOString();

    const hash = await hashFileSHA256(fileBlob, onProgress);

    const filename = fileBlob.name || doc.name;
    const mimeType = detectMimeType(fileBlob, filename);
    const storedBlob = (fileBlob.type && fileBlob.type === mimeType) 
      ? fileBlob 
      : new Blob([fileBlob], { type: mimeType });

    const versionRecord = {
      id: versionId,
      documentId,
      versionNumber: nextVerNumber,
      versionLabel,
      fileBlob: storedBlob,
      size: storedBlob.size,
      mimeType,
      hash,
      createdAt: now,
      createdBy: user?.name || 'Authorized Officer',
      changeNote: changeNote || `Revision ${versionLabel} uploaded.`
    };

    const isImage = mimeType.startsWith('image/');
    const isPdf = mimeType === 'application/pdf';
    const isDocx = mimeType.includes('wordprocessingml');
    const ocrApplicable = isImage || isPdf || isDocx;

    const updatedDoc = {
      ...doc,
      currentVersion: versionLabel,
      currentVersionId: versionId,
      size: storedBlob.size,
      mimeType,
      storedHash: hash,
      hash,
      ocr: {
        status: ocrApplicable ? 'AVAILABLE' : 'NOT_APPLICABLE',
        text: '',
        language: 'eng',
        processedAt: null,
        pageCount: 0,
        error: null
      },
      updatedAt: now,
      isTampered: false
    };

    // Cache blob in memory
    blobMemoryCache.set(versionId, storedBlob);
    blobMemoryCache.set(documentId, storedBlob);
    blobMemoryCache.set(`pristine_${documentId}`, storedBlob);
    blobMemoryCache.set(`pristine_${versionId}`, storedBlob);

    // Update in localStorage
    const localDocs = loadLocal(STORAGE_KEY, []);
    saveLocal(STORAGE_KEY, localDocs.map(d => d.id === documentId ? updatedDoc : d));

    // Store in IndexedDB atomically if available
    try {
      const db = await openDatabase();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(['documents', 'versions'], 'readwrite');
        tx.objectStore('versions').put(versionRecord);
        tx.objectStore('documents').put(updatedDoc);

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error('Failed to record version.'));
      });
    } catch (err) {
      console.warn('IndexedDB write warning during addVersion, preserved in memory & local storage:', err);
    }

    return updatedDoc;
  },

  async getDocumentVersions(documentId) {
    try {
      const db = await openDatabase();
      return new Promise((resolve) => {
        const tx = db.transaction('versions', 'readonly');
        const store = tx.objectStore('versions');
        const request = store.getAll();

        request.onsuccess = () => {
          const all = request.result || [];
          const filtered = all.filter(v => v.documentId === documentId);
          filtered.sort((a, b) => b.versionNumber - a.versionNumber);
          resolve(filtered);
        };
        request.onerror = () => resolve([]);
      });
    } catch (err) {
      return [];
    }
  },

  async getVersionBlob(versionId, documentId = null) {
    if (!versionId && !documentId) return null;
    if (versionId && blobMemoryCache.has(versionId)) {
      return blobMemoryCache.get(versionId);
    }
    if (documentId && blobMemoryCache.has(documentId)) {
      return blobMemoryCache.get(documentId);
    }
    try {
      const db = await openDatabase();
      return new Promise((resolve) => {
        const tx = db.transaction(['versions', 'documents'], 'readonly');
        const verStore = tx.objectStore('versions');
        const docStore = tx.objectStore('documents');

        if (versionId) {
          const request = verStore.get(versionId);
          request.onsuccess = () => {
            if (request.result && request.result.fileBlob) {
              const b = ensureRenderableBlob(request.result.fileBlob, '', request.result.mimeType);
              blobMemoryCache.set(versionId, b);
              if (documentId) blobMemoryCache.set(documentId, b);
              return resolve(b);
            }
            // Fallback to documents store if version record missing
            if (documentId) {
              const docReq = docStore.get(documentId);
              docReq.onsuccess = () => {
                const doc = docReq.result;
                const raw = doc?.originalBlob || doc?.fileBlob || null;
                const b = raw ? ensureRenderableBlob(raw, doc?.name, doc?.mimeType) : null;
                if (b) {
                  blobMemoryCache.set(versionId, b);
                  blobMemoryCache.set(documentId, b);
                }
                resolve(b);
              };
              docReq.onerror = () => resolve(null);
            } else {
              resolve(null);
            }
          };
          request.onerror = () => {
            if (documentId) {
              const docReq = docStore.get(documentId);
              docReq.onsuccess = () => {
                const doc = docReq.result;
                const raw = doc?.originalBlob || doc?.fileBlob || null;
                const b = raw ? ensureRenderableBlob(raw, doc?.name, doc?.mimeType) : null;
                resolve(b);
              };
              docReq.onerror = () => resolve(null);
            } else {
              resolve(null);
            }
          };
        } else if (documentId) {
          const docReq = docStore.get(documentId);
          docReq.onsuccess = () => {
            const doc = docReq.result;
            const raw = doc?.originalBlob || doc?.fileBlob || null;
            const b = raw ? ensureRenderableBlob(raw, doc?.name, doc?.mimeType) : null;
            if (b) blobMemoryCache.set(documentId, b);
            resolve(b);
          };
          docReq.onerror = () => resolve(null);
        } else {
          resolve(null);
        }
      });
    } catch (err) {
      console.warn('Failed to retrieve version blob:', err);
      return null;
    }
  },

  async verifyDocumentIntegrity(documentId, actorInfo = null) {
    const doc = await this.getDocumentById(documentId);
    if (!doc) throw new Error('Document not found.');

    const blob = await this.getVersionBlob(doc.currentVersionId, doc.id);
    if (!blob) throw new Error('Version file blob not found in storage.');

    // Calculate live hash from the actual stored bytes
    const calculatedHash = await computeSHA256(blob);
    const valid = (calculatedHash === doc.storedHash) && !doc.isTampered;
    const now = new Date().toISOString();

    const verifiedBy = actorInfo 
      ? (actorInfo.name ? `${actorInfo.name} (${actorInfo.designation || actorInfo.role?.name || actorInfo.role || 'Officer'})` : String(actorInfo))
      : (doc.verifiedBy || 'Security Verification System');

    const updatedDoc = {
      ...doc,
      lastVerified: now,
      verifiedBy,
      integrityStatus: valid ? 'VERIFIED' : 'MISMATCH'
    };

    // Update in local storage
    const localDocs = loadLocal(STORAGE_KEY, []);
    saveLocal(STORAGE_KEY, localDocs.map(d => d.id === documentId ? updatedDoc : d));

    // Update in IndexedDB atomically if available
    try {
      const db = await openDatabase();
      await new Promise((resolve, reject) => {
        const tx = db.transaction('documents', 'readwrite');
        tx.objectStore('documents').put(updatedDoc);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      // Graceful fallback to memory/localStorage
    }

    return {
      valid,
      documentName: doc.name,
      currentVersion: doc.currentVersion,
      storedHash: doc.storedHash,
      calculatedHash,
      isTampered: doc.isTampered,
      lastVerified: now,
      verifiedBy,
      document: updatedDoc
    };
  },

  async simulateDocumentTamper(documentId) {
    const doc = await this.getDocumentById(documentId);
    if (!doc) throw new Error('Document not found.');

    const currentBlob = await this.getVersionBlob(doc.currentVersionId, doc.id);
    if (!currentBlob) throw new Error('Version blob not found.');

    if (!doc.isTampered) {
      if (!blobMemoryCache.has(`pristine_${doc.id}`)) {
        blobMemoryCache.set(`pristine_${doc.id}`, currentBlob);
      }
      if (doc.currentVersionId && !blobMemoryCache.has(`pristine_${doc.currentVersionId}`)) {
        blobMemoryCache.set(`pristine_${doc.currentVersionId}`, currentBlob);
      }
    }

    // Deliberately corrupt 1 byte of the blob for demonstration
    const buffer = await currentBlob.arrayBuffer();
    const corruptedArray = new Uint8Array(buffer.byteLength + 1);
    corruptedArray.set(new Uint8Array(buffer));
    corruptedArray[corruptedArray.length - 1] = 0xAA; // append corrupted byte

    const corruptedBlob = new Blob([corruptedArray], { type: currentBlob.type });
    const corruptedHash = await computeSHA256(corruptedBlob);

    // Update memory cache
    blobMemoryCache.set(doc.currentVersionId, corruptedBlob);
    blobMemoryCache.set(doc.id, corruptedBlob);

    const updatedDoc = {
      ...doc,
      isTampered: true,
      tamperedHash: corruptedHash,
      integrityStatus: 'MISMATCH'
    };

    // Update localStorage
    const localDocs = loadLocal(STORAGE_KEY, []);
    saveLocal(STORAGE_KEY, localDocs.map(d => d.id === documentId ? updatedDoc : d));

    // Try IndexedDB if available
    try {
      const db = await openDatabase();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(['documents', 'versions'], 'readwrite');
        const verStore = tx.objectStore('versions');
        const req = verStore.get(doc.currentVersionId);
        req.onsuccess = (e) => {
          const ver = e.target.result;
          if (ver) {
            ver.fileBlob = corruptedBlob;
            verStore.put(ver);
          }
        };
        const docStore = tx.objectStore('documents');
        docStore.put(updatedDoc);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      // Graceful fallback to memory/localStorage
    }

    return updatedDoc;
  },

  async restoreDocument(documentId) {
    const doc = await this.getDocumentById(documentId);
    if (!doc) throw new Error('Cannot restore document: document not found.');

    let rawOriginal = (doc.originalBlob instanceof Blob ? doc.originalBlob : null)
      || blobMemoryCache.get(`pristine_${documentId}`)
      || (doc.currentVersionId ? blobMemoryCache.get(`pristine_${doc.currentVersionId}`) : null);

    if (!rawOriginal) {
      try {
        const db = await openDatabase();
        rawOriginal = await new Promise((resolve) => {
          const tx = db.transaction(['documents'], 'readonly');
          const req = tx.objectStore('documents').get(documentId);
          req.onsuccess = () => {
            const d = req.result;
            if (d && d.originalBlob instanceof Blob) resolve(d.originalBlob);
            else resolve(null);
          };
          req.onerror = () => resolve(null);
        });
      } catch (e) {}
    }

    if (!rawOriginal) throw new Error('Cannot restore document: pristine original blob not found.');

    const restoredBlob = ensureRenderableBlob(rawOriginal, doc.name, doc.mimeType);

    // Update memory cache
    blobMemoryCache.set(doc.currentVersionId, restoredBlob);
    blobMemoryCache.set(doc.id, restoredBlob);

    const updatedDoc = {
      ...doc,
      isTampered: false,
      tamperedHash: null,
      integrityStatus: 'VERIFIED',
      originalBlob: restoredBlob
    };

    // Update localStorage
    const localDocs = loadLocal(STORAGE_KEY, []);
    saveLocal(STORAGE_KEY, localDocs.map(d => d.id === documentId ? updatedDoc : d));

    // Try IndexedDB if available
    try {
      const db = await openDatabase();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(['documents', 'versions'], 'readwrite');
        const verStore = tx.objectStore('versions');
        const req = verStore.get(doc.currentVersionId);
        req.onsuccess = (e) => {
          const ver = e.target.result;
          if (ver) {
            ver.fileBlob = restoredBlob;
            verStore.put(ver);
          }
        };
        const docStore = tx.objectStore('documents');
        docStore.put(updatedDoc);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      // Graceful fallback to memory/localStorage
    }

    return updatedDoc;
  },

  async deleteDocument(id) {
    const localDocs = loadLocal(STORAGE_KEY, []);
    saveLocal(STORAGE_KEY, localDocs.filter(d => d.id !== id));
    blobMemoryCache.delete(id);
    blobMemoryCache.delete(`pristine_${id}`);

    try {
      const db = await openDatabase();
      const versions = await this.getDocumentVersions(id);

      return new Promise((resolve) => {
        const tx = db.transaction(['documents', 'versions'], 'readwrite');
        const docStore = tx.objectStore('documents');
        const verStore = tx.objectStore('versions');

        docStore.delete(id);
        versions.forEach(v => {
          blobMemoryCache.delete(v.id);
          blobMemoryCache.delete(`pristine_${v.id}`);
          verStore.delete(v.id);
        });

        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(true);
      });
    } catch (err) {
      return true;
    }
  }
};
