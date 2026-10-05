import { openDatabase, saveLocal, loadLocal } from './db.js';
import { INITIAL_CENTRES } from '../data/initialCentres.js';

const STORAGE_KEY = 'compliance_centres';

export const CentreRepository = {
  async getAllCentres() {
    let localCentres = loadLocal(STORAGE_KEY, null);
    
    // Seed initial demo centres if first load
    if (!localCentres || localCentres.length === 0) {
      localCentres = INITIAL_CENTRES;
      saveLocal(STORAGE_KEY, localCentres);
    }

    try {
      const db = await openDatabase();
      return new Promise((resolve) => {
        const tx = db.transaction('centres', 'readonly');
        const store = tx.objectStore('centres');
        const request = store.getAll();

        request.onsuccess = () => {
          let centres = request.result || [];
          if (centres.length === 0 && localCentres.length > 0) {
            this.restoreLocalBackup(localCentres).catch(console.warn);
            centres = localCentres;
          } else if (centres.length > 0) {
            saveLocal(STORAGE_KEY, centres);
          }
          centres.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
          resolve(centres);
        };
        request.onerror = () => {
          console.warn('Error reading centres from IndexedDB, using local storage backup:', request.error);
          resolve(localCentres);
        };
      });
    } catch (err) {
      console.warn('IndexedDB unavailable, falling back to local storage for centres:', err);
      return localCentres;
    }
  },

  async restoreLocalBackup(centres) {
    try {
      const db = await openDatabase();
      const tx = db.transaction('centres', 'readwrite');
      const store = tx.objectStore('centres');
      for (const c of centres) {
        store.put(c);
      }
    } catch (e) {
      console.warn('Failed to restore centres to IndexedDB:', e);
    }
  },

  async getCentreById(id) {
    if (!id) return null;
    const cleanId = String(id).replace(/^#/, '').trim();

    try {
      const db = await openDatabase();
      return new Promise((resolve) => {
        const tx = db.transaction('centres', 'readonly');
        const store = tx.objectStore('centres');
        const request = store.get(cleanId);

        request.onsuccess = () => {
          if (request.result) return resolve(request.result);
          const localCentres = loadLocal(STORAGE_KEY, INITIAL_CENTRES);
          resolve(localCentres.find(c => c.id === cleanId || c.centreCode === cleanId) || null);
        };
        request.onerror = () => {
          const localCentres = loadLocal(STORAGE_KEY, INITIAL_CENTRES);
          resolve(localCentres.find(c => c.id === cleanId || c.centreCode === cleanId) || null);
        };
      });
    } catch (err) {
      const localCentres = loadLocal(STORAGE_KEY, INITIAL_CENTRES);
      return localCentres.find(c => c.id === cleanId || c.centreCode === cleanId) || null;
    }
  },

  async createCentre(centreData) {
    const newCentre = {
      id: centreData.id || `TC-${Date.now().toString(36).toUpperCase()}`,
      centreCode: centreData.centreCode ? centreData.centreCode.trim() : `TC-${Math.floor(1000 + Math.random() * 9000)}`,
      name: centreData.name.trim(),
      scheme: centreData.scheme || 'PMKVY 4.0',
      sector: centreData.sector || 'General Skill Training',
      location: centreData.location || {
        state: 'National',
        district: 'District Hub',
        address: 'Main Training Campus'
      },
      assignedOfficer: centreData.assignedOfficer || 'Inspector Vikram Rathore',
      complianceStatus: centreData.complianceStatus || 'COMPLIANT',
      priority: centreData.priority || 'Medium',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastVerification: new Date().toISOString(),
      activeBatch: centreData.activeBatch || {
        batchId: `BATCH-${Date.now().toString(36).toUpperCase()}`,
        courseName: 'General Vocational Training',
        enrolledCount: 25,
        startTime: '09:00',
        endTime: '17:00',
        classroom: 'Room 101'
      },
      currentSession: centreData.currentSession || {
        sessionId: `SES-${Math.floor(100 + Math.random() * 900)}`,
        topic: 'Foundational Theory & Practical Orientation',
        trainerName: 'Lead Trainer',
        trainerAadhaarLinked: true,
        trainerPresent: true,
        status: 'In Progress'
      },
      attendance: centreData.attendance || {
        declaredExpected: 25,
        detectedByAI: 25,
        difference: 0,
        discrepancyRate: 0.0,
        status: 'VERIFIED',
        lastChecked: new Date().toISOString(),
        confidence: 0.98
      },
      infrastructure: centreData.infrastructure || {
        totalRequired: 4,
        totalDetected: 4,
        status: 'ADEQUATE',
        items: [
          { name: 'Standard Training Workstations', expected: 25, detected: 25, status: 'VERIFIED', category: 'Classroom Tech' },
          { name: 'Safety First Aid Station', expected: 1, detected: 1, status: 'VERIFIED', category: 'Safety & Compliance' },
          { name: 'Fire Extinguisher', expected: 2, detected: 2, status: 'VERIFIED', category: 'Safety & Compliance' },
          { name: 'Biometric Gateway', expected: 1, detected: 1, status: 'VERIFIED', category: 'Statutory Hardware' }
        ]
      },
      edgeHealth: centreData.edgeHealth || {
        cameraCount: 2,
        camerasOnline: 2,
        camerasOffline: 0,
        edgeDeviceId: `EDGE-JETSON-${Math.floor(100 + Math.random() * 900)}`,
        deviceModel: 'NVIDIA Jetson Orin Nano (8GB)',
        edgeStatus: 'ONLINE',
        fps: 20.0,
        latencyMs: 50,
        cpuUsage: 40,
        gpuUsage: 60,
        temperatureC: 50,
        aiModelVersion: 'YOLOv8-EduCompliance-v2.4',
        lastSync: new Date().toISOString(),
        cameras: [
          { id: 'CAM-01', name: 'Primary Classroom Cam', status: 'ONLINE', resolution: '1080p', fps: 20 },
          { id: 'CAM-02', name: 'Lab Workshop Cam', status: 'ONLINE', resolution: '1080p', fps: 20 }
        ]
      },
      recentAlertsCount: 0
    };

    const localCentres = loadLocal(STORAGE_KEY, INITIAL_CENTRES);
    saveLocal(STORAGE_KEY, [newCentre, ...localCentres.filter(c => c.id !== newCentre.id && c.centreCode !== newCentre.centreCode)]);

    try {
      const db = await openDatabase();
      return new Promise((resolve) => {
        const tx = db.transaction('centres', 'readwrite');
        const store = tx.objectStore('centres');
        store.put(newCentre);

        tx.oncomplete = () => resolve(newCentre);
        tx.onerror = () => {
          console.warn('Error saving centre to IndexedDB, fallback to local memory state:', tx.error);
          resolve(newCentre);
        };
      });
    } catch (err) {
      console.warn('IndexedDB unavailable during centre create, saved to local storage:', err);
      return newCentre;
    }
  },

  async updateCentre(id, updates) {
    const localCentres = loadLocal(STORAGE_KEY, INITIAL_CENTRES);
    const existing = localCentres.find(c => c.id === id || c.centreCode === id);
    if (!existing) return null;

    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    const newCentres = localCentres.map(c => (c.id === id || c.centreCode === id ? updated : c));
    saveLocal(STORAGE_KEY, newCentres);

    try {
      const db = await openDatabase();
      return new Promise((resolve) => {
        const tx = db.transaction('centres', 'readwrite');
        const store = tx.objectStore('centres');
        store.put(updated);
        tx.oncomplete = () => resolve(updated);
        tx.onerror = () => resolve(updated);
      });
    } catch (e) {
      return updated;
    }
  }
};
