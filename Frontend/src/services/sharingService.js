import { loadLocal, saveLocal } from './db.js';

const STORAGE_KEY = 'caseguard_shares';

export const SharingService = {
  getAllShares() {
    const list = loadLocal(STORAGE_KEY, []);
    return Array.isArray(list) ? list : [];
  },

  getSharesForDocument(documentId) {
    if (!documentId) return [];
    const all = this.getAllShares();
    const now = new Date();
    return all.filter(s => {
      if (s.documentId !== documentId) return false;
      if (s.isRevoked) return false;
      if (s.expiresAt && new Date(s.expiresAt) <= now) return false;
      return true;
    });
  },

  getSharesForUser(userEmailOrId) {
    if (!userEmailOrId) return [];
    const clean = userEmailOrId.trim().toLowerCase();
    const all = this.getAllShares();
    const now = new Date();
    return all.filter(s => {
      if (s.isRevoked) return false;
      if (s.expiresAt && new Date(s.expiresAt) <= now) return false;
      const matchEmail = s.recipientEmail && s.recipientEmail.toLowerCase() === clean;
      const matchId = s.recipientUserId && s.recipientUserId === userEmailOrId;
      return matchEmail || matchId;
    });
  },

  createShare({ document, sharedBy, recipient, permission = 'VIEW', expiryHours = 24, purpose = '' }) {
    if (!document || !recipient) {
      throw new Error('Document and recipient are mandatory for creating an access share grant.');
    }

    const now = new Date();
    let expiresAt = null;
    if (expiryHours && expiryHours > 0) {
      expiresAt = new Date(now.getTime() + expiryHours * 60 * 60 * 1000).toISOString();
    }

    const shareRecord = {
      id: `SHR-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
      documentId: document.id,
      caseId: document.caseId || 'GENERAL',
      documentName: document.name || 'Untitled Document',
      documentHash: document.storedHash || document.hash || '',
      sharedBy: {
        id: sharedBy?.id || 'sys-actor',
        name: sharedBy?.name || 'Authorized Officer',
        role: sharedBy?.designation || sharedBy?.role?.name || sharedBy?.role || 'Investigation Officer',
        badge: sharedBy?.badge || 'N/A'
      },
      recipientUserId: recipient.id || '',
      recipientEmail: recipient.email || '',
      recipientName: recipient.name || recipient.email || 'Authorized Recipient',
      recipientRole: recipient.designation || recipient.role?.name || recipient.role || 'Officer',
      permission: permission.toUpperCase() === 'DOWNLOAD' ? 'DOWNLOAD' : 'VIEW', // 'VIEW' or 'DOWNLOAD'
      purpose: purpose.trim() || 'Official investigation & judicial collaboration',
      createdAt: now.toISOString(),
      expiresAt,
      isRevoked: false
    };

    const existing = this.getAllShares();
    // Replace if there is already an active share for this exact doc and user
    const filtered = existing.filter(s => !(s.documentId === shareRecord.documentId && s.recipientEmail.toLowerCase() === shareRecord.recipientEmail.toLowerCase() && !s.isRevoked));
    const updated = [shareRecord, ...filtered];
    saveLocal(STORAGE_KEY, updated);
    return shareRecord;
  },

  revokeShare(shareId, revokedBy) {
    const existing = this.getAllShares();
    let revokedTarget = null;
    const updated = existing.map(s => {
      if (s.id === shareId) {
        revokedTarget = { ...s, isRevoked: true, revokedAt: new Date().toISOString(), revokedBy: revokedBy?.name || 'Authorized Officer' };
        return revokedTarget;
      }
      return s;
    });
    saveLocal(STORAGE_KEY, updated);
    return revokedTarget;
  },

  canUserAccessCase(user, caseItemOrNumber) {
    if (!user) return false;
    // System Administrator has universal access
    if (user.role?.id === 'administrator' || user.assignedCases?.includes('*') || user.assignedCentres?.includes('*')) {
      return true;
    }

    const targetId = typeof caseItemOrNumber === 'string'
      ? caseItemOrNumber
      : (caseItemOrNumber?.caseNumber || caseItemOrNumber?.centreCode || caseItemOrNumber?.id);

    if (!targetId) return false;

    // Check if user has this case in their assigned cases list
    if (Array.isArray(user.assignedCases) && user.assignedCases.includes(targetId)) {
      return true;
    }

    // Check if user has this centre in their assigned centres list
    if (Array.isArray(user.assignedCentres) && user.assignedCentres.includes(targetId)) {
      return true;
    }

    return false;
  },

  canUserAccessCentre(user, centreItemOrCode) {
    return this.canUserAccessCase(user, centreItemOrCode);
  },

  checkDocumentAccess(user, document, caseItem = null) {
    if (!user) {
      return {
        allowed: false,
        reason: 'UNAUTHENTICATED',
        message: 'No active authenticated session detected. Please sign in to the CaseGuard portal.'
      };
    }

    // 1. System Administrator
    if (user.role?.id === 'administrator' || user.assignedCases?.includes('*')) {
      return {
        allowed: true,
        permissions: ['VIEW', 'DOWNLOAD', 'UPLOAD', 'VERIFY', 'EDIT_METADATA', 'DELETE'],
        isSuperuser: true
      };
    }

    if (!document) {
      return { allowed: false, reason: 'NOT_FOUND', message: 'Requested document was not found.' };
    }

    const caseId = document.caseId || caseItem?.caseNumber;
    const hasCaseAccess = this.canUserAccessCase(user, caseId);

    // Check classification clearance first if user has case access
    const clearance = (user.clearance || user.role?.clearance || 'Confidential').toLowerCase();
    const docClass = (document.classification || 'Confidential').toLowerCase();

    // Clearance Hierarchy: Top Secret > Secret > Confidential
    const clearanceWeight = { 'top secret': 3, 'secret': 2, 'confidential': 1 };
    const userClearanceVal = clearanceWeight[clearance] || 1;
    const docClearanceVal = clearanceWeight[docClass] || 1;

    // 2. Case-level assigned access
    if (hasCaseAccess) {
      if (docClearanceVal > userClearanceVal) {
        return {
          allowed: false,
          reason: 'CLEARANCE_INSUFFICIENT',
          message: `PoLP Security Violation: Active officer clearance (${user.clearance || 'Confidential'}) is below the mandatory ${document.classification} threshold required for this docket.`,
          requiredClearance: document.classification,
          userClearance: user.clearance
        };
      }

      const rolePerms = (user.role?.permissions || []).map(p => p.toUpperCase());
      const permissions = [];
      if (rolePerms.includes('VIEW') || rolePerms.includes('DOWNLOAD') || rolePerms.length > 0) permissions.push('VIEW');
      if (rolePerms.includes('DOWNLOAD')) permissions.push('DOWNLOAD');

      return {
        allowed: true,
        permissions,
        isDirectAccess: true
      };
    }

    // 3. Document Sharing Delegation Token
    const userShares = this.getSharesForDocument(document.id).filter(s => {
      const matchEmail = s.recipientEmail && s.recipientEmail.toLowerCase() === (user.email || '').toLowerCase();
      const matchId = s.recipientUserId && s.recipientUserId === user.id;
      return matchEmail || matchId;
    });

    if (userShares.length > 0) {
      const activeShare = userShares[0];
      const permissions = ['VIEW'];
      if (activeShare.permission === 'DOWNLOAD') {
        permissions.push('DOWNLOAD');
      }

      return {
        allowed: true,
        permissions,
        isShared: true,
        share: activeShare
      };
    }

    // 4. Denied: Not assigned to case and no delegation grant
    return {
      allowed: false,
      reason: 'NOT_ASSIGNED_TO_CASE',
      message: `Access Blocked: ${user.name} (${user.designation}) is not assigned to Case ${caseId || 'Dossier'} and has no valid document delegation token.`,
      requiredClearance: document.classification || 'Restricted',
      userClearance: user.clearance
    };
  }
};
