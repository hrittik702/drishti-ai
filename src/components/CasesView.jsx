import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Building2,
  Plus,
  Search,
  X,
  SlidersHorizontal,
  ChevronRight,
  ChevronDown,
  Camera,
  Calendar,
  Eye,
  Copy,
  Check,
  RotateCcw,
  ShieldCheck,
  AlertTriangle,
  UserCheck,
  Cpu,
  Activity,
  MapPin,
  Clock
} from 'lucide-react';
import {
  formatCentreCode,
  getComplianceStatusBadge,
  getSeverityBadge,
  formatCentreDate,
  filterAndSortCentres
} from '../utils/centreUtils.js';
import {
  formatCaseId,
  getCasePriority,
  getCaseStatus,
  formatCaseDate as formatCaseDateOld
} from '../utils/caseUtils.js';
import { SharingService } from '../services/sharingService.js';

export default function CasesView({
  cases = [],
  centres = [],
  documents = [],
  complianceEvents = [],
  currentUser = null,
  currentRole = null,
  onSelectCase,
  onSelectCentre,
  onOpenCreateCase,
  onOpenRegisterCentre,
  loading = false
}) {
  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [schemeFilter, setSchemeFilter] = useState('ALL');
  const [issueTypeFilter, setIssueTypeFilter] = useState('ALL');
  const [sortOption, setSortOption] = useState('updated');

  // UI Control States
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [inspectingCentre, setInspectingCentre] = useState(null);
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

  // Unify centres list
  const allCentres = useMemo(() => {
    if (centres && centres.length > 0) return centres;
    if (cases && cases.length > 0) {
      return cases.map(c => ({
        id: c.id,
        centreCode: c.centreCode || c.caseNumber || c.id,
        name: c.name || c.title,
        scheme: c.scheme || c.type || 'PMKVY 4.0',
        sector: c.sector || 'Skill Development',
        location: c.location || { state: 'Delhi', district: 'South Delhi', address: c.address || 'Training Campus' },
        assignedOfficer: c.assignedOfficer || (Array.isArray(c.assignedOfficers) ? c.assignedOfficers[0] : 'Inspector Vikram Rathore'),
        complianceStatus: c.complianceStatus || (c.priority === 'Critical' ? 'CRITICAL' : c.priority === 'High' ? 'ATTENTION' : 'COMPLIANT'),
        priority: c.priority || 'Medium',
        activeBatch: c.activeBatch || {
          batchId: `BATCH-${c.caseNumber || '01'}`,
          courseName: c.type || 'Technical Training Course',
          enrolledCount: 25,
          startTime: '09:00',
          endTime: '17:00'
        },
        currentSession: c.currentSession || {
          sessionId: 'SES-01',
          topic: c.summary ? c.summary.slice(0, 60) + '...' : 'Interactive Lab Practical',
          trainerName: 'Master Trainer',
          status: 'In Progress'
        },
        attendance: c.attendance || { declaredExpected: 25, detectedByAI: 22, difference: -3, discrepancyRate: 12.0, status: 'MISMATCH' },
        infrastructure: c.infrastructure || { totalRequired: 5, totalDetected: 5, status: 'ADEQUATE', items: [] },
        edgeHealth: c.edgeHealth || { cameraCount: 3, camerasOnline: 3, camerasOffline: 0, edgeStatus: 'ONLINE', fps: 20 },
        recentAlertsCount: c.isTampered ? 1 : 0,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt || c.lastActivity
      }));
    }
    return [];
  }, [centres, cases]);

  // Dynamic distinct schemes for filter
  const distinctSchemes = useMemo(() => {
    const set = new Set();
    allCentres.forEach(c => {
      if (c && c.scheme) set.add(c.scheme);
    });
    return Array.from(set).sort();
  }, [allCentres]);

  // Filtered & Sorted Centres
  const filteredCentres = useMemo(() => {
    return filterAndSortCentres(
      allCentres,
      {
        search: searchTerm,
        status: statusFilter,
        scheme: schemeFilter,
        issueType: issueTypeFilter
      },
      sortOption
    );
  }, [allCentres, searchTerm, statusFilter, schemeFilter, issueTypeFilter, sortOption]);

  // Active filter count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== 'ALL') count++;
    if (schemeFilter !== 'ALL') count++;
    if (issueTypeFilter !== 'ALL') count++;
    return count;
  }, [statusFilter, schemeFilter, issueTypeFilter]);

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setSchemeFilter('ALL');
    setIssueTypeFilter('ALL');
  };

  const handleCopyId = (e, code) => {
    e.stopPropagation();
    const formatted = formatCentreCode(code);
    navigator.clipboard?.writeText(formatted);
    setCopiedId(code);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleRowClick = (c) => {
    if (onSelectCentre) {
      onSelectCentre(c);
    } else if (onSelectCase) {
      onSelectCase(c);
    }
  };

  const handleInspect = (e, c) => {
    e.stopPropagation();
    setInspectingCentre(c);
  };

  const handleOpenRegister = () => {
    if (onOpenRegisterCentre) {
      onOpenRegisterCentre();
    } else if (onOpenCreateCase) {
      onOpenCreateCase();
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. COMPACT PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            Training Centres
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor training centre compliance, attendance congruence, and facility equipment via Edge AI.
          </p>
        </div>

        <button
          onClick={handleOpenRegister}
          className="inline-flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-lg text-xs font-semibold shadow-xs transition-colors self-start sm:self-auto focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
        >
          <Plus className="w-4 h-4" />
          <span>Onboard Centre</span>
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
              placeholder="Search by centre code, name, scheme, district, course, or inspector..."
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

              {/* Filter Popover Menu (Class required for responsive test: w-[calc(100vw-32px)] sm:w-72 max-w-sm) */}
              {filterMenuOpen && (
                <div className="absolute right-0 mt-1.5 w-[calc(100vw-32px)] sm:w-72 max-w-sm bg-white border border-slate-200 rounded-xl shadow-lg z-30 p-4 space-y-3.5 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="font-semibold text-slate-900">Filter Centres</span>
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

                  {/* Compliance Status Filter */}
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 block mb-1">
                      Compliance Status
                    </label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-md py-1.5 px-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="COMPLIANT">Compliant</option>
                      <option value="ATTENTION">Attention Required</option>
                      <option value="CRITICAL">Critical Discrepancy</option>
                      <option value="OFFLINE">Edge Offline</option>
                    </select>
                  </div>

                  {/* Scheme Filter */}
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 block mb-1">
                      Training Scheme
                    </label>
                    <select
                      value={schemeFilter}
                      onChange={(e) => setSchemeFilter(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-md py-1.5 px-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                    >
                      <option value="ALL">All Schemes</option>
                      {distinctSchemes.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  {/* Issue Type Filter */}
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 block mb-1">
                      Discrepancy Category
                    </label>
                    <select
                      value={issueTypeFilter}
                      onChange={(e) => setIssueTypeFilter(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-md py-1.5 px-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                    >
                      <option value="ALL">All Categories</option>
                      <option value="ATTENDANCE">Attendance Deficit (&gt;10%)</option>
                      <option value="INFRASTRUCTURE">Infrastructure Deficient</option>
                      <option value="CAMERA_OFFLINE">Camera / Edge Offline</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Sort Dropdown */}
            <div className="relative">
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg py-2 pl-2.5 pr-7 focus:outline-none focus:border-blue-500 cursor-pointer font-medium appearance-none"
              >
                <option value="updated">Recently Verified</option>
                <option value="status">Compliance Severity</option>
                <option value="discrepancy">Discrepancy Rate</option>
                <option value="name">Centre Name</option>
                <option value="code">Centre Code</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* 3. DESKTOP TRAINING CENTRES DATA TABLE (hidden on mobile, visible md+) */}
      <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4 font-semibold">Training Centre</th>
                <th className="py-3 px-3 font-semibold">Active Batch</th>
                <th className="py-3 px-3 font-semibold">Attendance</th>
                <th className="py-3 px-3 font-semibold">Infrastructure</th>
                <th className="py-3 px-3 font-semibold">Edge Cameras</th>
                <th className="py-3 px-3 font-semibold">Compliance</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-500">
                    Loading training centre records...
                  </td>
                </tr>
              ) : filteredCentres.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-500">
                    <Building2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <span className="font-semibold block text-slate-800">No training centres found</span>
                    <span className="text-xs text-slate-500">Try adjusting your search criteria or clearing filters.</span>
                  </td>
                </tr>
              ) : (
                filteredCentres.map((centre) => {
                  const statusBadge = getComplianceStatusBadge(centre.complianceStatus);
                  const attDiff = centre.attendance?.difference ?? 0;
                  const attRate = centre.attendance?.discrepancyRate ?? 0;
                  const camsOnline = centre.edgeHealth?.camerasOnline ?? 0;
                  const camsTotal = centre.edgeHealth?.cameraCount ?? 0;

                  return (
                    <tr
                      key={centre.id || centre.centreCode}
                      onClick={() => handleRowClick(centre)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      {/* 1. Training Centre Name, Location, Scheme & Code */}
                      <td className="py-3 px-4 max-w-sm">
                        <div className="font-semibold text-sm text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                          {centre.name}
                        </div>
                        <div className="text-[12px] text-slate-500 flex items-center gap-1.5 mt-0.5 truncate font-normal">
                          <span className="truncate">{centre.location?.district}, {centre.location?.state}</span>
                          <span>•</span>
                          <span className="text-slate-600 font-medium truncate max-w-[130px]">{centre.scheme}</span>
                          <span>•</span>
                          <span className="font-mono text-slate-600 bg-slate-100 border border-slate-200 px-1 py-0.2 rounded text-[11px]">
                            {formatCentreCode(centre.centreCode || centre.id)}
                          </span>
                          <button
                            onClick={(e) => handleCopyId(e, centre.centreCode || centre.id)}
                            className="text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors inline-flex items-center"
                            title="Copy Centre ID"
                          >
                            {copiedId === (centre.centreCode || centre.id) ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* 2. Active Batch */}
                      <td className="py-3 px-3 max-w-[180px]">
                        <div className="text-xs text-slate-800 font-medium truncate">
                          {centre.activeBatch?.courseName || 'General Vocational'}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {centre.activeBatch?.enrolledCount || 0} Enrolled
                        </div>
                      </td>

                      {/* 4. Attendance (AI vs Declared) */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-mono font-semibold text-xs text-slate-900">
                            {centre.attendance?.detectedByAI ?? 0}
                          </span>
                          <span className="text-slate-400 font-mono text-xs">/</span>
                          <span className="font-mono text-xs text-slate-600">
                            {centre.attendance?.declaredExpected ?? 0}
                          </span>
                          {attDiff < 0 ? (
                            <span className="text-[11px] font-mono font-semibold text-red-600 bg-red-50 px-1 py-0.2 rounded border border-red-200">
                              {attDiff} ({attRate}%)
                            </span>
                          ) : (
                            <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                              100%
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 5. Infrastructure */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                          centre.infrastructure?.status === 'ADEQUATE'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {centre.infrastructure?.totalDetected ?? 0} / {centre.infrastructure?.totalRequired ?? 0} Items
                        </span>
                      </td>

                      {/* 6. Edge & Camera Status */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {centre.complianceStatus === 'OFFLINE' ? (
                          <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 flex items-center gap-1 w-fit">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                            <span>Offline</span>
                          </span>
                        ) : (
                          <div className="flex items-center space-x-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span className="font-mono text-xs text-slate-700">
                              {camsOnline}/{camsTotal} Cams
                            </span>
                          </div>
                        )}
                      </td>

                      {/* 7. Compliance Status Badge */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${statusBadge.badgeClass}`}>
                          {statusBadge.label}
                        </span>
                      </td>

                      {/* 8. Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap space-x-1">
                        <button
                          onClick={(e) => handleInspect(e, centre)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          title="Quick Inspect"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRowClick(centre);
                          }}
                          className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                          title="Open Full Workspace"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. MOBILE STACKED CARDS VIEW (md:hidden) */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="p-8 bg-white border border-slate-200 rounded-xl text-center text-slate-500 text-xs">
            Loading centres...
          </div>
        ) : filteredCentres.length === 0 ? (
          <div className="p-8 bg-white border border-slate-200 rounded-xl text-center text-slate-500 text-xs">
            No training centres match your filters.
          </div>
        ) : (
          filteredCentres.map((centre) => {
            const statusBadge = getComplianceStatusBadge(centre.complianceStatus);
            const attDiff = centre.attendance?.difference ?? 0;

            return (
              <div
                key={centre.id || centre.centreCode}
                onClick={() => handleRowClick(centre)}
                className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3 cursor-pointer hover:border-slate-300 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-slate-900 leading-snug">
                      {centre.name}
                    </h3>
                    <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                      <span>{centre.location?.district}</span>
                      <span>•</span>
                      <span className="text-slate-600 font-medium">{centre.scheme}</span>
                      <span>•</span>
                      <span className="font-mono text-slate-600 bg-slate-100 border border-slate-200 px-1 py-0.2 rounded text-[10px]">
                        {formatCentreCode(centre.centreCode || centre.id)}
                      </span>
                    </div>
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border shrink-0 ${statusBadge.badgeClass}`}>
                    {statusBadge.label}
                  </span>
                </div>

                <div className="text-xs text-slate-600">
                  <span className="font-medium text-slate-700">Batch: </span>
                  {centre.activeBatch?.courseName || 'General Vocational'}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-mono text-slate-400 block">Attendance</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {centre.attendance?.detectedByAI ?? 0} / {centre.attendance?.declaredExpected ?? 0}
                    </span>
                    {attDiff < 0 && (
                      <span className="text-[10px] text-red-600 font-mono ml-1 font-semibold">
                        ({attDiff})
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-mono text-slate-400 block">Cameras</span>
                    <span className="font-mono text-slate-700">
                      {centre.edgeHealth?.camerasOnline ?? 0}/{centre.edgeHealth?.cameraCount ?? 0} Online
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <span className="text-slate-500">{centre.assignedOfficer}</span>
                  <span className="text-blue-600 font-semibold inline-flex items-center gap-0.5">
                    Inspect <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 5. QUICK INSPECT SLIDE-OVER DRAWER (Bottom-sheet on mobile, sidebar on desktop) */}
      {/* Required test classes: items-end sm:items-stretch, h-[88vh] sm:h-full, rounded-t-2xl sm:rounded-none */}
      {inspectingCentre && (
        <div 
          onClick={() => setInspectingCentre(null)} 
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-2xs flex justify-end items-end sm:items-stretch"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:w-[440px] bg-white h-[88vh] sm:h-full rounded-t-2xl sm:rounded-none shadow-2xl border-t sm:border-t-0 sm:border-l border-slate-200 flex flex-col justify-between animate-in slide-in-from-bottom sm:slide-in-from-right duration-200"
            role="dialog"
            aria-modal="true"
            aria-label="Centre Details"
          >
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70 shrink-0">
              <div className="flex items-center space-x-2">
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${getComplianceStatusBadge(inspectingCentre.complianceStatus).badgeClass}`}>
                  {getComplianceStatusBadge(inspectingCentre.complianceStatus).label}
                </span>
                <span className="font-mono text-xs text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded">
                  {formatCentreCode(inspectingCentre.centreCode || inspectingCentre.id)}
                </span>
              </div>
              <button
                onClick={() => setInspectingCentre(null)}
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
                  {inspectingCentre.name}
                </h2>
                <div className="flex items-center gap-1.5 mt-1 text-slate-500 text-xs">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{inspectingCentre.location?.address || `${inspectingCentre.location?.district}, ${inspectingCentre.location?.state}`}</span>
                </div>
              </div>

              {/* Scheme & Sector Tag */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
                <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                  Accreditation & Scheme
                </div>
                <div className="font-semibold text-slate-800 text-xs">
                  {inspectingCentre.scheme}
                </div>
                <div className="text-slate-600 text-[11px]">
                  Sector: {inspectingCentre.sector || 'Skill Development'}
                </div>
              </div>

              {/* Active Batch & Current Session */}
              {inspectingCentre.activeBatch && (
                <div className="border border-slate-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Active Batch
                    </span>
                    <span className="font-mono text-[11px] bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded">
                      {inspectingCentre.activeBatch.batchId}
                    </span>
                  </div>
                  <div className="font-semibold text-slate-900">
                    {inspectingCentre.activeBatch.courseName}
                  </div>
                  <div className="flex items-center justify-between text-slate-500 text-[11px]">
                    <span>Enrolled: <strong>{inspectingCentre.activeBatch.enrolledCount}</strong></span>
                    <span>Hours: <strong>{inspectingCentre.activeBatch.startTime} - {inspectingCentre.activeBatch.endTime}</strong></span>
                  </div>
                </div>
              )}

              {/* Attendance Discrepancy Breakdown */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Attendance Detection
                  </span>
                  <span className={`font-mono text-[11px] font-semibold px-1.5 py-0.2 rounded border ${
                    (inspectingCentre.attendance?.difference ?? 0) < 0 
                      ? 'bg-red-50 text-red-700 border-red-200' 
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}>
                    {(inspectingCentre.attendance?.difference ?? 0) < 0 ? 'DEFICIT DETECTED' : 'CONGRUENT'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center pt-1">
                  <div className="bg-white border border-slate-200 rounded p-1.5">
                    <span className="text-[10px] text-slate-400 block font-mono">DECLARED</span>
                    <span className="text-base font-semibold font-mono text-slate-800">
                      {inspectingCentre.attendance?.declaredExpected ?? 0}
                    </span>
                  </div>
                  <div className="bg-white border border-slate-200 rounded p-1.5">
                    <span className="text-[10px] text-slate-400 block font-mono">AI DETECTED</span>
                    <span className="text-base font-semibold font-mono text-blue-700">
                      {inspectingCentre.attendance?.detectedByAI ?? 0}
                    </span>
                  </div>
                  <div className="bg-white border border-slate-200 rounded p-1.5">
                    <span className="text-[10px] text-slate-400 block font-mono">DIFFERENCE</span>
                    <span className={`text-base font-semibold font-mono ${
                      (inspectingCentre.attendance?.difference ?? 0) < 0 ? 'text-red-600' : 'text-emerald-700'
                    }`}>
                      {inspectingCentre.attendance?.difference ?? 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* Edge Health Diagnostic */}
              {inspectingCentre.edgeHealth && (
                <div className="border border-slate-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                      <Cpu className="w-3.5 h-3.5 text-slate-400" />
                      <span>Edge Diagnostics</span>
                    </span>
                    <span className="font-mono text-[10px] text-slate-500">
                      {inspectingCentre.edgeHealth.edgeDeviceId}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                    <div>Status: <strong>{inspectingCentre.edgeHealth.edgeStatus}</strong></div>
                    <div>FPS: <strong>{inspectingCentre.edgeHealth.fps} fps</strong></div>
                    <div>Latency: <strong>{inspectingCentre.edgeHealth.latencyMs} ms</strong></div>
                    <div>Cameras: <strong>{inspectingCentre.edgeHealth.camerasOnline}/{inspectingCentre.edgeHealth.cameraCount} Online</strong></div>
                  </div>
                </div>
              )}

              {/* Assigned Officer */}
              {inspectingCentre.assignedOfficer && (
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-slate-600 text-xs">
                  <span className="text-slate-400 font-medium">Monitoring Inspector:</span>
                  <span className="font-semibold text-slate-800">{inspectingCentre.assignedOfficer}</span>
                </div>
              )}
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between gap-3">
              <button
                onClick={() => setInspectingCentre(null)}
                className="px-3 py-2 border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-medium transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const target = inspectingCentre;
                  setInspectingCentre(null);
                  handleRowClick(target);
                }}
                className="flex-1 inline-flex items-center justify-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-xs transition-colors"
              >
                <span>Open Centre Detail</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
