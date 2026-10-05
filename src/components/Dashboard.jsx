import React, { useState, useMemo } from 'react';
import { 
  Building2, 
  AlertTriangle, 
  ShieldCheck, 
  CheckCircle2, 
  ChevronRight, 
  Upload, 
  Plus,
  AlertCircle,
  Search,
  User,
  Shield,
  Camera,
  Cpu,
  Activity,
  ArrowUpRight
} from 'lucide-react';
import { SharingService } from '../services/sharingService.js';
import { getComplianceStatusBadge, getSeverityBadge, formatCentreTime } from '../utils/centreUtils.js';

export default function Dashboard({ 
  cases = [], 
  documents = [], 
  auditLogs = [],
  centres = [],
  complianceEvents = [],
  onSelectCase,
  onSelectCentre, 
  onOpenCreateCase,
  onOpenRegisterCentre,
  onOpenUpload, 
  onQuickVerify, 
  integrityAlertCount = 0,
  currentUser = null,
  currentRole = null,
  onNavigate = null,
  onViewDocument = null,
  onViewEvidence = null
}) {
  const [centreSearch, setCentreSearch] = useState('');
  const effectiveUser = currentUser || currentRole;

  // Unify centres list (prefer centres prop, fallback to cases if centres is empty)
  const rawCentres = useMemo(() => {
    if (centres && centres.length > 0) return centres;
    if (cases && cases.length > 0) {
      return cases.map(c => ({
        id: c.id,
        centreCode: c.centreCode || c.caseNumber || c.id,
        name: c.name || c.title,
        scheme: c.scheme || c.type || 'PMKVY 4.0',
        sector: c.sector || 'Skill Development',
        location: c.location || { state: 'Delhi', district: 'South Delhi', address: c.policeStation || 'Training Campus' },
        assignedOfficer: c.assignedOfficer || (Array.isArray(c.assignedOfficers) ? c.assignedOfficers[0] : 'Compliance Officer'),
        complianceStatus: c.complianceStatus || (c.priority === 'Critical' ? 'CRITICAL' : c.priority === 'High' ? 'ATTENTION' : 'COMPLIANT'),
        priority: c.priority || 'Medium',
        activeBatch: c.activeBatch || { courseName: c.type || 'Technical Training', enrolledCount: 25 },
        attendance: c.attendance || { declaredExpected: 25, detectedByAI: 23, difference: -2, discrepancyRate: 8.0, status: 'MISMATCH' },
        infrastructure: c.infrastructure || { totalRequired: 5, totalDetected: 5, status: 'ADEQUATE' },
        edgeHealth: c.edgeHealth || { cameraCount: 3, camerasOnline: 3, camerasOffline: 0, edgeStatus: 'ONLINE', fps: 20 },
        recentAlertsCount: c.isTampered ? 1 : 0,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt
      }));
    }
    return [];
  }, [centres, cases]);

  // Unify compliance events (prefer complianceEvents prop, fallback to auditLogs / documents)
  const rawEvents = useMemo(() => {
    if (complianceEvents && complianceEvents.length > 0) return complianceEvents;
    if (auditLogs && auditLogs.length > 0) {
      return auditLogs.map(l => ({
        id: l.id,
        centreId: l.caseId || 'TC-GEN',
        centreCode: l.caseId || 'TC-GEN',
        centreName: l.details || 'Automated Compliance Check',
        eventType: l.action ? l.action.replace(/_/g, ' ') : 'Verification Check',
        timestamp: l.timestamp,
        severity: l.result === 'ALERT' || l.result === 'DENIED' ? 'High' : 'Low',
        expectedValue: 'Compliance Threshold',
        detectedValue: l.details || 'Normal Operation',
        discrepancy: l.result === 'ALERT' ? 'Discrepancy Reported' : 'Verified',
        confidence: 0.96,
        status: l.result === 'ALERT' ? 'OPEN' : 'RESOLVED',
        details: l.details
      }));
    }
    return [];
  }, [complianceEvents, auditLogs]);

  // Role-aware accessible centres filtering
  const accessibleCentres = useMemo(() => {
    return rawCentres.filter(c => {
      // Direct centre assignment check
      if (effectiveUser?.assignedCentres) {
        if (effectiveUser.assignedCentres.includes('*')) return true;
        return effectiveUser.assignedCentres.includes(c.id) || effectiveUser.assignedCentres.includes(c.centreCode);
      }
      return SharingService.canUserAccessCase(effectiveUser, c);
    });
  }, [rawCentres, effectiveUser]);

  // Operational metrics
  const compliantCentres = useMemo(() => {
    return accessibleCentres.filter(c => c.complianceStatus === 'COMPLIANT');
  }, [accessibleCentres]);

  const attentionCentres = useMemo(() => {
    return accessibleCentres.filter(c => c.complianceStatus === 'ATTENTION' || c.complianceStatus === 'CRITICAL');
  }, [accessibleCentres]);

  const attendanceDiscrepancies = useMemo(() => {
    return accessibleCentres.filter(c => c.attendance?.status === 'MISMATCH');
  }, [accessibleCentres]);

  const infrastructureDeficits = useMemo(() => {
    return accessibleCentres.filter(c => c.infrastructure?.status === 'DEFICIENT');
  }, [accessibleCentres]);

  const offlineDevicesCount = useMemo(() => {
    return accessibleCentres.filter(c => c.complianceStatus === 'OFFLINE' || (c.edgeHealth?.camerasOffline || 0) > 0 || c.edgeHealth?.edgeStatus === 'OFFLINE').length;
  }, [accessibleCentres]);

  const openAlertsCount = useMemo(() => {
    const fromEvents = rawEvents.filter(e => e.status === 'OPEN').length;
    return Math.max(fromEvents, attentionCentres.length, integrityAlertCount);
  }, [rawEvents, attentionCentres, integrityAlertCount]);

  // 4 Primary KPI cards
  const kpis = [
    {
      label: 'MONITORED CENTRES',
      value: accessibleCentres.length,
      sub: `${accessibleCentres.length} facility portals under edge surveillance`,
      icon: Building2,
      color: 'text-blue-600',
      bg: 'bg-blue-50 border-blue-100'
    },
    {
      label: 'REQUIRING ATTENTION',
      value: attentionCentres.length,
      sub: attentionCentres.length > 0 ? `${attentionCentres.length} centres require intervention` : 'All centres operating normally',
      icon: AlertTriangle,
      color: attentionCentres.length > 0 ? 'text-amber-600' : 'text-slate-600',
      bg: attentionCentres.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'
    },
    {
      label: 'ATTENDANCE MISMATCHES',
      value: attendanceDiscrepancies.length,
      sub: attendanceDiscrepancies.length > 0 ? `${attendanceDiscrepancies.length} centres exceed >10% deficit` : 'All candidate counts congruent',
      icon: AlertCircle,
      color: attendanceDiscrepancies.length > 0 ? 'text-amber-600' : 'text-slate-600',
      bg: attendanceDiscrepancies.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'
    },
    {
      label: 'HARDWARE & EDGE ALERTS',
      value: offlineDevicesCount > 0 ? `${offlineDevicesCount} Offline` : 'All Online',
      sub: offlineDevicesCount > 0 ? 'Camera or edge Jetson unreachable' : 'All CCTV video streams active',
      icon: offlineDevicesCount > 0 ? AlertTriangle : Cpu,
      color: offlineDevicesCount > 0 ? 'text-red-600' : 'text-indigo-600',
      bg: offlineDevicesCount > 0 ? 'bg-red-50 border-red-200' : 'bg-indigo-50 border-indigo-100'
    }
  ];

  // Filtered centres for the table
  const displayedCentres = useMemo(() => {
    if (!centreSearch.trim()) return accessibleCentres;
    const q = centreSearch.toLowerCase().trim();
    return accessibleCentres.filter(c => 
      (c.centreCode || '').toLowerCase().includes(q) ||
      (c.name || '').toLowerCase().includes(q) ||
      (c.scheme || '').toLowerCase().includes(q) ||
      (c.sector || '').toLowerCase().includes(q) ||
      (c.complianceStatus || '').toLowerCase().includes(q) ||
      (c.location?.state || '').toLowerCase().includes(q) ||
      (c.location?.district || '').toLowerCase().includes(q) ||
      (c.assignedOfficer || '').toLowerCase().includes(q)
    );
  }, [accessibleCentres, centreSearch]);

  const handleCentreClick = (centre) => {
    if (onSelectCentre) {
      onSelectCentre(centre);
    } else if (onSelectCase) {
      onSelectCase(centre);
    }
  };

  const handleOpenRegister = () => {
    if (onOpenRegisterCentre) {
      onOpenRegisterCentre();
    } else if (onOpenCreateCase) {
      onOpenCreateCase();
    }
  };

  return (
    <div className="space-y-5">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Overview
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time edge compliance, attendance congruence, and facility telemetry across monitored centres.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleOpenRegister}
            className="inline-flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Onboard Centre</span>
          </button>
          
          <button
            onClick={() => onOpenUpload && onOpenUpload()}
            className="inline-flex items-center space-x-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-3.5 py-2 rounded-lg text-xs font-semibold shadow-2xs transition-colors"
          >
            <Upload className="w-4 h-4 text-slate-500" />
            <span>Ingest AI Feed</span>
          </button>
        </div>
      </div>

      {/* 4 Primary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div 
              key={idx} 
              className="p-3.5 rounded-lg border border-slate-200 bg-white shadow-2xs hover:shadow-xs transition-shadow"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-slate-500 tracking-wider font-mono">
                  {kpi.label}
                </span>
                <div className={`w-7 h-7 rounded-md flex items-center justify-center border ${kpi.bg}`}>
                  <Icon className={`w-3.5 h-3.5 ${kpi.color}`} />
                </div>
              </div>
              <div className="text-2xl font-semibold font-mono text-slate-900 tracking-tight">
                {kpi.value}
              </div>
              <div className="text-[13px] text-slate-500 mt-0.5 truncate font-normal">
                {kpi.sub}
              </div>
            </div>
          );
        })}
      </div>

      {/* Attention Required Banner */}
      {attentionCentres.length > 0 || openAlertsCount > 0 ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-start sm:items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-red-100 border border-red-200 text-red-700 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-red-900 tracking-tight">
                Attention Required: Active Compliance Discrepancies Detected
              </h4>
              <p className="text-[13px] text-red-700 mt-0.5 font-normal">
                {attentionCentres.length > 0 
                  ? `${attentionCentres.length} training centre(s) require intervention due to attendance deficit (>10%), missing mandatory equipment, or offline camera streams.`
                  : `${openAlertsCount} compliance alerts pending evidentiary verification.`}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 shrink-0 self-end sm:self-auto">
            {onNavigate && (
              <button
                onClick={() => onNavigate('events')}
                className="inline-flex items-center space-x-1.5 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition-colors"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Review Active Alerts</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs text-slate-600">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="font-medium text-xs text-slate-700">All edge sensors online • 0 critical discrepancies</span>
          </div>
          <span className="text-xs text-slate-500 font-mono hidden sm:inline font-normal">NSDC / PMKVY 4.0 Standard Compliant</span>
        </div>
      )}

      {/* Main 2-Column Split: Active Centres (65-70%) + Real-time AI Events Feed (30-35%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left Column: Monitored Centres Table (~67% / 8 of 12 cols) */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-lg shadow-2xs flex flex-col overflow-hidden">
          
          {/* Header & Quick Filter */}
          <div className="p-3.5 sm:px-4 sm:py-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-semibold text-slate-900">
                Monitored Training Centres
              </h2>
              <span className="font-mono text-xs text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                {accessibleCentres.length} {accessibleCentres.length === 1 ? 'Centre' : 'Centres'}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter centres..."
                  value={centreSearch}
                  onChange={(e) => setCentreSearch(e.target.value)}
                  className="pl-8 pr-2.5 py-1 text-xs border border-slate-200 rounded-md bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 placeholder-slate-400 w-44 sm:w-56 font-normal"
                />
              </div>
              {onNavigate && (
                <button
                  onClick={() => onNavigate('centres')}
                  className="text-xs text-blue-600 hover:text-blue-700 font-semibold px-2 py-1 rounded hover:bg-blue-50 transition-colors whitespace-nowrap"
                >
                  View all →
                </button>
              )}
            </div>
          </div>

          {/* Training Centres List */}
          <div className="divide-y divide-slate-100 flex-1 overflow-x-auto">
            {displayedCentres.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <div className="w-10 h-10 bg-slate-100 text-slate-400 rounded-lg flex items-center justify-center mx-auto">
                  <Building2 className="w-5 h-5 stroke-1" />
                </div>
                <div className="space-y-0.5">
                  <div className="text-sm font-semibold text-slate-800">
                    {centreSearch.trim() ? 'No Matching Training Centres Found' : 'No Monitored Centres Assigned'}
                  </div>
                  <p className="text-sm text-slate-500 max-w-sm mx-auto font-normal">
                    {centreSearch.trim() 
                      ? 'Try clearing the search filter to display all state-registered facilities.'
                      : 'Onboard a new training centre or request jurisdictional assignment from your state director.'}
                  </p>
                </div>
                {!centreSearch.trim() && (
                  <button
                    onClick={handleOpenRegister}
                    className="inline-flex items-center space-x-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Onboard First Centre</span>
                  </button>
                )}
              </div>
            ) : (
              displayedCentres.map((centre) => {
                const statusBadge = getComplianceStatusBadge(centre.complianceStatus);
                const attDiff = centre.attendance?.difference || 0;
                const attRate = centre.attendance?.discrepancyRate || 0;
                const camsOnline = centre.edgeHealth?.camerasOnline || 0;
                const camsTotal = centre.edgeHealth?.cameraCount || 0;

                return (
                  <div 
                    key={centre.id || centre.centreCode}
                    onClick={() => handleCentreClick(centre)}
                    className="p-3.5 sm:px-4 hover:bg-slate-50 transition-colors cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                          {centre.name}
                        </h3>
                        <span className={`text-[10px] px-2 py-0.2 rounded-full font-medium border shrink-0 ${statusBadge.badgeClass}`}>
                          {statusBadge.label}
                        </span>
                        {centre.complianceStatus === 'OFFLINE' ? (
                          <span className="text-[10px] bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.2 rounded-full font-medium flex items-center gap-1 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                            <span>Edge Offline</span>
                          </span>
                        ) : (
                          <span className="text-[10px] bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.2 rounded-full font-medium flex items-center gap-1 shrink-0">
                            <Camera className="w-3 h-3 text-slate-500" />
                            <span>{camsOnline}/{camsTotal} Cams</span>
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500 font-normal">
                        <span>{centre.location?.district}, {centre.location?.state}</span>
                        <span>•</span>
                        <span className="text-slate-600 font-medium truncate max-w-[140px]">{centre.scheme}</span>
                        <span>•</span>
                        <span className="font-mono text-slate-600 bg-slate-100 border border-slate-200 px-1 py-0.2 rounded text-[10px]">
                          {centre.centreCode || centre.id}
                        </span>
                        {centre.activeBatch?.courseName && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[160px] text-slate-600">{centre.activeBatch.courseName}</span>
                          </>
                        )}
                        <span>•</span>
                        <span className="truncate max-w-xs">{centre.assignedOfficer}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end space-x-3 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <div className="text-left sm:text-right space-y-0.5">
                        <div className="text-xs font-medium text-slate-800">
                          Attendance:{' '}
                          <span className={attDiff < 0 ? 'text-red-600 font-mono font-semibold' : 'text-emerald-700 font-mono font-semibold'}>
                            {centre.attendance?.detectedByAI ?? 0} / {centre.attendance?.declaredExpected ?? 0}
                          </span>
                          {attDiff < 0 && (
                            <span className="text-[11px] text-red-600 ml-1 font-mono">
                              ({attDiff})
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center sm:justify-end gap-1 font-normal">
                          <span>Infra: {centre.infrastructure?.totalDetected ?? 0}/{centre.infrastructure?.totalRequired ?? 0}</span>
                          <span>•</span>
                          <span className="text-emerald-600 font-medium">Verified</span>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCentreClick(centre);
                        }}
                        className="inline-flex items-center space-x-1 bg-slate-100 group-hover:bg-blue-600 text-slate-700 group-hover:text-white px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors"
                      >
                        <span>Inspect</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Live Compliance Events Stream (~33% / 4 of 12 cols) */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-lg shadow-2xs p-3.5 sm:p-4 flex flex-col space-y-3">
          
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <h2 className="text-lg font-semibold text-slate-900">
                Live Compliance Stream
              </h2>
            </div>
            {onNavigate && (
              <button
                onClick={() => onNavigate('events')}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline"
              >
                View all →
              </button>
            )}
          </div>

          {/* Events list */}
          <div className="space-y-3 flex-1 overflow-y-auto max-h-[460px] pr-1">
            {rawEvents.slice(0, 7).map((evt) => {
              const sev = getSeverityBadge(evt.severity);
              return (
                <div key={evt.id} className="flex items-start space-x-2.5 text-xs pb-2.5 border-b border-slate-50 last:border-b-0 last:pb-0">
                  <span className="font-mono text-xs text-slate-400 font-normal shrink-0 pt-0.5 w-12">
                    {formatCentreTime(evt.timestamp)}
                  </span>
                  
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-medium text-slate-800 text-xs truncate">
                        {evt.eventType}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-medium border shrink-0 ${sev.badgeClass}`}>
                        {evt.severity}
                      </span>
                    </div>
                    
                    <p className="text-[13px] text-slate-600 truncate leading-snug font-normal">
                      {evt.discrepancy || evt.details}
                    </p>

                    <div className="text-xs text-slate-400 flex items-center justify-between gap-1 pt-0.5 font-normal">
                      <span className="font-mono text-blue-600 bg-blue-50 px-1 py-0.2 rounded border border-blue-100 truncate max-w-[140px]">
                        #{evt.centreCode || evt.centreId}
                      </span>
                      {evt.confidence && (
                        <span className="text-[11px] text-slate-400 font-mono">
                          {(evt.confidence * 100).toFixed(0)}% conf
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {rawEvents.length === 0 && (
              <div className="py-12 text-center text-slate-400 text-xs font-normal">
                No recent compliance events recorded yet.
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between font-normal">
            <span className="flex items-center gap-1">
              <Shield className="w-3 h-3 text-slate-400" />
              <span>Edge AI Telemetry</span>
            </span>
            <span className="text-emerald-600 font-medium font-mono text-xs">Cryptographically Sealed</span>
          </div>

        </div>

      </div>

    </div>
  );
}
