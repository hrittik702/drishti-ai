import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  FolderGit2,
  FolderPlus,
  Search,
  X,
  SlidersHorizontal,
  ChevronRight,
  ChevronDown,
  Lock,
  FileText,
  Calendar,
  Building,
  Scale,
  Eye,
  Copy,
  Check,
  RotateCcw,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import {
  formatCaseId,
  getCasePriority,
  getCaseStatus,
  formatCaseDate,
  getCaseDocumentCount,
  filterAndSortCases
} from '../utils/caseUtils.js';
import { SharingService } from '../services/sharingService.js';

export default function CasesView({
  cases = [],
  documents = [],
  currentUser = null,
  currentRole = null,
  onSelectCase,
  onOpenCreateCase,
  loading = false
}) {
  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [accessFilter, setAccessFilter] = useState('ALL');
  const [sortOption, setSortOption] = useState('updated');

  // UI Control States
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [inspectingCase, setInspectingCase] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const filterMenuRef = useRef(null);

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

  // Dynamic distinct case types for filter
  const caseTypes = useMemo(() => {
    const types = new Set();
    cases.forEach(c => {
      if (c && c.type) types.add(c.type);
    });
    return Array.from(types).sort();
  }, [cases]);

  // Filtered & Sorted Cases
  const filteredCases = useMemo(() => {
    return filterAndSortCases(
      cases,
      documents,
      {
        search: searchTerm,
        status: statusFilter,
        priority: priorityFilter,
        type: typeFilter,
        access: accessFilter
      },
      sortOption,
      currentUser || currentRole
    );
  }, [cases, documents, searchTerm, statusFilter, priorityFilter, typeFilter, accessFilter, sortOption, currentUser, currentRole]);

  // Active filter count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== 'ALL') count++;
    if (priorityFilter !== 'ALL') count++;
    if (typeFilter !== 'ALL') count++;
    if (accessFilter !== 'ALL') count++;
    return count;
  }, [statusFilter, priorityFilter, typeFilter, accessFilter]);

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setPriorityFilter('ALL');
    setTypeFilter('ALL');
    setAccessFilter('ALL');
  };

  const handleCopyId = (e, caseNumber) => {
    e.stopPropagation();
    const formatted = formatCaseId(caseNumber);
    navigator.clipboard?.writeText(formatted);
    setCopiedId(caseNumber);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleRowClick = (c) => {
    if (onSelectCase) {
      onSelectCase(c);
    }
  };

  const handleInspect = (e, c) => {
    e.stopPropagation();
    setInspectingCase(c);
  };

  return (
    <div className="space-y-4">
      {/* 1. COMPACT PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 flex items-center gap-2">
            <FolderGit2 className="w-5 h-5 text-blue-600" />
            Cases
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage investigation and legal case dossiers.
          </p>
        </div>

        <button
          onClick={onOpenCreateCase}
          className="inline-flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-lg text-xs font-semibold shadow-xs transition-colors self-start sm:self-auto focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
        >
          <FolderPlus className="w-4 h-4" />
          <span>Create Case</span>
        </button>
      </div>

      {/* 2. COMPACT SEARCH & FILTER TOOLBAR */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          {/* Left: Search input */}
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by Case ID, title, statute, station, or officer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-8 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Right: Filters, Sort, and Status */}
          <div className="flex items-center space-x-2 shrink-0">
            {/* Filter Popover Button */}
            <div className="relative" ref={filterMenuRef}>
              <button
                onClick={() => setFilterMenuOpen(prev => !prev)}
                className={`inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                  activeFiltersCount > 0 || filterMenuOpen
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
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
                <div className="absolute right-0 mt-1.5 w-[calc(100vw-32px)] sm:w-72 max-w-sm bg-white border border-slate-200 rounded-xl shadow-lg z-30 p-4 space-y-3.5 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="font-semibold text-slate-900">Filter Cases</span>
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

                  {/* Priority Filter */}
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 block mb-1">
                      Priority Level
                    </label>
                    <select
                      value={priorityFilter}
                      onChange={(e) => setPriorityFilter(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-md py-1.5 px-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                    >
                      <option value="ALL">All Priorities</option>
                      <option value="Critical">Critical</option>
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>

                  {/* Status Filter */}
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 block mb-1">
                      Lifecycle Status
                    </label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-md py-1.5 px-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="Active Investigation">Active Investigation</option>
                      <option value="Under Investigation">Under Investigation</option>
                      <option value="Charge Sheet Filed">Charge Sheet Filed</option>
                      <option value="In Trial">In Trial</option>
                      <option value="Pending Review">Pending Review</option>
                      <option value="Closed">Closed</option>
                    </select>
                  </div>

                  {/* Case Type Filter */}
                  {caseTypes.length > 0 && (
                    <div>
                      <label className="text-[11px] font-medium text-slate-600 block mb-1">
                        Case Classification Type
                      </label>
                      <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-md py-1.5 px-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                      >
                        <option value="ALL">All Case Types</option>
                        {caseTypes.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* RBAC Access Filter */}
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 block mb-1">
                      Clearance & Assignment Access
                    </label>
                    <select
                      value={accessFilter}
                      onChange={(e) => setAccessFilter(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-md py-1.5 px-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                    >
                      <option value="ALL">All Dossiers</option>
                      <option value="ACCESSIBLE">Accessible to My Role</option>
                      <option value="RESTRICTED">Restricted (Requires Assignment)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Sort Dropdown */}
            <div className="relative">
              <select
                aria-label="Sort cases"
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg py-2 pl-3 pr-8 text-xs text-slate-700 font-medium focus:outline-none focus:border-blue-500 cursor-pointer appearance-none"
              >
                <option value="updated">Recently Updated</option>
                <option value="created">Recently Created</option>
                <option value="id">Case ID</option>
                <option value="name">Name (A-Z)</option>
                <option value="priority">Priority (High-Low)</option>
                <option value="records">Most Records</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Result count */}
            <span className="text-[11px] text-slate-500 font-mono hidden sm:inline pl-1">
              {filteredCases.length} {filteredCases.length === 1 ? 'case' : 'cases'}
            </span>
          </div>
        </div>

        {/* Active Filter Chips */}
        {(searchTerm || activeFiltersCount > 0) && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2.5 mt-2.5 border-t border-slate-100 text-xs">
            <span className="text-[11px] text-slate-500">Active filters:</span>
            {searchTerm && (
              <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px]">
                Search: "{searchTerm}"
                <button onClick={() => setSearchTerm('')} className="hover:text-slate-900">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {priorityFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px]">
                Priority: {priorityFilter}
                <button onClick={() => setPriorityFilter('ALL')} className="hover:text-slate-900">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {statusFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px]">
                Status: {statusFilter}
                <button onClick={() => setStatusFilter('ALL')} className="hover:text-slate-900">
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
            {accessFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px]">
                Access: {accessFilter === 'ACCESSIBLE' ? 'Accessible' : 'Restricted'}
                <button onClick={() => setAccessFilter('ALL')} className="hover:text-slate-900">
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
      </div>

      {/* 3. CASE PRESENTATION: SKELETON, EMPTY, OR DENSE TABLE */}
      {loading ? (
        /* LOADING SKELETON */
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4].map(idx => (
              <div key={idx} className="animate-pulse flex items-center justify-between gap-4 py-3 border-b border-slate-100 last:border-0">
                <div className="flex items-center space-x-3 w-1/4">
                  <div className="h-6 w-24 bg-slate-200 rounded"></div>
                </div>
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 w-3/4 bg-slate-200 rounded"></div>
                  <div className="h-3 w-1/2 bg-slate-100 rounded"></div>
                </div>
                <div className="h-5 w-20 bg-slate-100 rounded-full"></div>
                <div className="h-4 w-16 bg-slate-100 rounded"></div>
                <div className="h-4 w-20 bg-slate-100 rounded"></div>
                <div className="h-8 w-16 bg-slate-200 rounded-md"></div>
              </div>
            ))}
          </div>
        </div>
      ) : cases.length === 0 ? (
        /* EMPTY STATE: 0 CASES IN REPO */
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-2xs">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
            <FolderGit2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">No cases found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            Create a case dossier to begin organizing documents and evidence with cryptographic integrity.
          </p>
          <button
            onClick={onOpenCreateCase}
            className="inline-flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <FolderPlus className="w-4 h-4" />
            <span>Create Case</span>
          </button>
        </div>
      ) : filteredCases.length === 0 ? (
        /* EMPTY STATE: 0 FILTER MATCHES */
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-2xs">
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto mb-3">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">No matching cases</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            No case dossiers match your current search query or active filter settings.
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
        /* DENSE TABLE PRESENTATION (DESKTOP) + STACKED CARDS (MOBILE) */
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-mono font-semibold text-slate-500 uppercase tracking-wider">
                  <th scope="col" className="py-2.5 px-4 w-36">Case ID</th>
                  <th scope="col" className="py-2.5 px-4">Case Name</th>
                  <th scope="col" className="py-2.5 px-4 w-44">Status / Priority</th>
                  <th scope="col" className="py-2.5 px-4 w-28 text-center">Records</th>
                  <th scope="col" className="py-2.5 px-4 w-36">Updated</th>
                  <th scope="col" className="py-2.5 px-4 w-28 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredCases.map(c => {
                  const docCount = getCaseDocumentCount(c, documents);
                  const hasCaseAccess = SharingService.canUserAccessCase(currentUser || currentRole, c);
                  const priority = getCasePriority(c.priority);
                  const status = getCaseStatus(c.status);
                  const caseIdFormatted = formatCaseId(c.caseNumber);

                  return (
                    <tr
                      key={c.id}
                      onClick={() => handleRowClick(c)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleRowClick(c);
                        }
                      }}
                      tabIndex={0}
                      className={`group transition-colors cursor-pointer hover:bg-slate-50/80 focus:bg-slate-50/90 focus:outline-none ${
                        !hasCaseAccess ? 'bg-slate-50/30' : ''
                      }`}
                    >
                      {/* Case ID */}
                      <td className="py-3 px-4 font-mono font-medium text-slate-800 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <span className="text-blue-700 bg-blue-50/70 border border-blue-200/60 px-2 py-0.5 rounded text-[11px]">
                            {caseIdFormatted}
                          </span>
                          <button
                            onClick={(e) => handleCopyId(e, c.caseNumber)}
                            title="Copy Case Identifier"
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-slate-400 hover:text-slate-600 rounded"
                          >
                            {copiedId === c.caseNumber ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Case Name & Snippet */}
                      <td className="py-3 px-4 min-w-[220px]">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                            {c.title}
                          </span>
                          {c.type && (
                            <span className="text-[10px] font-normal text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded shrink-0">
                              {c.type}
                            </span>
                          )}
                        </div>
                        {(c.description || c.summary) && (
                          <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5 font-normal">
                            {c.description || c.summary}
                          </p>
                        )}
                      </td>

                      {/* Status / Priority */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {/* Priority Indicator */}
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${priority.badgeClass}`}>
                            {priority.label}
                          </span>

                          {/* Lifecycle Status */}
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${status.badgeClass}`}>
                            {status.label}
                          </span>

                          {/* Restricted Alert if not assigned */}
                          {!hasCaseAccess && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-0.5">
                              <Lock className="w-2.5 h-2.5" />
                              <span>Restricted</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Records */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span className="font-mono text-xs font-medium text-slate-700 bg-slate-100/70 border border-slate-200/50 px-2 py-0.5 rounded">
                          {docCount}
                        </span>
                      </td>

                      {/* Updated Timestamp */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-slate-500">
                        {formatCaseDate(c.updatedAt || c.lastActivity || c.createdAt || c.createdDate)}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center space-x-1.5">
                          <button
                            onClick={(e) => handleInspect(e, c)}
                            title="Quick Case Summary"
                            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRowClick(c);
                            }}
                            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                              hasCaseAccess
                                ? 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                            }`}
                          >
                            <span>{hasCaseAccess ? 'Open' : 'Restricted'}</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Stacked List View (< 768px) */}
          <div className="md:hidden divide-y divide-slate-100">
            {filteredCases.map(c => {
              const docCount = getCaseDocumentCount(c, documents);
              const hasCaseAccess = SharingService.canUserAccessCase(currentUser || currentRole, c);
              const priority = getCasePriority(c.priority);
              const status = getCaseStatus(c.status);
              const caseIdFormatted = formatCaseId(c.caseNumber);

              return (
                <div
                  key={c.id}
                  onClick={() => handleRowClick(c)}
                  className="p-4 space-y-2 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  {/* Top row: Case ID + Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                      {caseIdFormatted}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${priority.badgeClass}`}>
                        {priority.label}
                      </span>
                      {!hasCaseAccess && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-0.5">
                          <Lock className="w-2.5 h-2.5" />
                          <span>Restricted</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      {c.title}
                    </h3>
                    {(c.description || c.summary) && (
                      <p className="text-xs text-slate-500 line-clamp-2 mt-0.5 font-normal">
                        {c.description || c.summary}
                      </p>
                    )}
                  </div>

                  {/* Bottom row: Records + Updated + Open button */}
                  <div className="pt-2 flex items-center justify-between border-t border-slate-100 text-xs">
                    <div className="flex items-center space-x-3 text-slate-500 font-mono text-[11px]">
                      <span>{docCount} records</span>
                      <span>•</span>
                      <span>{formatCaseDate(c.updatedAt || c.lastActivity || c.createdAt)}</span>
                    </div>

                    <span className={`font-semibold flex items-center gap-0.5 text-xs ${hasCaseAccess ? 'text-blue-600' : 'text-slate-500'}`}>
                      <span>{hasCaseAccess ? 'Open' : 'Restricted'}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. SLIDE-OVER CASE INSPECTOR DRAWER (BOTTOM SHEET ON MOBILE) */}
      {inspectingCase && (
        <div 
          className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end items-end sm:items-stretch"
          onClick={() => setInspectingCase(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:w-[440px] bg-white h-[88vh] sm:h-full rounded-t-2xl sm:rounded-none shadow-2xl border-t sm:border-t-0 sm:border-l border-slate-200 flex flex-col justify-between animate-in slide-in-from-bottom sm:slide-in-from-right duration-200"
            role="dialog"
            aria-modal="true"
            aria-label="Case Details"
          >
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70 shrink-0">
              <div className="flex items-center space-x-2">
                <span className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                  {formatCaseId(inspectingCase.caseNumber)}
                </span>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${getCasePriority(inspectingCase.priority).badgeClass}`}>
                  {inspectingCase.priority}
                </span>
              </div>
              <button
                onClick={() => setInspectingCase(null)}
                className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                aria-label="Close dialog"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div>
                <h2 className="text-base font-semibold text-slate-900 leading-snug">
                  {inspectingCase.title}
                </h2>
                {inspectingCase.type && (
                  <span className="inline-block mt-1 text-[11px] font-medium text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                    {inspectingCase.type}
                  </span>
                )}
              </div>

              {/* Status & Record Count */}
              <div className="grid grid-cols-2 gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div>
                  <span className="text-[11px] text-slate-500 font-medium block">Lifecycle Status</span>
                  <span className="font-semibold text-slate-800">
                    {inspectingCase.status || 'Active Investigation'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 font-medium block">Document Records</span>
                  <span className="font-semibold font-mono text-slate-800">
                    {getCaseDocumentCount(inspectingCase, documents)} records
                  </span>
                </div>
              </div>

              {/* Case Summary / Description */}
              {(inspectingCase.description || inspectingCase.summary) && (
                <div>
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Summary & Scope
                  </h4>
                  <p className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-3 leading-relaxed font-normal">
                    {inspectingCase.description || inspectingCase.summary}
                  </p>
                </div>
              )}

              {/* Statutory Acts & Sections */}
              {Array.isArray(inspectingCase.acts) && inspectingCase.acts.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1">
                    <Scale className="w-3.5 h-3.5 text-slate-400" />
                    <span>Statutory Provisions</span>
                  </h4>
                  <div className="space-y-1">
                    {inspectingCase.acts.map((act, idx) => (
                      <div key={idx} className="bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded text-[11px] text-slate-700">
                        § {act}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Police Station & Court */}
              {(inspectingCase.policeStation || inspectingCase.courtName) && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  {inspectingCase.policeStation && (
                    <div className="flex items-start gap-2 text-slate-600">
                      <Building className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-medium text-slate-700 block">Precinct / Station</span>
                        <span className="text-slate-500">{inspectingCase.policeStation}</span>
                      </div>
                    </div>
                  )}
                  {inspectingCase.courtName && (
                    <div className="flex items-start gap-2 text-slate-600">
                      <Scale className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-medium text-slate-700 block">Jurisdictional Court</span>
                        <span className="text-slate-500">{inspectingCase.courtName}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Assigned Officers */}
              {Array.isArray(inspectingCase.assignedOfficers) && inspectingCase.assignedOfficers.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                    <span>Assigned Officers & Counsel</span>
                  </h4>
                  <div className="space-y-1">
                    {inspectingCase.assignedOfficers.map((officer, idx) => (
                      <div key={idx} className="text-slate-700 text-[11px]">
                        • {officer}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between gap-3">
              <button
                onClick={() => setInspectingCase(null)}
                className="px-3 py-2 border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-medium transition-colors"
              >
                Close Preview
              </button>
              <button
                onClick={() => {
                  const target = inspectingCase;
                  setInspectingCase(null);
                  handleRowClick(target);
                }}
                className="flex-1 inline-flex items-center justify-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-xs transition-colors"
              >
                <span>Open Case Dossier</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
