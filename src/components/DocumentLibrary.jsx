import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Upload, 
  Plus, 
  X, 
  FileText, 
  ShieldCheck, 
  RotateCcw,
  SlidersHorizontal,
  FolderGit2
} from 'lucide-react';
import DocumentCard from './DocumentCard';
import DocumentWorkspace from './DocumentWorkspace';
import DocumentFilterPopover from './DocumentFilterPopover';
import DocumentSearchOverlay from './DocumentSearchOverlay';
import { DocumentRepository } from '../services/documentRepository';
import { AuditRepository } from '../services/auditRepository';
import { SharingService } from '../services/sharingService';

export default function DocumentLibrary({
  documents = [],
  cases = [],
  onOpenUpload,
  onDocumentDeleted,
  onDocumentUpdated,
  onDownloadDocument,
  currentUser,
  currentRole,
  onOpenShare,
  addToast,
  onStartOcr,
  onCancelOcr,
  activeOcrJobs = {},
  initialSelectedDocId = null,
  onWorkspaceStateChange
}) {
  // Active document opened in full-screen workspace
  const [activeWorkspaceDocId, setActiveWorkspaceDocId] = useState(initialSelectedDocId || null);

  // Notify parent of workspace open state
  useEffect(() => {
    onWorkspaceStateChange && onWorkspaceStateChange(Boolean(activeWorkspaceDocId));
    return () => {
      onWorkspaceStateChange && onWorkspaceStateChange(false);
    };
  }, [activeWorkspaceDocId, onWorkspaceStateChange]);

  // Search & Filter States
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    caseId: 'ALL',
    docType: 'ALL',
    classification: 'ALL',
    integrity: 'ALL',
    dateRange: 'ALL'
  });
  const [sortBy, setSortBy] = useState('date_desc');

  // Sync active workspace doc when initialSelectedDocId changes
  useEffect(() => {
    if (initialSelectedDocId) {
      setActiveWorkspaceDocId(initialSelectedDocId);
    }
  }, [initialSelectedDocId]);

  // Global Keyboard Shortcuts (Ctrl/Cmd + K for search)
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filter accessible documents based on RBAC
  const effectiveUser = currentUser || currentRole;
  const accessibleDocuments = useMemo(() => {
    return documents.filter(d => {
      if (d.caseId && !SharingService.canUserAccessCase(effectiveUser, d.caseId)) {
        return false;
      }
      const check = SharingService.checkDocumentAccess(effectiveUser, d);
      return check.allowed;
    });
  }, [documents, effectiveUser]);

  // Apply search, filters, and sort
  const filteredDocs = useMemo(() => {
    return accessibleDocuments.filter(d => {
      // 1. Text Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (d.name || '').toLowerCase().includes(q);
        const matchCase = (d.caseId || '').toLowerCase().includes(q);
        const matchType = (d.type || '').toLowerCase().includes(q);
        const matchClass = (d.classification || '').toLowerCase().includes(q);
        const matchOcr = d.ocr?.extractedText && d.ocr.extractedText.toLowerCase().includes(q);
        if (!matchName && !matchCase && !matchType && !matchClass && !matchOcr) {
          return false;
        }
      }

      // 2. Case Filter
      if (filters.caseId !== 'ALL' && d.caseId !== filters.caseId) {
        return false;
      }

      // 3. Document Type Filter
      if (filters.docType !== 'ALL') {
        const docT = (d.type || '').toLowerCase();
        const mime = (d.mimeType || '').toLowerCase();
        const targetT = filters.docType.toLowerCase();
        if (!docT.includes(targetT) && !mime.includes(targetT)) {
          return false;
        }
      }

      // 4. Classification Filter
      if (filters.classification !== 'ALL' && d.classification !== filters.classification) {
        return false;
      }

      // 5. Integrity Filter
      if (filters.integrity === 'VERIFIED' && d.isTampered) return false;
      if (filters.integrity === 'MISMATCH' && !d.isTampered) return false;

      // 6. Date Filter
      if (filters.dateRange !== 'ALL' && d.createdAt) {
        const dDate = new Date(d.createdAt).getTime();
        const now = Date.now();
        if (filters.dateRange === 'TODAY' && now - dDate > 24 * 60 * 60 * 1000) return false;
        if (filters.dateRange === '7_DAYS' && now - dDate > 7 * 24 * 60 * 60 * 1000) return false;
        if (filters.dateRange === '30_DAYS' && now - dDate > 30 * 24 * 60 * 60 * 1000) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'date_desc') return new Date(b.createdAt) - new Date(a.createdAt);
      if (sortBy === 'date_asc') return new Date(a.createdAt) - new Date(b.createdAt);
      if (sortBy === 'name_asc') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'size_desc') return (b.size || 0) - (a.size || 0);
      return 0;
    });
  }, [accessibleDocuments, searchQuery, filters, sortBy]);

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.caseId !== 'ALL') count++;
    if (filters.docType !== 'ALL') count++;
    if (filters.classification !== 'ALL') count++;
    if (filters.integrity !== 'ALL') count++;
    if (filters.dateRange !== 'ALL') count++;
    return count;
  }, [filters]);

  const handleFilterChange = (key, val) => {
    setFilters(prev => ({ ...prev, [key]: val }));
  };

  const handleClearFilters = () => {
    setFilters({
      caseId: 'ALL',
      docType: 'ALL',
      classification: 'ALL',
      integrity: 'ALL',
      dateRange: 'ALL'
    });
    setSearchQuery('');
  };

  // Find currently open document object for workspace
  const activeWorkspaceDoc = useMemo(() => {
    if (!activeWorkspaceDocId) return null;
    return documents.find(d => d.id === activeWorkspaceDocId) || null;
  }, [documents, activeWorkspaceDocId]);

  // Action: Live verify integrity
  const handleVerifyIntegrity = async (doc) => {
    try {
      const result = await DocumentRepository.verifyDocumentIntegrity(doc.id);
      
      await AuditRepository.logAuditEvent({
        actor: currentUser || currentRole,
        role: currentUser?.designation || currentRole?.designation,
        action: 'INTEGRITY_VERIFIED',
        targetType: 'DOCUMENT',
        targetId: doc.id,
        caseId: doc.caseId,
        result: result.valid ? 'SUCCESS' : 'ALERT',
        details: result.valid 
          ? `Cryptographic fingerprint verified against anchored seal.`
          : `INTEGRITY MISMATCH DETECTED: Stored ${result.storedHash.slice(0, 12)}... Calculated ${result.calculatedHash.slice(0, 12)}...`
      });

      if (result.valid) {
        if (addToast) addToast('Integrity Verified', `"${doc.name}" matches stored cryptographic checksum.`, 'success');
      } else {
        if (addToast) addToast('Integrity Mismatch', `Corrupted bytes detected for "${doc.name}"!`, 'error');
      }

      onDocumentUpdated && onDocumentUpdated();
    } catch (e) {
      if (addToast) addToast('Verification Error', e.message, 'error');
    }
  };

  // Action: Simulate Tamper
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
        details: `Integrity breach: Modified file bytes detected for "${doc.name}".`
      });

      if (addToast) addToast('Tamper Demonstration', `Altered 1 byte in storage for "${doc.name}". Re-verify to see mismatch.`, 'warning');
      onDocumentUpdated && onDocumentUpdated();
    } catch (e) {
      if (addToast) addToast('Tamper Error', e.message, 'error');
    }
  };

  // Action: Restore
  const handleRestore = async (doc) => {
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
        details: `Restored authentic original file for "${doc.name}".`
      });

      if (addToast) addToast('Document Restored', `Restored verified original file for "${doc.name}".`, 'success');
      onDocumentUpdated && onDocumentUpdated();
    } catch (e) {
      if (addToast) addToast('Restore Error', e.message, 'error');
    }
  };

  // Action: Delete
  const handleDelete = async (doc) => {
    const canDelete = currentUser?.role?.id === 'administrator' || 
      currentRole?.id === 'administrator' || 
      (currentUser?.role?.permissions || currentRole?.permissions || []).includes('delete');

    if (!canDelete) {
      if (addToast) addToast('Access Denied', 'Role is not authorized to delete evidence records.', 'error');
      return;
    }

    if (window.confirm(`Delete document "${doc.name}" from case #${doc.caseId}?`)) {
      await DocumentRepository.deleteDocument(doc.id);
      await AuditRepository.logAuditEvent({
        actor: currentUser || currentRole,
        role: currentUser?.designation || currentRole?.designation,
        action: 'DOCUMENT_DELETED',
        targetType: 'DOCUMENT',
        targetId: doc.id,
        caseId: doc.caseId,
        result: 'SUCCESS',
        details: `Deleted document "${doc.name}" and all historical versions.`
      });
      if (addToast) addToast('Document Deleted', `"${doc.name}" removed from local storage.`, 'info');
      onDocumentDeleted && onDocumentDeleted(doc.id);
      if (activeWorkspaceDocId === doc.id) {
        setActiveWorkspaceDocId(null);
      }
    }
  };

  return (
    <div className="space-y-4">
      
      {/* 1. Header Structure */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            AI Evidence Vault
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Cryptographically sealed CCTV frames, event captures, and verification records.
          </p>
        </div>

        {/* Header Controls: [Search Icon] [Filter Button] [+ Upload Evidence] */}
        <div className="flex items-center space-x-2 relative">
          
          {/* Search Trigger Icon Button */}
          <button
            onClick={() => setSearchOpen(true)}
            className="inline-flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 transition-colors"
            title="Search documents (Ctrl+K)"
          >
            <Search className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden md:inline-block px-1.5 py-0.5 text-[10px] font-mono text-slate-500 bg-white border border-slate-300 rounded font-normal">
              ⌘K
            </kbd>
          </button>

          {/* Filter Popover Trigger */}
          <div className="relative">
            <button
              onClick={() => setFilterOpen(!filterOpen)}
              className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                activeFilterCount > 0 
                  ? 'bg-blue-50 border-blue-300 text-blue-700' 
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
              }`}
              title="Filter documents"
            >
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <span>Filter</span>
              {activeFilterCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-mono">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Filter Dropdown Popover */}
            <DocumentFilterPopover
              isOpen={filterOpen}
              onClose={() => setFilterOpen(false)}
              filters={filters}
              onFilterChange={handleFilterChange}
              onClearFilters={handleClearFilters}
              cases={cases}
            />
          </div>

          {/* Upload Evidence Primary Action */}
          <button
            onClick={() => onOpenUpload && onOpenUpload()}
            className="inline-flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Upload Evidence</span>
          </button>

        </div>
      </div>

      {/* 2. Active Filters Chips (Only displayed when filters or search query are active) */}
      {(activeFilterCount > 0 || searchQuery.trim()) && (
        <div className="flex flex-wrap items-center gap-1.5 py-1 text-xs">
          <span className="text-[11px] font-semibold text-slate-500 mr-1">
            Active Filters:
          </span>

          {searchQuery.trim() && (
            <span className="inline-flex items-center space-x-1 bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-md text-[11px]">
              <span>Query: "{searchQuery}"</span>
              <button onClick={() => setSearchQuery('')} className="hover:text-blue-900">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {filters.caseId !== 'ALL' && (
            <span className="inline-flex items-center space-x-1 bg-slate-100 text-slate-800 border border-slate-200 px-2 py-0.5 rounded-md text-[11px]">
              <span>Centre: #{filters.caseId}</span>
              <button onClick={() => handleFilterChange('caseId', 'ALL')} className="hover:text-slate-900">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {filters.docType !== 'ALL' && (
            <span className="inline-flex items-center space-x-1 bg-slate-100 text-slate-800 border border-slate-200 px-2 py-0.5 rounded-md text-[11px]">
              <span>Type: {filters.docType}</span>
              <button onClick={() => handleFilterChange('docType', 'ALL')} className="hover:text-slate-900">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {filters.classification !== 'ALL' && (
            <span className="inline-flex items-center space-x-1 bg-slate-100 text-slate-800 border border-slate-200 px-2 py-0.5 rounded-md text-[11px]">
              <span>Classification: {filters.classification}</span>
              <button onClick={() => handleFilterChange('classification', 'ALL')} className="hover:text-slate-900">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {filters.integrity !== 'ALL' && (
            <span className="inline-flex items-center space-x-1 bg-slate-100 text-slate-800 border border-slate-200 px-2 py-0.5 rounded-md text-[11px]">
              <span>Integrity: {filters.integrity}</span>
              <button onClick={() => handleFilterChange('integrity', 'ALL')} className="hover:text-slate-900">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {filters.dateRange !== 'ALL' && (
            <span className="inline-flex items-center space-x-1 bg-slate-100 text-slate-800 border border-slate-200 px-2 py-0.5 rounded-md text-[11px]">
              <span>Date: {filters.dateRange}</span>
              <button onClick={() => handleFilterChange('dateRange', 'ALL')} className="hover:text-slate-900">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          <button
            onClick={handleClearFilters}
            className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold underline ml-1 cursor-pointer"
          >
            Clear all
          </button>
        </div>
      )}

      {/* 3. Document Count & Sort Bar */}
      <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
        <span>
          Showing <strong className="text-slate-800">{filteredDocs.length}</strong> of {accessibleDocuments.length} accessible documents
        </span>

        <div className="flex items-center space-x-2">
          <span className="hidden sm:inline">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-white border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="date_desc">Newest First</option>
            <option value="date_asc">Oldest First</option>
            <option value="name_asc">Name (A-Z)</option>
            <option value="size_desc">Largest Size</option>
          </select>
        </div>
      </div>

      {/* 4. Document Grid */}
      {filteredDocs.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredDocs.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              onOpenWorkspace={(d) => setActiveWorkspaceDocId(d.id)}
              onDownload={onDownloadDocument}
              onVerifyIntegrity={handleVerifyIntegrity}
              onOpenShare={onOpenShare}
              onDelete={handleDelete}
              isSelected={activeWorkspaceDocId === doc.id}
              isOcrRunning={Boolean(activeOcrJobs[doc.id])}
              currentUser={currentUser}
              currentRole={currentRole}
            />
          ))}
        </div>
      ) : (
        /* Empty States */
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-2xs space-y-3">
          <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center mx-auto">
            <FileText className="w-6 h-6 stroke-1" />
          </div>
          
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-slate-800">
              {accessibleDocuments.length === 0 
                ? 'No Evidence in Vault'
                : searchQuery.trim() 
                  ? 'No evidence matches your search'
                  : 'No evidence matches the selected filters'}
            </h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto font-normal">
              {accessibleDocuments.length === 0
                ? 'Ingest CCTV frame captures or verification telemetry to build the compliance evidence repository.'
                : searchQuery.trim()
                  ? `No accessible evidence matched "${searchQuery}". Try a broader term or reset filters.`
                  : 'Try adjusting or clearing your active filters to view all compliance evidence records.'}
            </p>
          </div>

          <div className="pt-2">
            {accessibleDocuments.length === 0 ? (
              <button
                onClick={() => onOpenUpload && onOpenUpload()}
                className="inline-flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Upload Evidence</span>
              </button>
            ) : (
              <button
                onClick={handleClearFilters}
                className="inline-flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-1.5 rounded-lg text-xs font-semibold"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clear Search & Filters</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 5. Full-Screen Document Workspace (Overlay) */}
      {activeWorkspaceDoc && (
        <DocumentWorkspace
          doc={activeWorkspaceDoc}
          onBack={() => setActiveWorkspaceDocId(null)}
          onDownload={onDownloadDocument}
          onVerifyIntegrity={handleVerifyIntegrity}
          onSimulateTamper={handleSimulateTamper}
          onRestore={handleRestore}
          onOpenShare={onOpenShare}
          onDelete={handleDelete}
          currentUser={currentUser}
          currentRole={currentRole}
          addToast={addToast}
          onStartOcr={onStartOcr}
          onCancelOcr={onCancelOcr}
          activeOcrJobs={activeOcrJobs}
          onDocumentUpdated={onDocumentUpdated}
        />
      )}

      {/* 6. On-Demand Command-Style Search Overlay */}
      <DocumentSearchOverlay
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        documents={accessibleDocuments}
        onSelectDoc={(doc) => {
          setActiveWorkspaceDocId(doc.id);
        }}
      />

    </div>
  );
}
