import React, { useState, useEffect, useRef, useMemo } from 'react';
import SidebarNav from './components/SidebarNav';
import TopHeader from './components/TopHeader';
import Dashboard from './components/Dashboard';
import CaseWorkspace from './components/CaseWorkspace';
import CasesView from './components/CasesView';
import TrainingCentreWorkspace from './components/TrainingCentreWorkspace';
import TrainingCentresView from './components/TrainingCentresView';
import DocumentLibrary from './components/DocumentLibrary';
import IntegrityVerificationView from './components/IntegrityVerificationView';
import OnboardCentreModal from './components/OnboardCentreModal';
import CreateCaseModal from './components/CreateCaseModal';
import UploadModal from './components/UploadModal';
import AuditTrailView from './components/AuditTrailView';
import AccessControlView from './components/AccessControlView';
import AccessDeniedModal from './components/AccessDeniedModal';
import ShareDocumentModal from './components/ShareDocumentModal';
import LoginView from './components/LoginView';
import GlobalSearchView from './components/GlobalSearchView';
import ComplianceEventsView from './components/ComplianceEventsView';
import Toast from './components/Toast';

import { ROLES } from './data/roles';
import { DEMO_USERS } from './data/demoUsers';
import { loadLocal, saveLocal } from './services/db';
import { CaseRepository } from './services/caseRepository';
import { CentreRepository } from './services/centreRepository';
import { ComplianceEventRepository } from './services/complianceEventRepository';
import { DocumentRepository } from './services/documentRepository';
import { AuditRepository } from './services/auditRepository';
import { SharingService } from './services/sharingService';
import { recognizeDocument, isOcrSupported, terminateOCR } from './services/ocr/ocrService';

import { 
  FolderGit2, 
  FolderPlus, 
  FileText, 
  ChevronRight, 
  CheckCircle2, 
  ShieldCheck, 
  AlertTriangle, 
  RotateCcw,
  Plus
} from 'lucide-react';

