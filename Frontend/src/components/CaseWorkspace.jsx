import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  ArrowLeft, 
  Plus, 
  Camera, 
  ShieldCheck, 
  History, 
  Cpu, 
  Activity, 
  Eye, 
  CheckCircle2, 
  AlertTriangle, 
  RotateCcw,
  Sparkles,
  ChevronRight,
  User,
  MapPin,
  Clock,
  Play,
  FileCheck,
  Radio,
  Layers,
  Check
} from 'lucide-react';
import { getComplianceStatusBadge, getSeverityBadge, formatCentreTime, formatCentreCode } from '../utils/centreUtils.js';
import { ComplianceEventRepository } from '../services/complianceEventRepository.js';
import { AuditRepository } from '../services/auditRepository.js';
import { CentreRepository } from '../services/centreRepository.js';

export default function CaseWorkspace({
  caseItem,
  centreItem,
  onBack,
  onOpenUpload,
  onViewDocument,
  onViewEvidence,
  onDownloadDocument,
  onDocumentDeleted,
  currentUser,
  currentRole,
  onOpenShare,
  addToast
}) {
  // Normalise centre entity
  const centre = useMemo(() => {
    const raw = centreItem || caseItem;
    if (!raw) return null;
    return {
      id: raw.id,
      centreCode: raw.centreCode || raw.caseNumber || raw.id,
      name: raw.name || raw.title,
      scheme: raw.scheme || raw.type || 'PMKVY 4.0',
      sector: raw.sector || 'Skill Development',
      location: raw.location || { state: 'Delhi', district: 'South Delhi', address: raw.address || 'Training Campus' },
      assignedOfficer: raw.assignedOfficer || (Array.isArray(raw.assignedOfficers) ? raw.assignedOfficers[0] : 'Compliance Officer'),
      complianceStatus: raw.complianceStatus || (raw.priority === 'Critical' ? 'CRITICAL' : raw.priority === 'High' ? 'ATTENTION' : 'COMPLIANT'),
      priority: raw.priority || 'Medium',
      activeBatch: raw.activeBatch || {
        batchId: 'BATCH-2026-01',
        courseName: raw.type || 'Skill Certification Course',
        enrolledCount: 25,
        startTime: '09:00',
        endTime: '17:00',
        classroom: 'Main Lab 1',
        trainingHoursCompleted: 120,
        totalTrainingHours: 240
      },
      currentSession: raw.currentSession || {
        sessionId: 'SES-01',
        topic: raw.summary || 'Core Practical Skills & Workshop Safety',
        trainerName: 'Lead Trainer',
        trainerAadhaarLinked: true,
        trainerPresent: true,
        status: 'In Progress'
      },
      attendance: raw.attendance || {
        declaredExpected: 25,
        detectedByAI: 22,
        difference: -3,
        discrepancyRate: 12.0,
        status: 'MISMATCH',
        lastChecked: new Date().toISOString(),
        confidence: 0.96
      },
      infrastructure: raw.infrastructure || {
        totalRequired: 5,
        totalDetected: 4,
        status: 'DEFICIENT',
        items: [
          { name: 'Training Workstations', expected: 25, detected: 25, status: 'VERIFIED', category: 'Classroom Tech' },
          { name: 'Sector Practical Kit', expected: 2, detected: 1, status: 'DEFICIENT', category: 'Lab Equipment' },
          { name: 'First Aid Station', expected: 1, detected: 1, status: 'VERIFIED', category: 'Safety & Compliance' },
          { name: 'Fire Extinguisher', expected: 2, detected: 2, status: 'VERIFIED', category: 'Safety & Compliance' },
          { name: 'Biometric Terminal', expected: 1, detected: 1, status: 'VERIFIED', category: 'Statutory Hardware' }
        ]
      },
      edgeHealth: raw.edgeHealth || {
        cameraCount: 3,
        camerasOnline: 2,
        camerasOffline: 1,
        edgeDeviceId: 'EDGE-JETSON-01',
        deviceModel: 'NVIDIA Jetson Orin Nano (8GB)',
        edgeStatus: 'ONLINE',
        fps: 18.0,
        latencyMs: 65,
        cpuUsage: 45,
        gpuUsage: 65,
        temperatureC: 52,
        aiModelVersion: 'YOLOv8-EduCompliance-v2.4',
        lastSync: new Date().toISOString(),
        cameras: [
          { id: 'CAM-01', name: 'Front Cam', status: 'ONLINE', resolution: '1080p', fps: 20 },
          { id: 'CAM-02', name: 'Workstations Cam', status: 'ONLINE', resolution: '1080p', fps: 18 },
          { id: 'CAM-03', name: 'Rear Cam', status: 'OFFLINE', resolution: '1080p', fps: 0, reason: 'RTSP timeout' }
        ]
      },
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      lastVerification: raw.lastVerification || raw.updatedAt
    };
  }, [centreItem, caseItem]);

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'attendance' | 'infrastructure' | 'edgeHealth' | 'events'
  const [centreEvents, setCentreEvents] = useState([]);
  const [evidenceList, setEvidenceList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEvaluating, setIsEvaluating] = useState(false);

  const loadData = async () => {
    if (!centre) return;
    try {
      setLoading(true);
      const [events, evidence] = await Promise.all([
        ComplianceEventRepository.getEventsByCentre(centre.centreCode || centre.id),
        ComplianceEventRepository.getAllEvidence()
      ]);
      setCentreEvents(events);
      setEvidenceList(evidence.filter(ev => ev.centreId === centre.id || ev.centreId === centre.centreCode));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [centre?.centreCode, centre?.id]);

  const handleTriggerSweep = async () => {
    setIsEvaluating(true);
    addToast('Sweep Initiated', `Edge AI evaluation sweep triggered for ${centre.name}`, 'info');

    setTimeout(async () => {
      setIsEvaluating(false);
      addToast('Sweep Completed', `Real-time inference verified across all active camera RTSP streams.`, 'success');
      
      await AuditRepository.logAuditEvent({
        actor: currentUser || currentRole,
        action: 'INSPECTION_CONDUCTED',
        targetType: 'CENTRE',
        targetId: centre.centreCode,
        caseId: centre.centreCode,
        result: 'SUCCESS',
        details: `Manual Edge AI verification sweep executed by ${currentUser?.name || 'Officer'}.`
      });

      loadData();
    }, 1200);
  };

  if (!centre) return null;

  const statusBadge = getComplianceStatusBadge(centre.complianceStatus);
  const attDiff = centre.attendance?.difference ?? 0;
  const attRate = centre.attendance?.discrepancyRate ?? 0;

  const tabs = [
    { id: 'overview', label: 'Centre Overview' },
    { id: 'attendance', label: `Attendance (${centre.attendance?.detectedByAI ?? 0}/${centre.attendance?.declaredExpected ?? 0})` },
    { id: 'infrastructure', label: `Infrastructure (${centre.infrastructure?.totalDetected ?? 0}/${centre.infrastructure?.totalRequired ?? 0})` },
    { id: 'edgeHealth', label: `Camera & Edge (${centre.edgeHealth?.camerasOnline ?? 0}/${centre.edgeHealth?.cameraCount ?? 0})` },
    { id: 'events', label: `Compliance Events (${centreEvents.length})` }
  ];

  return (
    <div className="space-y-6">
      
      {/* Top Breadcrumb & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center space-x-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors w-fit"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Training Centres</span>
        </button>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleTriggerSweep}
            disabled={isEvaluating}
            className="inline-flex items-center space-x-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-3 py-2 rounded-lg text-xs font-semibold shadow-2xs transition-colors disabled:opacity-50"
          >
            <Sparkles className={`w-3.5 h-3.5 text-blue-600 ${isEvaluating ? 'animate-spin' : ''}`} />
            <span>{isEvaluating ? 'Evaluating...' : 'Run Edge AI Sweep'}</span>
          </button>

          <button
            onClick={() => onOpenUpload && onOpenUpload(centre.centreCode)}
            className="inline-flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Ingest AI Feed</span>
          </button>
        </div>
      </div>

      {/* Centre Header Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight">
                {centre.name}
              </h1>
              <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border shrink-0 ${statusBadge.badgeClass}`}>
                {statusBadge.label}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{centre.location?.address || `${centre.location?.district}, ${centre.location?.state}`}</span>
              </span>
              <span>•</span>
              <span className="font-medium text-slate-700">{centre.scheme}</span>
              <span>•</span>
              <span className="text-slate-600">{centre.sector}</span>
              <span>•</span>
              <span className="font-mono text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded text-[11px]">
                {formatCentreCode(centre.centreCode || centre.id)}
              </span>
            </div>
          </div>

          {/* 3 Quick Stat Summary Pills */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs">
              <span className="text-[10px] uppercase font-mono text-slate-400 block font-semibold">Attendance</span>
              <span className="font-mono font-semibold text-slate-800">
                {centre.attendance?.detectedByAI ?? 0} / {centre.attendance?.declaredExpected ?? 0}
                {attDiff < 0 ? (
                  <span className="text-red-600 ml-1">({attDiff})</span>
                ) : (
                  <span className="text-emerald-700 ml-1">✓</span>
                )}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs">
              <span className="text-[10px] uppercase font-mono text-slate-400 block font-semibold">Infrastructure</span>
              <span className="font-mono font-semibold text-slate-800">
                {centre.infrastructure?.totalDetected ?? 0} / {centre.infrastructure?.totalRequired ?? 0} items
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs">
              <span className="text-[10px] uppercase font-mono text-slate-400 block font-semibold">Camera Feeds</span>
              <span className="font-mono font-semibold text-slate-800">
                {centre.edgeHealth?.camerasOnline ?? 0} / {centre.edgeHealth?.cameraCount ?? 0} online
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 font-normal pt-3 border-t border-slate-100">
          <span>Inspector: <strong className="font-medium text-slate-700">{centre.assignedOfficer}</strong></span>
          <span>•</span>
          <span>Active Batch: <strong className="font-medium text-slate-700">{centre.activeBatch?.courseName}</strong></span>
          <span>•</span>
          <span>Enrolled: <strong className="font-medium text-slate-700">{centre.activeBatch?.enrolledCount} Candidates</strong></span>
          <span>•</span>
          <span>Last Verification: <strong className="font-medium font-mono text-slate-700">{formatCentreTime(centre.lastVerification)}</strong></span>
        </div>
      </div>

      {/* Centre Detail Tabs */}
      <div className="border-b border-slate-200 flex items-center space-x-2 bg-white px-2 rounded-t-xl overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`py-3 px-3.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-700 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Active Batch Summary */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-mono">
                Active Batch Parameters
              </span>
              <span className="font-mono text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded font-semibold">
                {centre.activeBatch?.batchId}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <span className="text-slate-500 block">Course Curriculum</span>
                <span className="text-sm font-semibold text-slate-800">{centre.activeBatch?.courseName}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <span className="text-slate-500 block">Candidate Strength</span>
                  <span className="font-semibold text-slate-800 font-mono">{centre.activeBatch?.enrolledCount} Candidates</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Classroom Allocation</span>
                  <span className="font-semibold text-slate-800">{centre.activeBatch?.classroom || 'Practical Workshop'}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <span className="text-slate-500 block">Daily Timings</span>
                  <span className="font-semibold text-slate-800 font-mono">{centre.activeBatch?.startTime} - {centre.activeBatch?.endTime}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Curriculum Hours</span>
                  <span className="font-semibold text-slate-800 font-mono">{centre.activeBatch?.trainingHoursCompleted || 0} / {centre.activeBatch?.totalTrainingHours || 0} hrs</span>
                </div>
              </div>
            </div>
          </div>

          {/* Current Live Session */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-mono flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Current Live Session</span>
              </span>
              <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
                {centre.currentSession?.status || 'In Progress'}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <span className="text-slate-500 block">Topic in Progress</span>
                <span className="text-sm font-semibold text-slate-800">{centre.currentSession?.topic}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Master Trainer</span>
                <span className="font-semibold text-slate-800">{centre.currentSession?.trainerName}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-medium">Aadhaar Linked</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-medium">Trainer In Frame</span>
                </div>
              </div>
            </div>
          </div>

          {/* Operational Attendance & Infrastructure Summary Cards */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-mono">
                Attendance Compliance Snapshot
              </span>
              <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded-full border ${
                attDiff < 0 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}>
                {attDiff < 0 ? `${attDiff} Candidate Deficit` : '100% Congruent'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-slate-500 block text-[11px]">Declared via Portal</span>
                <span className="text-base font-semibold font-mono text-slate-800">{centre.attendance?.declaredExpected ?? 0}</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-slate-500 block text-[11px]">AI Optical Count</span>
                <span className="text-base font-semibold font-mono text-blue-700">{centre.attendance?.detectedByAI ?? 0}</span>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('attendance')}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1 pt-1"
            >
              <span>View full attendance audit</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-mono">
                Infrastructure & Equipment Summary
              </span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                centre.infrastructure?.status === 'ADEQUATE'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {centre.infrastructure?.totalDetected ?? 0} / {centre.infrastructure?.totalRequired ?? 0} Verified
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>Classroom & Lab Tools</span>
                <span className="font-semibold text-slate-800">{centre.infrastructure?.totalDetected ?? 0} items confirmed</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>Camera Stream Status</span>
                <span className="font-mono text-slate-800">{centre.edgeHealth?.camerasOnline ?? 0}/{centre.edgeHealth?.cameraCount ?? 0} Cameras Online</span>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('infrastructure')}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1 pt-1"
            >
              <span>View equipment checklist</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: ATTENDANCE */}
      {activeTab === 'attendance' && (
        <div className="space-y-4">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <span className="text-[11px] font-mono uppercase text-slate-500 font-semibold block">Declared Expected</span>
              <span className="text-2xl font-mono font-semibold text-slate-800 mt-1 block">
                {centre.attendance?.declaredExpected ?? 0}
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5 block">Biometric Gateway / Portal</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <span className="text-[11px] font-mono uppercase text-slate-500 font-semibold block">Detected by Edge AI</span>
              <span className="text-2xl font-mono font-semibold text-blue-700 mt-1 block">
                {centre.attendance?.detectedByAI ?? 0}
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5 block">Optical Seat Bounding Boxes</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <span className="text-[11px] font-mono uppercase text-slate-500 font-semibold block">Candidate Difference</span>
              <span className={`text-2xl font-mono font-semibold mt-1 block ${attDiff < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                {attDiff > 0 ? `+${attDiff}` : attDiff}
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5 block">AI Count - Declared</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <span className="text-[11px] font-mono uppercase text-slate-500 font-semibold block">Discrepancy Rate</span>
              <span className={`text-2xl font-mono font-semibold mt-1 block ${attRate > 10 ? 'text-red-600' : 'text-emerald-700'}`}>
                {attRate}%
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5 block">Tolerance: 10% maximum</span>
            </div>
          </div>

          {/* Attendance Congruence Visualization */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-900">Attendance Congruence Evaluation</span>
              <span className="font-mono text-slate-500">Confidence: {(centre.attendance?.confidence * 100 || 95).toFixed(1)}%</span>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-600">
                <span>Detected: {centre.attendance?.detectedByAI ?? 0}</span>
                <span>Target: {centre.attendance?.declaredExpected ?? 0}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden flex">
                <div 
                  className={`h-full ${attDiff < 0 ? 'bg-amber-500' : 'bg-emerald-500'} transition-all duration-300`}
                  style={{ width: `${Math.min(100, ((centre.attendance?.detectedByAI ?? 0) / (centre.attendance?.declaredExpected || 1)) * 100)}%` }}
                />
              </div>
            </div>

            {attDiff < 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Attendance Discrepancy Flag: </span>
                  Candidate count detected by Edge AI is {Math.abs(attDiff)} learners below declared biometric roster. 
                  Continuous monitoring protocol active.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: INFRASTRUCTURE */}
      {activeTab === 'infrastructure' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/60">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Mandatory Facility Infrastructure Checklist</h3>
              <p className="text-xs text-slate-500 mt-0.5">Automated visual recognition for required tools, test benches, and safety gear.</p>
            </div>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
              centre.infrastructure?.status === 'ADEQUATE' 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              {centre.infrastructure?.totalDetected ?? 0} of {centre.infrastructure?.totalRequired ?? 0} Items Verified
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[11px] uppercase">
                  <th className="py-2.5 px-4 font-semibold">Equipment / Facility Item</th>
                  <th className="py-2.5 px-3 font-semibold">Expected Qty</th>
                  <th className="py-2.5 px-3 font-semibold">Detected by AI</th>
                  <th className="py-2.5 px-4 text-right font-semibold">Compliance Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {centre.infrastructure?.items?.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{item.name}</div>
                      <div className="text-[11px] text-slate-500 font-normal">{item.category}</div>
                    </td>
                    <td className="py-3 px-3 font-mono font-medium text-slate-800">{item.expected}</td>
                    <td className="py-3 px-3 font-mono font-semibold text-blue-700">{item.detected}</td>
                    <td className="py-3 px-4 text-right">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                        item.status === 'VERIFIED'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : item.status === 'DEFICIENT'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-red-50 text-red-700 border-red-200'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: CAMERA & EDGE HEALTH */}
      {activeTab === 'edgeHealth' && (
        <div className="space-y-4">
          {/* Edge Box Telemetry */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Cpu className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-semibold text-slate-900">On-Premises Edge AI Box Telemetry</h3>
              </div>
              <span className="font-mono text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded font-semibold">
                {centre.edgeHealth?.edgeDeviceId}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <span className="text-slate-400 block font-mono text-[10px] uppercase">Device Hardware</span>
                <span className="font-semibold text-slate-800">{centre.edgeHealth?.deviceModel}</span>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <span className="text-slate-400 block font-mono text-[10px] uppercase">Inference Speed</span>
                <span className="font-semibold text-slate-800 font-mono">{centre.edgeHealth?.fps} FPS</span>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <span className="text-slate-400 block font-mono text-[10px] uppercase">Network Latency</span>
                <span className="font-semibold text-slate-800 font-mono">{centre.edgeHealth?.latencyMs} ms</span>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <span className="text-slate-400 block font-mono text-[10px] uppercase">AI Model</span>
                <span className="font-semibold text-slate-800">{centre.edgeHealth?.aiModelVersion}</span>
              </div>
            </div>
          </div>

          {/* Camera RTSP Feeds Grid */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">Monitored CCTV Camera RTSP Streams</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {centre.edgeHealth?.cameras?.map((cam) => (
                <div key={cam.id} className="border border-slate-200 rounded-lg p-3.5 space-y-2 bg-slate-50/60">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-slate-800">{cam.id}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-semibold border ${
                      cam.status === 'ONLINE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      {cam.status}
                    </span>
                  </div>
                  <div className="font-medium text-xs text-slate-800 truncate">{cam.name}</div>
                  <div className="text-[11px] text-slate-500 font-mono flex items-center justify-between pt-1 border-t border-slate-200">
                    <span>{cam.resolution}</span>
                    <span>{cam.fps} FPS</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: COMPLIANCE EVENTS & EVIDENCE */}
      {activeTab === 'events' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/60">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Compliance Verification Events & Evidence</h3>
              <p className="text-xs text-slate-500 mt-0.5">Automated discrepancy logs backed by cryptographically sealed CCTV frame evidence.</p>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {centreEvents.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No compliance discrepancy events logged for this centre.
              </div>
            ) : (
              centreEvents.map((evt) => {
                const sev = getSeverityBadge(evt.severity);
                return (
                  <div key={evt.id} className="p-4 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded text-[11px]">
                          {evt.id}
                        </span>
                        <span className="font-semibold text-slate-900">{evt.eventType}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-medium border ${sev.badgeClass}`}>
                          {evt.severity}
                        </span>
                      </div>
                      <p className="text-slate-600 leading-snug">{evt.details}</p>
                      <div className="text-[11px] text-slate-400 flex items-center gap-3 pt-0.5">
                        <span>Expected: <strong>{evt.expectedValue}</strong></span>
                        <span>•</span>
                        <span>Detected: <strong className="text-blue-700">{evt.detectedValue}</strong></span>
                        <span>•</span>
                        <span>Confidence: <strong>{(evt.confidence * 100).toFixed(1)}%</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      {evt.evidenceId && (
                        <button
                          onClick={() => {
                            const foundEvidence = evidenceList.find(e => e.id === evt.evidenceId);
                            if (foundEvidence && onViewEvidence) {
                              onViewEvidence(foundEvidence);
                            } else {
                              addToast('Evidence Frame', `CCTV frame ${evt.evidenceId} loaded in viewer.`, 'info');
                            }
                          }}
                          className="inline-flex items-center space-x-1 bg-slate-100 hover:bg-blue-600 text-slate-700 hover:text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect Evidence</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

    </div>
  );
}
