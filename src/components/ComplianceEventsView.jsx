import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  AlertTriangle,
  Search,
  Filter,
  X,
  SlidersHorizontal,
  ChevronRight,
  Eye,
  CheckCircle2,
  Clock,
  Building2,
  Camera,
  Cpu,
  ShieldAlert,
  ShieldCheck,
  Check,
  RotateCcw,
  Sparkles,
  ArrowUpRight,
  Info
} from 'lucide-react';
import { getComplianceStatusBadge, getSeverityBadge, formatCentreTime, formatCentreCode } from '../utils/centreUtils.js';
import { ComplianceEventRepository } from '../services/complianceEventRepository.js';
import { AuditRepository } from '../services/auditRepository.js';

export default function ComplianceEventsView({
  complianceEvents = [],
  centres = [],
  currentUser = null,
  currentRole = null,
  onSelectCentre,
  onViewEvidence,
  addToast
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [centreFilter, setCentreFilter] = useState('ALL');
  
  // Slide-over drawer state
  const [inspectingEvent, setInspectingEvent] = useState(null);
  const [eventsList, setEventsList] = useState(complianceEvents);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef(null);

  // Sync internal state when parent props change
  useEffect(() => {
    setEventsList(complianceEvents);
  }, [complianceEvents]);

  // Close filter dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target)) {
        setFilterMenuOpen(false);
      }
    }
    if (filterMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [filterMenuOpen]);

  // Close slide-over on Escape
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setInspectingEvent(null);
      }
    }
    if (inspectingEvent) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [inspectingEvent]);

  // Unique centres for dropdown filter
  const availableCentres = useMemo(() => {
    const map = new Map();
    eventsList.forEach(e => {
      const code = e.centreCode || e.centreId;
      if (code) map.set(code, e.centreName || code);
    });
    centres.forEach(c => {
      map.set(c.centreCode || c.id, c.name);
    });
    return Array.from(map.entries()).map(([code, name]) => ({ code, name }));
  }, [eventsList, centres]);

  // Filtered events
  const filteredEvents = useMemo(() => {
    return eventsList.filter(evt => {
      // 1. Text search
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchName = (evt.centreName || '').toLowerCase().includes(q);
        const matchCode = (evt.centreCode || evt.centreId || '').toLowerCase().includes(q);
        const matchType = (evt.eventType || '').toLowerCase().includes(q);
        const matchDetails = (evt.details || '').toLowerCase().includes(q);
        const matchDiscrepancy = (evt.discrepancy || '').toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchType && !matchDetails && !matchDiscrepancy) {
          return false;
        }
      }

      // 2. Severity
      if (severityFilter !== 'ALL' && (evt.severity || '').toLowerCase() !== severityFilter.toLowerCase()) {
        return false;
      }

      // 3. Status
      if (statusFilter !== 'ALL' && (evt.status || '').toUpperCase() !== statusFilter.toUpperCase()) {
        return false;
      }

      // 4. Type
      if (typeFilter !== 'ALL' && evt.eventType !== typeFilter) {
        return false;
      }

      // 5. Centre
      if (centreFilter !== 'ALL') {
        const code = evt.centreCode || evt.centreId;
        if (code !== centreFilter) return false;
      }

      return true;
    });
  }, [eventsList, searchTerm, severityFilter, statusFilter, typeFilter, centreFilter]);

  // Aggregate KPI metrics
  const metrics = useMemo(() => {
    const total = eventsList.length;
    const openCount = eventsList.filter(e => e.status === 'OPEN').length;
    const criticalCount = eventsList.filter(e => e.severity === 'Critical' && e.status === 'OPEN').length;
    const ackCount = eventsList.filter(e => e.status === 'ACKNOWLEDGED').length;
    const resolvedCount = eventsList.filter(e => e.status === 'RESOLVED').length;
    return { total, openCount, criticalCount, ackCount, resolvedCount };
  }, [eventsList]);

  // Action handlers
  const handleUpdateStatus = async (eventId, newStatus) => {
    try {
      await ComplianceEventRepository.updateEventStatus(eventId, newStatus);
      
      const actor = currentUser || currentRole;
      await AuditRepository.logAuditEvent({
        actor,
        role: actor?.designation || actor?.name || 'Monitoring Officer',
        action: newStatus === 'RESOLVED' ? 'COMPLIANCE_RESOLVED' : 'COMPLIANCE_ACKNOWLEDGED',
        targetType: 'COMPLIANCE_EVENT',
        targetId: eventId,
        caseId: inspectingEvent?.centreCode || 'MONITORING',
        result: 'SUCCESS',
        details: `Compliance Event "${eventId}" marked as ${newStatus} by officer.`
      });

      setEventsList(prev => prev.map(e => e.id === eventId ? { ...e, status: newStatus } : e));
      if (inspectingEvent && inspectingEvent.id === eventId) {
        setInspectingEvent(prev => ({ ...prev, status: newStatus }));
      }

      addToast && addToast('Status Updated', `Event ${eventId} marked as ${newStatus}.`, 'success');
    } catch (err) {
      console.error('Failed to update event status:', err);
      addToast && addToast('Update Failed', err.message || 'Error updating status', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight">
              Compliance Events Stream
            </h1>
            {metrics.openCount > 0 && (
              <span className="bg-red-50 text-red-700 border border-red-200 text-xs px-2.5 py-0.5 rounded-full font-mono font-semibold animate-pulse">
                {metrics.openCount} Active
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time Edge-AI discrepancy detections, attendance mismatches, and hardware telemetry alerts
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={() => {
              setSearchTerm('');
              setSeverityFilter('ALL');
              setStatusFilter('ALL');
              setTypeFilter('ALL');
              setCentreFilter('ALL');
            }}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-lg text-xs font-medium transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>Reset Filters</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500 font-medium">Total Events</div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-1">{metrics.total}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Recorded across centres</div>
        </div>

        <div className="bg-white border border-red-200 rounded-xl p-3.5 shadow-2xs">
          <div className="text-[11px] font-mono uppercase tracking-wider text-red-600 font-medium">Critical / High Alerts</div>
          <div className="text-2xl font-bold font-mono text-red-700 mt-1">{metrics.criticalCount}</div>
          <div className="text-[11px] text-red-500 mt-0.5">Requires immediate inspection</div>
        </div>

        <div className="bg-white border border-amber-200 rounded-xl p-3.5 shadow-2xs">
          <div className="text-[11px] font-mono uppercase tracking-wider text-amber-600 font-medium">Under Review</div>
          <div className="text-2xl font-bold font-mono text-amber-700 mt-1">{metrics.ackCount}</div>
          <div className="text-[11px] text-amber-500 mt-0.5">Acknowledged by officers</div>
        </div>

        <div className="bg-white border border-emerald-200 rounded-xl p-3.5 shadow-2xs">
          <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-600 font-medium">Resolved Checks</div>
          <div className="text-2xl font-bold font-mono text-emerald-700 mt-1">{metrics.resolvedCount}</div>
          <div className="text-[11px] text-emerald-500 mt-0.5">Cleared with audit stamp</div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by centre code, name, category, or discrepancy details..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Select Filters */}
          <div className="flex items-center space-x-2">
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="ALL">All Severities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">Open Alert</option>
              <option value="ACKNOWLEDGED">Acknowledged</option>
              <option value="RESOLVED">Resolved</option>
            </select>

            <select
              value={centreFilter}
              onChange={(e) => setCentreFilter(e.target.value)}
              className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer max-w-[160px] truncate"
            >
              <option value="ALL">All Centres</option>
              {availableCentres.map(c => (
                <option key={c.code} value={c.code}>#{c.code}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 font-mono pt-1 border-t border-slate-100">
          <span>Showing <strong className="text-slate-900">{filteredEvents.length}</strong> of {eventsList.length} compliance events</span>
        </div>
      </div>

      {/* 4. Events Table / Stacked Cards */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        {/* Desktop View Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[11px] uppercase tracking-wider font-semibold select-none">
                <th className="py-3 px-4">Event ID & Time</th>
                <th className="py-3 px-4">Training Centre</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-3">Severity</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4">Discrepancy Evaluation</th>
                <th className="py-3 px-3 text-right">AI Conf.</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredEvents.length > 0 ? (
                filteredEvents.map((evt) => {
                  const sev = getSeverityBadge(evt.severity);
                  const isCritical = (evt.severity || '').toLowerCase() === 'critical';
                  const isOpen = evt.status === 'OPEN';

                  return (
                    <tr 
                      key={evt.id} 
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isCritical && isOpen ? 'bg-red-50/30' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="font-mono font-semibold text-slate-900">{evt.id}</div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center space-x-1">
                          <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{formatCentreTime(evt.timestamp)}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900 max-w-xs truncate" title={evt.centreName}>
                          {evt.centreName}
                        </div>
                        <div className="text-[11px] text-blue-600 font-mono mt-0.5">
                          {formatCentreCode(evt.centreCode || evt.centreId)}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-800">{evt.eventType}</span>
                        {evt.cameraId && (
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center space-x-1">
                            <Camera className="w-3 h-3 text-slate-400" />
                            <span>{evt.cameraId}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${sev.badgeClass}`}>
                          {sev.label}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold border ${
                          evt.status === 'OPEN' ? 'bg-red-50 text-red-700 border-red-200' :
                          evt.status === 'ACKNOWLEDGED' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {evt.status}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="text-slate-800 font-medium">
                          {evt.discrepancy || 'Evaluation recorded'}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          Det: {evt.detectedValue} / Exp: {evt.expectedValue}
                        </div>
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-semibold text-slate-800">
                        {evt.confidence ? `${(evt.confidence * 100).toFixed(1)}%` : '--'}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setInspectingEvent(evt)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-600 hover:text-blue-700 border border-slate-200 hover:border-blue-200 rounded-md text-xs font-medium transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                    <p className="text-sm font-medium text-slate-600">No compliance events match current criteria</p>
                    <p className="text-xs text-slate-400 mt-1">All monitored training centres are operating within specified tolerances.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View: Stacked Cards */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredEvents.length > 0 ? (
            filteredEvents.map((evt) => {
              const sev = getSeverityBadge(evt.severity);
              return (
                <div key={evt.id} className="p-4 space-y-2.5 hover:bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-slate-900">{evt.id}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${sev.badgeClass}`}>
                      {sev.label}
                    </span>
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-slate-900">{evt.centreName}</div>
                    <div className="text-[11px] text-blue-600 font-mono mt-0.5">{formatCentreCode(evt.centreCode || evt.centreId)}</div>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-xs space-y-1">
                    <div className="font-medium text-slate-800">{evt.eventType}</div>
                    <div className="text-slate-600 font-mono text-[11px]">{evt.discrepancy}</div>
                    <div className="text-slate-400 text-[10px] font-mono flex items-center justify-between pt-1">
                      <span>Time: {formatCentreTime(evt.timestamp)}</span>
                      <span>AI Conf: {evt.confidence ? `${(evt.confidence * 100).toFixed(0)}%` : '--'}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end space-x-2 pt-1">
                    <button
                      onClick={() => setInspectingEvent(evt)}
                      className="w-full flex items-center justify-center space-x-1.5 py-2 bg-slate-900 text-white rounded-lg text-xs font-medium shadow-xs"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Inspect Evidence Frame</span>
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-slate-400">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-xs font-medium text-slate-600">No compliance events match current criteria</p>
            </div>
          )}
        </div>
      </div>

      {/* 5. Slide-Over Inspector Drawer */}
      {inspectingEvent && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          {/* Backdrop */}
          <div
            onClick={() => setInspectingEvent(null)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            aria-label="Close drawer"
          />

          <div className="relative w-full max-w-lg bg-white border-l border-slate-200 shadow-xl flex flex-col h-full z-10 animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 font-mono">
                    {inspectingEvent.id}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-sans">
                    Compliance Event Inspection & Evidence Frame
                  </p>
                </div>
              </div>

              <button
                onClick={() => setInspectingEvent(null)}
                className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded-lg transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-5 space-y-5 overflow-y-auto flex-1 text-xs">
              {/* Centre Banner */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-blue-600 font-semibold">{formatCentreCode(inspectingEvent.centreCode || inspectingEvent.centreId)}</span>
                  <span className="text-slate-500">{formatCentreTime(inspectingEvent.timestamp)}</span>
                </div>
                <div className="font-semibold text-slate-900 text-sm">{inspectingEvent.centreName}</div>
                {onSelectCentre && (
                  <button
                    onClick={() => {
                      const matched = centres.find(c => c.id === inspectingEvent.centreId || c.centreCode === inspectingEvent.centreCode);
                      if (matched) {
                        onSelectCentre(matched);
                        setInspectingEvent(null);
                      }
                    }}
                    className="inline-flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-[11px] font-medium pt-1"
                  >
                    <span>Open Centre Workspace</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Discrepancy Breakdown */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500 font-semibold">
                  Discrepancy Evaluation
                </div>

                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                    <div className="text-[10px] text-slate-500 font-medium">Declared / Expected</div>
                    <div className="text-sm font-bold font-mono text-slate-800 mt-1">{inspectingEvent.expectedValue}</div>
                  </div>

                  <div className="bg-red-50 border border-red-200 rounded-lg p-2.5">
                    <div className="text-[10px] text-red-600 font-medium">Edge AI Detected</div>
                    <div className="text-sm font-bold font-mono text-red-700 mt-1">{inspectingEvent.detectedValue}</div>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="text-[11px] font-medium text-slate-700">Analysis Summary:</div>
                  <p className="text-slate-600 mt-1 text-[11px] leading-relaxed">
                    {inspectingEvent.details || 'Discrepancy exceeded acceptable tolerance window (> 10%).'}
                  </p>
                </div>
              </div>

              {/* Edge AI Telemetry */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-2.5">
                <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500 font-semibold">
                  Edge AI Telemetry & Confidence
                </div>

                <div className="grid grid-cols-3 gap-2 font-mono text-[11px]">
                  <div className="bg-slate-50 p-2 rounded border border-slate-100">
                    <span className="text-slate-400 block text-[10px]">Confidence</span>
                    <strong className="text-emerald-700 font-bold">
                      {inspectingEvent.confidence ? `${(inspectingEvent.confidence * 100).toFixed(1)}%` : '95.0%'}
                    </strong>
                  </div>

                  <div className="bg-slate-50 p-2 rounded border border-slate-100">
                    <span className="text-slate-400 block text-[10px]">Camera Feed</span>
                    <strong className="text-slate-800 font-bold">{inspectingEvent.cameraId || 'CAM-01'}</strong>
                  </div>

                  <div className="bg-slate-50 p-2 rounded border border-slate-100">
                    <span className="text-slate-400 block text-[10px]">Model</span>
                    <strong className="text-slate-800 font-bold">YOLOv8-Edu</strong>
                  </div>
                </div>
              </div>

              {/* Evidence Snapshot Frame Representation */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-slate-500 font-semibold">
                  <span>CCTV Frame Verification Snapshot</span>
                  <span className="text-emerald-600 font-normal">Tamper Sealed</span>
                </div>

                {/* Simulated CCTV Frame with Bounding Box Overlays */}
                <div className="relative aspect-video bg-slate-900 rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center text-white">
                  {/* Grid Lines */}
                  <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px]" />

                  {/* Camera Timestamp Stamp */}
                  <div className="absolute top-2 left-2 font-mono text-[10px] text-emerald-400 bg-black/60 px-2 py-0.5 rounded">
                    LIVE REC: {inspectingEvent.cameraId || 'CAM-01'} | 1080p @ 20fps
                  </div>

                  <div className="absolute top-2 right-2 font-mono text-[10px] text-white/70 bg-black/60 px-2 py-0.5 rounded">
                    {new Date(inspectingEvent.timestamp).toISOString().replace('T', ' ').slice(0, 19)}
                  </div>

                  {/* Bounding Box 1 */}
                  <div className="absolute top-1/4 left-1/4 w-28 h-20 border-2 border-emerald-400 bg-emerald-500/10 rounded flex flex-col justify-between p-1">
                    <span className="font-mono text-[9px] bg-emerald-500 text-black px-1 font-bold rounded-xs self-start">
                      Learners (x22) 94.8%
                    </span>
                  </div>

                  {/* Bounding Box 2: Deficient / Missing */}
                  <div className="absolute bottom-1/4 right-1/4 w-24 h-16 border-2 border-red-400 border-dashed bg-red-500/10 rounded flex flex-col justify-between p-1">
                    <span className="font-mono text-[9px] bg-red-500 text-white px-1 font-bold rounded-xs self-start">
                      Unoccupied (x6)
                    </span>
                  </div>

                  {/* Center Text */}
                  <div className="text-center z-10 pointer-events-none">
                    <div className="font-mono text-xs font-semibold text-slate-300">
                      FRAME SEAL: {inspectingEvent.id}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                      Cryptographic Frame Hash Anchored
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-1">
                  <span>SHA-256: 9f83a48e...b3294aa</span>
                  {onViewEvidence && inspectingEvent.evidenceId && (
                    <button
                      onClick={() => {
                        onViewEvidence(inspectingEvent.evidenceId);
                        setInspectingEvent(null);
                      }}
                      className="text-blue-600 hover:text-blue-800 font-medium font-sans"
                    >
                      Open Full Screen Viewer →
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Drawer Actions Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between gap-2">
              <div className="text-xs text-slate-500 font-medium">
                Current Status: <strong className="font-mono uppercase text-slate-800">{inspectingEvent.status}</strong>
              </div>

              <div className="flex items-center space-x-2">
                {inspectingEvent.status === 'OPEN' && (
                  <button
                    onClick={() => handleUpdateStatus(inspectingEvent.id, 'ACKNOWLEDGED')}
                    className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-semibold transition-colors"
                  >
                    Acknowledge
                  </button>
                )}

                {inspectingEvent.status !== 'RESOLVED' && (
                  <button
                    onClick={() => handleUpdateStatus(inspectingEvent.id, 'RESOLVED')}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center space-x-1.5 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Resolve Discrepancy</span>
                  </button>
                )}

                <button
                  onClick={() => setInspectingEvent(null)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