export default function App() {
  // Session authentication state (persists across page reloads via Dual-Persistence)
  const [currentUser, setCurrentUser] = useState(() => loadLocal('caseguard_session', null));
  const [currentRole, setCurrentRole] = useState(() => {
    const user = loadLocal('caseguard_session', null);
    return user?.role || ROLES.INVESTIGATION_OFFICER;
  });

  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard' | 'centres' | 'events' | 'evidence' | 'integrity' | 'audit' | 'search' | 'access'
  
  // Real repositories state backed by Dual-Persistence (localStorage instant hydration + IndexedDB)
  const [cases, setCases] = useState(() => loadLocal('caseguard_cases', []));
  const [centres, setCentres] = useState(() => loadLocal('compliance_centres', []));
  const [complianceEvents, setComplianceEvents] = useState(() => loadLocal('compliance_events', []));
  const [documents, setDocuments] = useState(() => loadLocal('caseguard_documents', []));
  const [auditLogs, setAuditLogs] = useState(() => loadLocal('caseguard_audit_events', []));
  const [selectedCase, setSelectedCase] = useState(null);
  const [selectedCentre, setSelectedCentre] = useState(null);
  const [loading, setLoading] = useState(false);

  // Background OCR job tracking & cancellation
  const [activeOcrJobs, setActiveOcrJobs] = useState({});
  const ocrAbortControllersRef = useRef({});
  const [selectedDocIdForLibrary, setSelectedDocIdForLibrary] = useState(null);
  const [isDocumentWorkspaceOpen, setIsDocumentWorkspaceOpen] = useState(false);

  // Reset document workspace state if user changes views
  useEffect(() => {
    if (currentView !== 'documents') {
      setIsDocumentWorkspaceOpen(false);
    }
  }, [currentView]);

  // Navigation drawer state for mobile
  const [mobileOpen, setMobileOpen] = useState(false);

  // Modal dialog states
  const [createCaseModalOpen, setCreateCaseModalOpen] = useState(false);
  const [uploadModalConfig, setUploadModalConfig] = useState({ isOpen: false, defaultCaseId: '', targetDocumentId: null });
  const [shareModalConfig, setShareModalConfig] = useState({ isOpen: false, document: null });
  const [accessDeniedData, setAccessDeniedData] = useState(null);

  // Toast stack
  const [toasts, setToasts] = useState([]);

  const addToast = (title, message, type = 'info') => {
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
    setToasts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  const dismissToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Primary data loader from IndexedDB
  const loadAllData = async () => {
    try {
      setLoading(true);
      const [cList, dList, aList, centresList, eventsList] = await Promise.all([
        CaseRepository.getAllCases(),
        DocumentRepository.getAllDocuments(),
        AuditRepository.getAllAuditEvents(),
        CentreRepository.getAllCentres(),
        ComplianceEventRepository.getAllEvents()
      ]);
      setCases(cList);
      setDocuments(dList);
      setAuditLogs(aList);
      setCentres(centresList);
      setComplianceEvents(eventsList);

      // Keep selectedCase / selectedCentre in sync if open
      if (selectedCentre) {
        const found = centresList.find(c => c.id === selectedCentre.id || c.centreCode === selectedCentre.centreCode);
        setSelectedCentre(found || null);
      }
      if (selectedCase) {
        const found = cList.find(c => c.id === selectedCase.id || c.caseNumber === selectedCase.caseNumber);
        setSelectedCase(found || null);
      }
    } catch (err) {
      console.error('Failed to load data from IndexedDB:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initial mount: load IndexedDB data
  useEffect(() => {
    loadAllData();
  }, []);

  // Sync selectedCase & selectedCentre when arrays update
  useEffect(() => {
    if (selectedCentre) {
      const updated = centres.find(c => c.id === selectedCentre.id || c.centreCode === selectedCentre.centreCode);
      if (updated) setSelectedCentre(updated);
    }
    if (selectedCase) {
      const updated = cases.find(c => c.id === selectedCase.id || c.caseNumber === selectedCase.caseNumber);
      if (updated) setSelectedCase(updated);
    }
  }, [cases, centres]);

  // Derived real metrics
  const integrityAlertCount = documents.filter(d => d.isTampered).length;

  // RBAC Filtered Accessible Documents for the Current Officer
  const accessibleDocuments = useMemo(() => {
    const effectiveUser = currentUser || currentRole;
    return documents.filter(d => {
      if (d.caseId && !SharingService.canUserAccessCase(effectiveUser, d.caseId)) {
        return false;
      }
      const check = SharingService.checkDocumentAccess(effectiveUser, d);
      return check.allowed;
    });
  }, [documents, currentUser, currentRole]);

  // Authentication Handlers
  const handleLoginSuccess = async (user) => {
    setCurrentUser(user);
    setCurrentRole(user.role);
    saveLocal('caseguard_session', user);

    await AuditRepository.logAuditEvent({
      actor: user,
      role: user.designation,
      action: 'LOGIN',
      targetType: 'SYSTEM',
      targetId: user.email,
      caseId: 'PORTAL',
      result: 'SUCCESS',
      details: `Officer "${user.name}" (${user.designation}) authenticated via institutional credentials with ${user.clearance} clearance.`
    });

    addToast('Officer Authenticated', `Welcome, ${user.name} (${user.designation})`, 'success');
    loadAllData();
  };

  const handleLogout = async () => {
    if (currentUser) {
      await AuditRepository.logAuditEvent({
        actor: currentUser,
        role: currentUser.designation,
        action: 'LOGOUT',
        targetType: 'SYSTEM',
        targetId: currentUser.email,
        caseId: 'PORTAL',
        result: 'SUCCESS',
        details: `Officer "${currentUser.name}" signed out of the CaseGuard session.`
      });
    }

    saveLocal('caseguard_session', null);
    setCurrentUser(null);
    setSelectedCase(null);
    addToast('Session Ended', 'Successfully signed out of evidence vault.', 'info');
  };

  const handleSwitchUser = async (newUser) => {
    if (!newUser) return;
    saveLocal('caseguard_session', newUser);
    setCurrentUser(newUser);
    setCurrentRole(newUser.role);

    // If currently viewing a case that new user cannot access, return to dashboard
    if (selectedCase && !SharingService.canUserAccessCase(newUser, selectedCase)) {
      setSelectedCase(null);
      setCurrentView('dashboard');
    }

    await AuditRepository.logAuditEvent({
      actor: newUser,
      role: newUser.designation,
      action: 'SESSION_SWITCH',
      targetType: 'USER',
      targetId: newUser.id,
      caseId: 'GENERAL',
      result: 'SUCCESS',
      details: `Active officer persona switched to "${newUser.name}" (${newUser.designation}).`
    });

    addToast('Persona Switched', `Active Session: ${newUser.name} (${newUser.designation})`, 'info');
    loadAllData();
  };

  // RBAC Gated Centre & Case Selection
  const handleSelectCentre = async (c) => {
    if (!c) return;
    const targetCode = c.centreCode || c.caseNumber || c.id;
    const allowed = SharingService.canUserAccessCase(currentUser || currentRole, c);
    if (!allowed) {
      const denialDetails = `403 Forbidden: Officer "${currentUser?.name || currentRole?.name}" (${currentUser?.designation || currentRole?.designation}) is not assigned to Centre #${targetCode}. Under PoLP security policy, access is restricted strictly to assigned inspection officers.`;

      await AuditRepository.logAuditEvent({
        actor: currentUser || currentRole,
        role: currentUser?.designation || currentRole?.designation,
        action: 'UNAUTHORIZED_ACCESS_DENIED',
        targetType: 'CENTRE',
        targetId: targetCode,
        caseId: targetCode,
        result: 'DENIED',
        details: denialDetails
      });

      setAccessDeniedData({
        docName: `Centre Dossier #${targetCode} (${c.name || c.title})`,
        role: currentRole,
        attemptedType: 'CENTRE',
        resourceClassification: 'Restricted Compliance Record',
        denialReason: denialDetails
      });

      addToast('403 Access Denied', `You are not assigned to Centre #${targetCode}`, 'warning');
      loadAllData();
      return;
    }

    setSelectedCentre(c);
    setSelectedCase(c);
    setCurrentView('centres');
  };

  const handleSelectCase = async (c) => {
    return handleSelectCentre(c);
  };

  // RBAC Gated Document View
  const handleViewDocument = async (doc) => {
    if (!doc) return;
    const access = SharingService.checkDocumentAccess(currentUser || currentRole, doc);
    if (!access.allowed) {
      await AuditRepository.logAuditEvent({
        actor: currentUser || currentRole,
        role: currentUser?.designation || currentRole?.designation,
        action: 'UNAUTHORIZED_ACCESS_DENIED',
        targetType: 'DOCUMENT',
        targetId: doc.id,
        caseId: doc.caseId,
        result: 'DENIED',
        details: access.message
      });

      setAccessDeniedData({
        docName: doc.name,
        role: currentRole,
        attemptedType: 'DOCUMENT',
        resourceClassification: access.requiredClearance || doc.classification || 'Restricted',
        denialReason: access.message
      });

      addToast('403 Access Denied', access.message, 'warning');
      loadAllData();
      return false;
    }

    await AuditRepository.logAuditEvent({
      actor: currentUser || currentRole,
      role: currentUser?.designation || currentRole?.designation,
      action: 'DOCUMENT_VIEWED',
      targetType: 'DOCUMENT',
      targetId: doc.id,
      caseId: doc.caseId,
      result: 'SUCCESS',
      details: `Officer "${currentUser?.name || currentRole?.name}" decrypted and opened document "${doc.name}" in verified viewer.`
    });

    setSelectedDocIdForLibrary(doc.id);
    setCurrentView('documents');
    return true;
  };

  // RBAC Gated Document Download
  const handleDownloadDocument = async (doc) => {
    try {
      const access = SharingService.checkDocumentAccess(currentUser || currentRole, doc);
      if (!access.allowed || !access.permissions.includes('DOWNLOAD')) {
        const msg = !access.allowed 
          ? access.message 
          : `Delegated permission for "${doc.name}" is restricted to VIEW ONLY. Export is disallowed under PoLP.`;

        await AuditRepository.logAuditEvent({
          actor: currentUser || currentRole,
          role: currentUser?.designation || currentRole?.designation,
          action: 'UNAUTHORIZED_ACCESS_DENIED',
          targetType: 'DOCUMENT',
          targetId: doc.id,
          caseId: doc.caseId,
          result: 'DENIED',
          details: `Download blocked: ${msg}`
        });

        setAccessDeniedData({
          docName: doc.name,
          role: currentRole,
          attemptedType: 'DOCUMENT',
          resourceClassification: doc.classification || 'Restricted',
          denialReason: msg
        });

        addToast('Download Denied', msg, 'error');
        loadAllData();
        return;
      }

      const blob = await DocumentRepository.getVersionBlob(doc.currentVersionId);
      if (!blob) throw new Error('File binary not found in local storage.');

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      await AuditRepository.logAuditEvent({
        actor: currentUser || currentRole,
        role: currentUser?.designation || currentRole?.designation,
        action: 'DOCUMENT_DOWNLOADED',
        targetType: 'DOCUMENT',
        targetId: doc.id,
        caseId: doc.caseId,
        result: 'SUCCESS',
        details: `Downloaded authenticated file "${doc.name}" (${(doc.size / 1024).toFixed(1)} KB).`
      });

      addToast('Download Initiated', `Downloaded certified copy of "${doc.name}"`, 'info');
      loadAllData();
    } catch (err) {
      addToast('Download Error', err.message, 'error');
    }
  };

  // Centre Onboarding Actions
  const handleOpenRegisterCentre = () => {
    setCreateCaseModalOpen(true);
  };
  const handleOpenCreateCase = handleOpenRegisterCentre;

  const handleCentreCreated = (newItem) => {
    loadAllData();
    setSelectedCentre(newItem);
    setSelectedCase(newItem);
    setCurrentView('centres');
  };
  const handleCaseCreated = handleCentreCreated;

  // Upload Actions
  const handleOpenUpload = (caseNumber, targetDocId = null) => {
    setUploadModalConfig({
      isOpen: true,
      defaultCaseId: caseNumber || selectedCase?.caseNumber || (cases[0]?.caseNumber || ''),
      targetDocumentId: targetDocId
    });
  };

  // Document Access Delegation Action
  const handleOpenShare = (doc) => {
    if (!doc) return;
    setShareModalConfig({ isOpen: true, document: doc });
  };

  // Background OCR Management
  const startDocumentOcr = async (doc, fileBlob = null) => {
    if (!doc || !doc.id) return;
    if (activeOcrJobs[doc.id]) {
      addToast('OCR in Progress', `OCR is already processing for "${doc.name}".`, 'info');
      return;
    }

    const mime = doc.mimeType || '';
    const support = isOcrSupported(mime, doc.name);
    if (!support.supported) {
      await DocumentRepository.updateDocumentOcr(doc.id, {
        status: 'NOT_APPLICABLE',
        text: '',
        error: support.reason
      });
      loadAllData();
      return;
    }

    let blob = fileBlob;
    if (!blob) {
      try {
        blob = await DocumentRepository.getVersionBlob(doc.currentVersionId);
      } catch (err) {
        console.error('Failed to load blob for OCR:', err);
      }
    }

    if (!blob) {
      addToast('OCR Error', `Could not access file binary for "${doc.name}".`, 'error');
      return;
    }

    const controller = new AbortController();
    ocrAbortControllersRef.current[doc.id] = controller;

    // Set UI state to active
    setActiveOcrJobs(prev => ({
      ...prev,
      [doc.id]: { stage: 'init', status: 'Initializing OCR engine...', progress: 0.05 }
    }));

    // Update DB status to PROCESSING
    await DocumentRepository.updateDocumentOcr(doc.id, {
      status: 'PROCESSING',
      error: null
    });

    // Log OCR_STARTED audit event
    await AuditRepository.logAuditEvent({
      actor: currentUser || currentRole,
      role: currentUser?.designation || currentRole?.designation,
      action: 'OCR_STARTED',
      targetType: 'DOCUMENT',
      targetId: doc.id,
      caseId: doc.caseId,
      result: 'SUCCESS',
      details: `In-browser OCR text extraction initiated for "${doc.name}" using Tesseract.js.`
    });

    loadAllData();

    try {
      const result = await recognizeDocument(
        blob,
        { name: doc.name, mimeType: doc.mimeType },
        {
          language: 'eng',
          signal: controller.signal,
          onProgress: (progressInfo) => {
            setActiveOcrJobs(prev => {
              if (!prev[doc.id]) return prev;
              return {
                ...prev,
                [doc.id]: progressInfo
              };
            });
          }
        }
      );

      delete ocrAbortControllersRef.current[doc.id];
      setActiveOcrJobs(prev => {
        const next = { ...prev };
        delete next[doc.id];
        return next;
      });

      if (result.status === 'COMPLETED') {
        await DocumentRepository.updateDocumentOcr(doc.id, result);
        await AuditRepository.logAuditEvent({
          actor: currentUser || currentRole,
          role: currentUser?.designation || currentRole?.designation,
          action: 'OCR_COMPLETED',
          targetType: 'DOCUMENT',
          targetId: doc.id,
          caseId: doc.caseId,
          result: 'SUCCESS',
          details: `OCR text extraction completed for "${doc.name}". Extracted ${result.text.length} characters across ${result.pageCount} ${result.pageCount === 1 ? 'page' : 'pages'}.`
        });
        addToast('OCR Completed', `Text extracted & indexed for "${doc.name}".`, 'success');
      } else if (result.status === 'CANCELLED') {
        await DocumentRepository.updateDocumentOcr(doc.id, result);
        await AuditRepository.logAuditEvent({
          actor: currentUser || currentRole,
          role: currentUser?.designation || currentRole?.designation,
          action: 'OCR_CANCELLED',
          targetType: 'DOCUMENT',
          targetId: doc.id,
          caseId: doc.caseId,
          result: 'ALERT',
          details: `OCR text extraction cancelled by user for "${doc.name}".`
        });
        addToast('OCR Cancelled', `OCR cancelled for "${doc.name}".`, 'info');
      } else {
        await DocumentRepository.updateDocumentOcr(doc.id, result);
        await AuditRepository.logAuditEvent({
          actor: currentUser || currentRole,
          role: currentUser?.designation || currentRole?.designation,
          action: 'OCR_FAILED',
          targetType: 'DOCUMENT',
          targetId: doc.id,
          caseId: doc.caseId,
          result: 'ALERT',
          details: `OCR text extraction failed for "${doc.name}": ${result.error}`
        });
        addToast('OCR Failed', `Could not extract text from "${doc.name}": ${result.error}`, 'error');
      }

      loadAllData();

    } catch (err) {
      delete ocrAbortControllersRef.current[doc.id];
      setActiveOcrJobs(prev => {
        const next = { ...prev };
        delete next[doc.id];
        return next;
      });

      const isAborted = err.name === 'AbortError' || controller.signal?.aborted;
      const status = isAborted ? 'CANCELLED' : 'FAILED';
      const errorMessage = isAborted ? 'OCR processing was cancelled by user.' : (err.message || 'Unknown OCR error');

      await DocumentRepository.updateDocumentOcr(doc.id, {
        status,
        text: '',
        error: errorMessage
      });

      await AuditRepository.logAuditEvent({
        actor: currentUser || currentRole,
        role: currentUser?.designation || currentRole?.designation,
        action: isAborted ? 'OCR_CANCELLED' : 'OCR_FAILED',
        targetType: 'DOCUMENT',
        targetId: doc.id,
        caseId: doc.caseId,
        result: 'ALERT',
        details: isAborted
          ? `OCR extraction cancelled for "${doc.name}".`
          : `OCR processing error on "${doc.name}": ${errorMessage}`
      });

      addToast(isAborted ? 'OCR Cancelled' : 'OCR Failed', errorMessage, isAborted ? 'info' : 'error');
      loadAllData();
    }
  };

  const cancelDocumentOcr = async (docId) => {
    if (ocrAbortControllersRef.current[docId]) {
      ocrAbortControllersRef.current[docId].abort();
      delete ocrAbortControllersRef.current[docId];
    }
    await terminateOCR();

    setActiveOcrJobs(prev => {
      const next = { ...prev };
      delete next[docId];
      return next;
    });

    const doc = documents.find(d => d.id === docId);
    if (doc) {
      await DocumentRepository.updateDocumentOcr(docId, {
        status: 'CANCELLED',
        error: 'OCR cancelled by user.'
      });
      await AuditRepository.logAuditEvent({
        actor: currentUser || currentRole,
        role: currentUser?.designation || currentRole?.designation,
        action: 'OCR_CANCELLED',
        targetType: 'DOCUMENT',
        targetId: doc.id,
        caseId: doc.caseId,
        result: 'ALERT',
        details: `OCR text extraction cancelled by user for "${doc.name}".`
      });
      addToast('OCR Cancelled', `OCR cancelled for "${doc.name}".`, 'info');
    }

    loadAllData();
  };

  const handleUploadSuccess = (uploadedItems = []) => {
    loadAllData();
    addToast('Document Ingested', 'Document successfully fingerprinted and saved.', 'success');

    // Automatically kick off OCR for supported uploaded files in background
    if (Array.isArray(uploadedItems) && uploadedItems.length > 0) {
      uploadedItems.forEach(({ doc, file }) => {
        if (doc && file) {
          const support = isOcrSupported(file.type || doc.mimeType, doc.name);
          if (support.supported) {
            startDocumentOcr(doc, file);
          }
        }
      });
    }
  };

  // Cryptographic Verification & Tamper Simulation
  const handleVerifyDoc = async (doc) => {
    try {
      const res = await DocumentRepository.verifyDocumentIntegrity(doc.id, currentUser || currentRole);
      await AuditRepository.logAuditEvent({
        actor: currentUser || currentRole,
        role: currentUser?.designation || currentRole?.designation,
        action: 'INTEGRITY_VERIFIED',
        targetType: 'DOCUMENT',
        targetId: doc.id,
        caseId: doc.caseId,
        result: res.valid ? 'SUCCESS' : 'ALERT',
        details: res.valid
          ? `Digital fingerprint verified against anchored seal.`
          : `INTEGRITY MISMATCH DETECTED: Stored ${res.storedHash.slice(0, 16)}•••••••• Calculated ${res.calculatedHash.slice(0, 16)}••••••••`
      });

      if (res.valid) {
        addToast('Integrity Verified', `"${doc.name}" matches anchored cryptographic seal.`, 'success');
      } else {
        addToast('Integrity Mismatch', `Corrupted bytes detected for "${doc.name}"!`, 'error');
      }
      loadAllData();
    } catch (e) {
      addToast('Error', e.message, 'error');
    }
  };

  const handleSimulateTamper = async (doc) => {
    try {
      await DocumentRepository.simulateDocumentTamper(doc.id);
      await AuditRepository.logAuditEvent({
        actor: currentUser || currentRole,
        role: currentUser?.designation || currentRole?.designation,
        action: 'TAMPER_DETECTED',
        targetType: 'DOCUMENT',
        targetId: doc.id,
        caseId: doc.caseId,
        result: 'ALERT',
        details: `Tamper demonstration: 1 byte modified in storage for "${doc.name}".`
      });

      addToast('Tamper Demonstration', `Altered 1 byte in storage for "${doc.name}". Re-verify to see hash mismatch.`, 'warning');
      loadAllData();
    } catch (e) {
      addToast('Error', e.message, 'error');
    }
  };

  const handleRestoreDoc = async (doc) => {
    try {
      await DocumentRepository.restoreDocument(doc.id);
      await AuditRepository.logAuditEvent({
        actor: currentUser || currentRole,
        role: currentUser?.designation || currentRole?.designation,
        action: 'DOCUMENT_RESTORED',
        targetType: 'DOCUMENT',
        targetId: doc.id,
        caseId: doc.caseId,
        result: 'SUCCESS',
        details: `Document "${doc.name}" restored to authentic cryptographically anchored version.`
      });

      addToast('Document Restored', `Restored verified original file for "${doc.name}".`, 'success');
      loadAllData();
    } catch (e) {
      addToast('Error', e.message, 'error');
    }
  };

  // Simulate Unauthorized Access (RBAC testing)
  const handleSimulateUnauthorizedAccess = async (targetDocName = 'Confidential_Informant_Registry.pdf') => {
    const actorName = currentUser?.name || currentRole.name;
    const actorRole = currentUser?.designation || currentRole.designation;

    await AuditRepository.logAuditEvent({
      actor: currentUser || currentRole,
      role: actorRole,
      action: 'UNAUTHORIZED_ACCESS_DENIED',
      targetType: 'DOCUMENT',
      targetId: 'DOC-RESTRICTED',
      caseId: selectedCase?.caseNumber || 'GENERAL',
      result: 'DENIED',
      details: `403 FORBIDDEN: Officer "${actorName}" (${actorRole}) attempted unauthorized decryption of classified document "${targetDocName}".`
    });

    setAccessDeniedData({ 
      docName: targetDocName, 
      role: currentRole,
      attemptedType: 'DOCUMENT',
      resourceClassification: 'Top Secret',
      denialReason: `Access was denied because your active identity (${actorRole}) does not meet the mandatory Top Secret clearance threshold required to decrypt this classified docket.`
    });
    addToast('403 Access Denied', `Access blocked for ${actorName} (Clearance insufficient)`, 'warning');
    loadAllData();
  };

  // Filter out duplicate access-denied toasts while AccessDeniedModal is active
  const visibleToasts = accessDeniedData
    ? toasts.filter(t => !t.title?.toLowerCase().includes('denied') && !t.title?.includes('403'))
    : toasts;

  // IF NOT AUTHENTICATED: Display institutional Login screen
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
        <Toast toasts={visibleToasts} onDismiss={dismissToast} />
        <LoginView onLoginSuccess={handleLoginSuccess} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans antialiased">
      
      {/* Toast Notification Container */}
      <Toast toasts={visibleToasts} onDismiss={dismissToast} />

      {/* Responsive Left Navigation */}
      {!isDocumentWorkspaceOpen && (
        <SidebarNav
          currentView={currentView}
          setCurrentView={(view) => {
            setCurrentView(view);
            if ((view === 'cases' || view === 'centres') && !selectedCentre && !selectedCase) {
              // Stay on list
            }
          }}
          currentUser={currentUser}
          currentRole={currentRole}
          setCurrentRole={(r) => {
            setCurrentRole(r);
            addToast('Role Switched', `Active session: ${r.name} (${r.designation})`, 'info');
          }}
          onSwitchUser={handleSwitchUser}
          integrityAlertCount={integrityAlertCount}
          casesCount={centres.length > 0 ? centres.length : cases.length}
          documentsCount={documents.length}
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
        />
      )}

      {/* Main Content Area (offset by sidebar on desktop) */}
      <div className={`${isDocumentWorkspaceOpen ? '' : 'lg:pl-64'} flex flex-col flex-1 min-h-screen`}>
        
        {/* Sticky Top Header with Active Officer Profile */}
        {!isDocumentWorkspaceOpen && (
          <TopHeader
            currentView={currentView}
            selectedCase={selectedCentre || selectedCase}
            onOpenMobileMenu={() => setMobileOpen(true)}
            onOpenSearch={() => setCurrentView('search')}
            integrityAlertCount={integrityAlertCount}
            currentUser={currentUser}
            currentRole={currentRole}
            onNavigateToAccess={() => setCurrentView('access')}
          />
        )}

        {/* Dynamic Viewport Content */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:px-8 lg:py-6">
          
          {/* VIEW 1: OVERVIEW / DASHBOARD */}
          {currentView === 'dashboard' && (
            <Dashboard
              cases={cases}
              centres={centres}
              complianceEvents={complianceEvents}
              documents={documents}
              auditLogs={auditLogs}
              onSelectCase={handleSelectCentre}
              onSelectCentre={handleSelectCentre}
              onOpenCreateCase={handleOpenCreateCase}
              onOpenRegisterCentre={handleOpenCreateCase}
              onOpenUpload={handleOpenUpload}
              onQuickVerify={handleVerifyDoc}
              integrityAlertCount={integrityAlertCount}
              currentUser={currentUser}
              currentRole={currentRole}
              onNavigate={setCurrentView}
              onViewDocument={handleViewDocument}
            />
          )}

          {/* VIEW 2: TRAINING CENTRES & WORKSPACES */}
          {(currentView === 'cases' || currentView === 'centres') && (
            (selectedCentre || selectedCase) ? (
              <CaseWorkspace
                caseItem={selectedCentre || selectedCase}
                centreItem={selectedCentre || selectedCase}
                onBack={() => {
                  setSelectedCentre(null);
                  setSelectedCase(null);
                }}
                onOpenUpload={(cNum) => handleOpenUpload(cNum)}
                onViewDocument={handleViewDocument}
                onDownloadDocument={handleDownloadDocument}
                onOpenShare={handleOpenShare}
                onDocumentDeleted={() => loadAllData()}
                currentUser={currentUser}
                currentRole={currentRole}
                addToast={addToast}
              />
            ) : (
              <CasesView
                cases={cases}
                centres={centres}
                complianceEvents={complianceEvents}
                documents={documents}
                currentUser={currentUser}
                currentRole={currentRole}
                onSelectCase={handleSelectCentre}
                onSelectCentre={handleSelectCentre}
                onOpenCreateCase={handleOpenCreateCase}
                onOpenRegisterCentre={handleOpenCreateCase}
                loading={loading}
              />
            )
          )}

          {/* VIEW 3: COMPLIANCE EVENTS STREAM */}
          {currentView === 'events' && (
            <ComplianceEventsView
              complianceEvents={complianceEvents}
              centres={centres}
              currentUser={currentUser}
              currentRole={currentRole}
              onSelectCentre={handleSelectCentre}
              onViewEvidence={(evidenceId) => {
                setCurrentView('documents');
              }}
              addToast={addToast}
            />
          )}

          {/* VIEW 4: AI EVIDENCE & DOCUMENT VAULT */}
          {(currentView === 'documents' || currentView === 'evidence') && (
            <DocumentLibrary
              documents={documents}
              cases={cases}
              onOpenUpload={(cNum, docId) => handleOpenUpload(cNum, docId)}
              onDocumentDeleted={() => loadAllData()}
              onDocumentUpdated={() => loadAllData()}
              onDownloadDocument={handleDownloadDocument}
              currentUser={currentUser}
              currentRole={currentRole}
              onOpenShare={handleOpenShare}
              addToast={addToast}
              onStartOcr={startDocumentOcr}
              onCancelOcr={cancelDocumentOcr}
              activeOcrJobs={activeOcrJobs}
              initialSelectedDocId={selectedDocIdForLibrary}
              onWorkspaceStateChange={setIsDocumentWorkspaceOpen}
            />
          )}

          {/* VIEW 5: EDGE & CAMERA HEALTH / INTEGRITY */}
          {(currentView === 'integrity' || currentView === 'health') && (
            <IntegrityVerificationView
              documents={accessibleDocuments}
              cases={cases}
              centres={centres}
              auditLogs={auditLogs}
              currentUser={currentUser}
              currentRole={currentRole}
              onVerifyDocument={handleVerifyDoc}
              onSimulateTamper={handleSimulateTamper}
              onRestoreDocument={handleRestoreDoc}
              onSelectCase={(caseId) => {
                const targetId = String(caseId).replace(/^#/, '');
                const matched = centres.find(c => (c.centreCode || '').replace(/^#/, '') === targetId || c.id === targetId) ||
                  cases.find(c => String(c.caseNumber || '').replace(/^#/, '') === targetId || c.id === targetId);
                if (matched) {
                  handleSelectCentre(matched);
                } else {
                  setCurrentView('centres');
                }
              }}
              onSelectCentre={handleSelectCentre}
              onViewDocument={(doc) => {
                setSelectedDocIdForLibrary(doc.id);
                setCurrentView('documents');
              }}
            />
          )}

          {/* VIEW 5: AUDIT TRAIL */}
          {currentView === 'audit' && (
            <AuditTrailView
              auditLogs={auditLogs}
              cases={cases}
              documents={documents}
              currentRole={currentRole}
              addToast={addToast}
              onSelectCase={handleSelectCase}
              onViewDocument={handleViewDocument}
            />
          )}

          {/* VIEW 6: UNIVERSAL SEARCH */}
          {currentView === 'search' && (
            <GlobalSearchView
              cases={cases}
              documents={documents}
              currentUser={currentUser}
              currentRole={currentRole}
              onSelectCase={handleSelectCase}
              onViewDocument={handleViewDocument}
              onVerifyDocument={handleVerifyDoc}
            />
          )}

          {/* VIEW 7: ACCESS CONTROL (RBAC) */}
          {currentView === 'access' && (
            <AccessControlView
              currentUser={currentUser}
              currentRole={currentRole}
              setCurrentRole={(r) => {
                setCurrentRole(r);
                addToast('Role Switched', `Active session: ${r.name}`, 'info');
              }}
              onSwitchUser={handleSwitchUser}
              onLogout={handleLogout}
              onTriggerUnauthorizedAccess={() => handleSimulateUnauthorizedAccess()}
            />
          )}

        </main>

      </div>

      {/* MODAL 1: Onboard Training Centre */}
      {createCaseModalOpen && (
        <OnboardCentreModal
          onClose={() => setCreateCaseModalOpen(false)}
          onCentreCreated={handleCentreCreated}
          onCaseCreated={handleCaseCreated}
          currentRole={currentRole}
          addToast={addToast}
        />
      )}

      {/* MODAL 2: Secure Real File Upload */}
      {uploadModalConfig.isOpen && (
        <UploadModal
          cases={cases}
          defaultCaseId={uploadModalConfig.defaultCaseId}
          targetDocumentId={uploadModalConfig.targetDocumentId}
          onClose={() => setUploadModalConfig({ isOpen: false })}
          onUploadSuccess={handleUploadSuccess}
          currentRole={currentRole}
          addToast={addToast}
        />
      )}

      {/* MODAL 3: 403 Access Denied Enforcer */}
      {accessDeniedData && (
        <AccessDeniedModal
          onClose={() => setAccessDeniedData(null)}
          currentRole={accessDeniedData.role || currentRole}
          attemptedDocName={accessDeniedData.docName}
          attemptedType={accessDeniedData.attemptedType || 'DOCUMENT'}
          resourceClassification={accessDeniedData.resourceClassification || 'RESTRICTED'}
          denialReason={accessDeniedData.denialReason}
          onViewAudit={() => {
            setAccessDeniedData(null);
            setCurrentView('audit');
          }}
        />
      )}

      {/* MODAL 4: Controlled Document Access Delegation */}
      {shareModalConfig.isOpen && shareModalConfig.document && (
        <ShareDocumentModal
          isOpen={shareModalConfig.isOpen}
          onClose={() => setShareModalConfig({ isOpen: false, document: null })}
          document={shareModalConfig.document}
          currentUser={currentUser}
          currentRole={currentRole}
          onShareCreated={() => {
            loadAllData();
          }}
          addToast={addToast}
        />
      )}

    </div>
  );
}
