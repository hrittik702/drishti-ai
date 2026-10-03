import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  FileText,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Lock,
  X,
  RotateCcw,
  Eye,
  FolderGit2
} from 'lucide-react';
import { filterAndSortSearchResults } from '../utils/searchUtils.js';
import { formatCaseId } from '../utils/caseUtils.js';

function HighlightedSnippet({ text, query }) {
  if (!text || !query) return <span>{text}</span>;
  const parts = [];
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return <span>{text}</span>;

  let lastIndex = 0;
  let idx = lowerText.indexOf(lowerQuery, lastIndex);

  while (idx !== -1) {
    if (idx > lastIndex) {
      parts.push({ text: text.substring(lastIndex, idx), highlight: false });
    }
    parts.push({ text: text.substring(idx, idx + lowerQuery.length), highlight: true });
    lastIndex = idx + lowerQuery.length;
    idx = lowerText.indexOf(lowerQuery, lastIndex);
  }
  if (lastIndex < text.length) {
    parts.push({ text: text.substring(lastIndex), highlight: false });
  }

  return (
    <span>
      {parts.map((p, i) =>
        p.highlight ? (
          <mark key={i} className="bg-amber-100 text-amber-900 font-semibold px-0.5 rounded">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </span>
  );
}

export default function GlobalSearchView({
  cases = [],
  documents = [],
  currentUser = null,
  currentRole = null,
  onSelectCase,
  onViewDocument,
  onVerifyDocument
}) {
  const [query, setQuery] = useState('');
  const [caseFilter, setCaseFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [classificationFilter, setClassificationFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortOption, setSortOption] = useState('relevance');

  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef(null);
  const searchInputRef = useRef(null);

  // Close filter popover on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target)) {
        setFilterMenuOpen(false);
      }
    }
    if (filterMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [filterMenuOpen]);

  // Global keyboard shortcut: Cmd+K / Ctrl+K to focus search input
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Distinct document types
  const documentTypes = useMemo(() => {
    const types = new Set();
    documents.forEach(d => {
      const t = d.category || d.type;
      if (t) types.add(t);
    });
    return Array.from(types).sort();
  }, [documents]);

  // Process search results with real filtering, sorting, and RBAC
  const effectiveUser = currentUser || currentRole;
  const filteredResults = useMemo(() => {
    return filterAndSortSearchResults(
      documents,
      cases,
      query,
      {
        caseFilter,
        typeFilter,
        classificationFilter,
        statusFilter
      },
      sortOption,
      effectiveUser
    );
  }, [documents, cases, query, caseFilter, typeFilter, classificationFilter, statusFilter, sortOption, effectiveUser]);

  // Active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (caseFilter !== 'ALL') count++;
    if (typeFilter !== 'ALL') count++;
    if (classificationFilter !== 'ALL') count++;
    if (statusFilter !== 'ALL') count++;
    return count;
  }, [caseFilter, typeFilter, classificationFilter, statusFilter]);

  const resetFilters = () => {
    setQuery('');
    setCaseFilter('ALL');
    setTypeFilter('ALL');
    setClassificationFilter('ALL');
    setStatusFilter('ALL');
    setSortOption('relevance');
  };

  const handleDocumentClick = (doc) => {
    if (onViewDocument) {
      onViewDocument(doc, doc.caseItem);
    }
  };

  const handleCaseClick = (e, caseItem) => {
    e.stopPropagation();
    if (onSelectCase && caseItem) {
      onSelectCase(caseItem);
    }
  };

  const isPreSearch = !query.trim() && activeFiltersCount === 0;

  return (
    <div className="space-y-4">
      {/* 1. COMPACT PAGE HEADER */}
      <div className="pb-3 border-b border-slate-200">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 flex items-center gap-2">
          <Search className="w-5 h-5 text-blue-600" />
          Search
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Find documents and evidence across authorized cases.
        </p>
      </div>

      {/* 2. PRIMARY SEARCH CONTROL */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search documents, cases, filenames, OCR text, or hash..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-9 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-2xs transition-colors"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            title="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 3. TOOLBAR: FILTERS, SORT, RESULTS SUMMARY */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center space-x-2">
          {/* Filters Popover Button */}
          <div className="relative" ref={filterMenuRef}>
            <button
              onClick={() => setFilterMenuOpen(prev => !prev)}
              className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                activeFiltersCount > 0 || filterMenuOpen
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filters</span>
              {activeFiltersCount > 0 && (
                <span className="bg-blue-600 text-white text-[10px] font-semibold px-1.5 py-0.2 rounded-full">
                  {activeFiltersCount}
                </span>
              )}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${filterMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Filter Popover Menu */}
            {filterMenuOpen && (
              <div className="absolute left-0 mt-1.5 w-[calc(100vw-32px)] sm:w-72 max-w-sm bg-white border border-slate-200 rounded-xl shadow-lg z-30 p-4 space-y-3.5 text-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="font-semibold text-slate-900">Filter Documents</span>
                  {activeFiltersCount > 0 && (
                    <button
                      onClick={resetFilters}
                      className="text-[11px] text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset All</span>
                    </button>
                  )}
                </div>

                {/* Case Filter */}
                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">
                    Case Dossier
                  </label>
                  <select
                    value={caseFilter}
                    onChange={(e) => setCaseFilter(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-md py-1.5 px-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  >
                    <option value="ALL">All Cases</option>
                    {cases.map(c => (
                      <option key={c.id} value={c.caseNumber}>
                        {formatCaseId(c.caseNumber)}: {c.title?.slice(0, 30)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Document Type Filter */}
                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">
                    Document Type
                  </label>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-md py-1.5 px-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  >
                    <option value="ALL">All Types</option>
                    {documentTypes.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {/* Security Clearance Filter */}
                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">
                    Security Clearance
                  </label>
                  <select
                    value={classificationFilter}
                    onChange={(e) => setClassificationFilter(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-md py-1.5 px-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  >
                    <option value="ALL">All Levels</option>
                    <option value="Confidential">Confidential</option>
                    <option value="Secret">Secret</option>
                    <option value="Top Secret">Top Secret</option>
                  </select>
                </div>

                {/* Integrity Status Filter */}
                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">
                    Integrity Status
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-md py-1.5 px-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="VERIFIED">Verified (Intact)</option>
                    <option value="TAMPERED">Tamper Flagged (Mismatch)</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Sort Dropdown */}
          <div className="relative">
            <select
              aria-label="Sort search results"
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg py-1.5 pl-2.5 pr-7 text-xs text-slate-700 font-medium focus:outline-none focus:border-blue-500 cursor-pointer appearance-none"
            >
              {query && <option value="relevance">Sort: Relevance</option>}
              <option value="newest">Sort: Newest</option>
              <option value="oldest">Sort: Oldest</option>
              <option value="name">Sort: Filename (A-Z)</option>
              <option value="caseId">Sort: Case ID</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Factual Result Count */}
        <div className="text-xs text-slate-500 font-mono">
          {!isPreSearch && (
            <span>
              {filteredResults.length} {filteredResults.length === 1 ? 'matching document' : 'matching documents'}
            </span>
          )}
        </div>
      </div>

      {/* Active Filter Chips */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-[11px] text-slate-500">Active filters:</span>
          {caseFilter !== 'ALL' && (
            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px]">
              Case: #{caseFilter}
              <button onClick={() => setCaseFilter('ALL')} className="hover:text-slate-900">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {typeFilter !== 'ALL' && (
            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px]">
              Type: {typeFilter}
              <button onClick={() => setTypeFilter('ALL')} className="hover:text-slate-900">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {classificationFilter !== 'ALL' && (
            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px]">
              Clearance: {classificationFilter}
              <button onClick={() => setClassificationFilter('ALL')} className="hover:text-slate-900">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {statusFilter !== 'ALL' && (
            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px]">
              Status: {statusFilter === 'VERIFIED' ? 'Verified' : 'Tamper Flagged'}
              <button onClick={() => setStatusFilter('ALL')} className="hover:text-slate-900">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          <button
            onClick={resetFilters}
            className="text-[11px] text-blue-600 hover:text-blue-800 font-medium ml-1"
          >
            Clear all
          </button>
        </div>
      )}

      {/* 4. RESULTS PRESENTATION: PRE-SEARCH, NO RESULTS, OR ENTERPRISE LIST */}
      {isPreSearch ? (
        /* PRE-SEARCH STATE */
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-2xs">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">Search documents and evidence</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 font-normal">
            Use keywords, case IDs, filenames, OCR text, or document metadata to find evidence across authorized cases.
          </p>
        </div>
      ) : filteredResults.length === 0 ? (
        /* NO RESULTS MATCH */
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-2xs">
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto mb-3">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">No matching documents</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4 font-normal">
            Try a different keyword or adjust your active filters.
          </p>
          <button
            onClick={resetFilters}
            className="inline-flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear Filters</span>
          </button>
        </div>
      ) : (
        /* ENTERPRISE RESULT LIST */
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs divide-y divide-slate-100">
          {filteredResults.map(doc => {
            const isTampered = doc.isTampered || doc.integrityStatus === 'MISMATCH';
            const caseIdFormatted = formatCaseId(doc.caseId);

            return (
              <div
                key={doc.id}
                onClick={() => handleDocumentClick(doc)}
                className="group p-4 hover:bg-slate-50/80 transition-colors cursor-pointer space-y-2.5"
                tabIndex={0}
                role="button"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleDocumentClick(doc);
                  }
                }}
              >
                {/* Header row: Case ID, Filename, Status, and Actions */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1.5 min-w-0 flex-1">
                    {/* Primary Filename */}
                    <div className="flex items-center gap-2">
                      <h3 className="text-[15px] font-semibold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                        {doc.name}
                      </h3>
                      {doc.mimeType && (
                        <span className="text-[10px] font-mono text-slate-500 uppercase bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200 shrink-0">
                          {doc.mimeType.split('/').pop().replace('vnd.openxmlformats-officedocument.presentationml.presentation', 'pptx').replace('vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx')}
                        </span>
                      )}
                    </div>

                    {/* Secondary metadata badges */}
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      {/* Case ID badge: clickable to open case */}
                      <button
                        onClick={(e) => handleCaseClick(e, doc.caseItem)}
                        title={`Open Case Dossier ${caseIdFormatted}`}
                        className="font-mono text-xs font-semibold text-blue-700 bg-blue-50/80 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded transition-colors"
                      >
                        {caseIdFormatted}
                      </button>

                      <span className="text-slate-400">•</span>

                      <span className="text-slate-600 font-medium">
                        {doc.category || doc.type || 'Document'}
                      </span>

                      <span className="text-slate-400">•</span>

                      <span className="font-mono text-slate-600 text-[11px] bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded">
                        {doc.currentVersion || 'V1'}
                      </span>

                      <span className="text-slate-400">•</span>

                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                        doc.classification === 'Top Secret' ? 'bg-red-50 text-red-700 border-red-200' :
                        doc.classification === 'Secret' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-blue-50 text-blue-700 border-blue-200'
                      }`}>
                        {doc.classification || 'Confidential'}
                      </span>

                      {/* Integrity Status Pill */}
                      {isTampered ? (
                        <span className="text-[10px] font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200 inline-flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-red-600" />
                          <span>⚠ Mismatch</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>✓ Verified</span>
                        </span>
                      )}
                    </div>

                    {/* Tertiary metadata */}
                    <div className="text-xs text-slate-500 font-normal">
                      Uploaded by <span className="font-medium text-slate-700">{doc.createdBy || doc.uploadedBy || 'Authorized Officer'}</span> on {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : (doc.uploadDate || 'Recent')} • Size: <span className="font-mono">{doc.size ? `${(doc.size / 1024).toFixed(1)} KB` : (doc.fileSize || 'N/A')}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-1.5 shrink-0 self-start sm:self-center">
                    {doc.caseItem && (
                      <button
                        onClick={(e) => handleCaseClick(e, doc.caseItem)}
                        title="Open Case Dossier"
                        className="inline-flex items-center space-x-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                      >
                        <FolderGit2 className="w-3.5 h-3.5 text-slate-500" />
                        <span>Case</span>
                      </button>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDocumentClick(doc);
                      }}
                      className="inline-flex items-center space-x-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Open</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Match Reasons Tags (when search active) */}
                {query && doc.matchReasons && doc.matchReasons.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1 text-[11px]">
                    <span className="text-slate-400 font-medium mr-0.5">Matched in:</span>
                    {doc.matchReasons.map((reason, i) => (
                      <span
                        key={i}
                        className={`px-1.5 py-0.2 rounded font-medium border ${
                          reason === 'OCR Extracted Text'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : reason === 'Filename'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {reason}
                      </span>
                    ))}
                  </div>
                )}

                {/* OCR Contextual Snippet if matched in OCR */}
                {doc.ocrSnippet && (
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 space-y-1">
                    <div className="text-[10px] font-medium text-blue-700 uppercase tracking-wider">
                      OCR Text Match
                    </div>
                    <div className="font-mono text-xs leading-relaxed break-words text-slate-800">
                      <HighlightedSnippet text={doc.ocrSnippet} query={query} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
