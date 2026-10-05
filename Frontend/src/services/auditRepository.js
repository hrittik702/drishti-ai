import { openDatabase, saveLocal, loadLocal } from './db.js';

const STORAGE_KEY = 'caseguard_audit_events';

export const AuditRepository = {
  async getAllAuditEvents() {
    const localEvents = loadLocal(STORAGE_KEY, []);
    try {
      const db = await openDatabase();
      return new Promise((resolve) => {
        const tx = db.transaction('audit_events', 'readonly');
        const store = tx.objectStore('audit_events');
        const request = store.getAll();

        request.onsuccess = () => {
          let events = request.result || [];
          if (events.length === 0 && localEvents.length > 0) {
            this.restoreLocalBackup(localEvents).catch(console.warn);
            events = localEvents;
          } else if (events.length > 0) {
            saveLocal(STORAGE_KEY, events);
          }
          events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          resolve(events);
        };
        request.onerror = () => {
          console.warn('Error reading audit events from IndexedDB, using local storage backup:', request.error);
          resolve(localEvents);
        };
      });
    } catch (err) {
      console.warn('IndexedDB unavailable, falling back to local storage for audit events:', err);
      return localEvents;
    }
  },

  async restoreLocalBackup(events) {
    try {
      const db = await openDatabase();
      const tx = db.transaction('audit_events', 'readwrite');
      const store = tx.objectStore('audit_events');
      for (const e of events) {
        store.put(e);
      }
    } catch (e) {
      console.warn('Failed to restore audit events to IndexedDB:', e);
    }
  },

  async logAuditEvent({ actor, role, action, targetType, targetId, caseId, result = 'SUCCESS', details }) {
    const event = {
      id: `AUD-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
      timestamp: new Date().toISOString(),
      actorName: actor?.name || actor || 'System User',
      role: role || actor?.role || actor?.designation || 'Investigation Officer',
      badge: actor?.badge || 'N/A',
      action,
      targetType: targetType || 'DOCUMENT',
      targetId: targetId || 'N/A',
      caseId: caseId || 'GENERAL',
      result, // 'SUCCESS' | 'ALERT' | 'DENIED'
      details: details || '',
      ipAddress: '127.0.0.1 (Local Session)'
    };

    // Immediately persist to localStorage
    const localEvents = loadLocal(STORAGE_KEY, []);
    saveLocal(STORAGE_KEY, [event, ...localEvents]);

    try {
      const db = await openDatabase();
      return new Promise((resolve) => {
        const tx = db.transaction('audit_events', 'readwrite');
        const store = tx.objectStore('audit_events');
        store.add(event);

        tx.oncomplete = () => resolve(event);
        tx.onerror = () => resolve(event);
      });
    } catch (err) {
      return event;
    }
  },

  async getAuditEventsByCase(caseId) {
    const all = await this.getAllAuditEvents();
    return all.filter(e => e.caseId === caseId);
  },

  async getAuditEventsByTarget(targetId) {
    const all = await this.getAllAuditEvents();
    return all.filter(e => e.targetId === targetId);
  },

  async clearAuditLogs() {
    saveLocal(STORAGE_KEY, []);
    try {
      const db = await openDatabase();
      return new Promise((resolve) => {
        const tx = db.transaction('audit_events', 'readwrite');
        const store = tx.objectStore('audit_events');
        store.clear();
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(true);
      });
    } catch (err) {
      return true;
    }
  }
};
