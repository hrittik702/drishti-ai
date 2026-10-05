import { openDatabase, saveLocal, loadLocal } from './db.js';
import { INITIAL_COMPLIANCE_EVENTS, INITIAL_EVIDENCE } from '../data/initialCentres.js';

const EVENTS_STORAGE_KEY = 'compliance_events';
const EVIDENCE_STORAGE_KEY = 'compliance_evidence';

export const ComplianceEventRepository = {
  async getAllEvents() {
    let localEvents = loadLocal(EVENTS_STORAGE_KEY, null);
    if (!localEvents || localEvents.length === 0) {
      localEvents = INITIAL_COMPLIANCE_EVENTS;
      saveLocal(EVENTS_STORAGE_KEY, localEvents);
    }

    try {
      const db = await openDatabase();
      return new Promise((resolve) => {
        const tx = db.transaction('compliance_events', 'readonly');
        const store = tx.objectStore('compliance_events');
        const request = store.getAll();

        request.onsuccess = () => {
          let events = request.result || [];
          if (events.length === 0 && localEvents.length > 0) {
            this.restoreLocalBackup(localEvents).catch(console.warn);
            events = localEvents;
          } else if (events.length > 0) {
            saveLocal(EVENTS_STORAGE_KEY, events);
          }
          events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          resolve(events);
        };
        request.onerror = () => resolve(localEvents);
      });
    } catch (err) {
      return localEvents;
    }
  },

  async restoreLocalBackup(events) {
    try {
      const db = await openDatabase();
      const tx = db.transaction('compliance_events', 'readwrite');
      const store = tx.objectStore('compliance_events');
      for (const e of events) {
        store.put(e);
      }
    } catch (e) {
      console.warn('Failed to restore compliance events to IndexedDB:', e);
    }
  },

  async getEventsByCentre(centreId) {
    const all = await this.getAllEvents();
    if (!centreId) return all;
    const clean = String(centreId).replace(/^#/, '');
    return all.filter(e => e.centreId === clean || e.centreCode === clean);
  },

  async logEvent(eventData) {
    const newEvent = {
      id: eventData.id || `EVT-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
      centreId: eventData.centreId || 'TC-UNKNOWN',
      centreCode: eventData.centreCode || eventData.centreId || 'TC-UNKNOWN',
      centreName: eventData.centreName || 'Monitored Centre',
      eventType: eventData.eventType || 'Compliance Check',
      timestamp: eventData.timestamp || new Date().toISOString(),
      severity: eventData.severity || 'Medium',
      status: eventData.status || 'OPEN',
      expectedValue: eventData.expectedValue || 'N/A',
      detectedValue: eventData.detectedValue || 'N/A',
      discrepancy: eventData.discrepancy || 'N/A',
      confidence: eventData.confidence != null ? eventData.confidence : 0.95,
      cameraId: eventData.cameraId || 'CAM-01',
      evidenceId: eventData.evidenceId || null,
      details: eventData.details || ''
    };

    const localEvents = loadLocal(EVENTS_STORAGE_KEY, INITIAL_COMPLIANCE_EVENTS);
    saveLocal(EVENTS_STORAGE_KEY, [newEvent, ...localEvents]);

    try {
      const db = await openDatabase();
      return new Promise((resolve) => {
        const tx = db.transaction('compliance_events', 'readwrite');
        const store = tx.objectStore('compliance_events');
        store.put(newEvent);
        tx.oncomplete = () => resolve(newEvent);
        tx.onerror = () => resolve(newEvent);
      });
    } catch (e) {
      return newEvent;
    }
  },

  async updateEventStatus(eventId, newStatus) {
    const all = loadLocal(EVENTS_STORAGE_KEY, INITIAL_COMPLIANCE_EVENTS);
    const updated = all.map(e => e.id === eventId ? { ...e, status: newStatus } : e);
    saveLocal(EVENTS_STORAGE_KEY, updated);

    try {
      const db = await openDatabase();
      const tx = db.transaction('compliance_events', 'readwrite');
      const store = tx.objectStore('compliance_events');
      const target = updated.find(e => e.id === eventId);
      if (target) store.put(target);
    } catch (_) {}

    return true;
  },

  // Evidence Items
  async getAllEvidence() {
    let localEvidence = loadLocal(EVIDENCE_STORAGE_KEY, null);
    if (!localEvidence || localEvidence.length === 0) {
      localEvidence = INITIAL_EVIDENCE;
      saveLocal(EVIDENCE_STORAGE_KEY, localEvidence);
    }
    return localEvidence;
  },

  async getEvidenceById(id) {
    const all = await this.getAllEvidence();
    return all.find(ev => ev.id === id) || null;
  }
};
