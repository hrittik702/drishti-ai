import React, { useState } from 'react';
import { X, Building2, ArrowRight } from 'lucide-react';
import { CentreRepository } from '../services/centreRepository';
import { AuditRepository } from '../services/auditRepository';

export default function OnboardCentreModal({ onClose, onCentreCreated, onCaseCreated, currentRole, addToast }) {
  const [centreCode, setCentreCode] = useState(`TC-REG-${Math.floor(1000 + Math.random() * 9000)}`);
  const [name, setName] = useState('');
  const [scheme, setScheme] = useState('PMKVY 4.0 (Electronics Sector)');
  const [sector, setSector] = useState('Renewable Energy & Electronics');
  const [stateName, setStateName] = useState('Delhi');
  const [district, setDistrict] = useState('South Delhi');
  const [address, setAddress] = useState('');
  const [batchCourse, setBatchCourse] = useState('Solar PV Panel Installation & Maintenance');
  const [enrolledCount, setEnrolledCount] = useState(30);
  const [priority, setPriority] = useState('Medium');
  const [complianceStatus, setComplianceStatus] = useState('COMPLIANT');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!centreCode || !name) return;

    setIsSubmitting(true);
    try {
      // 1. Create Training Centre in CentreRepository
      const newCentre = await CentreRepository.createCentre({
        id: centreCode,
        centreCode,
        name: name.trim(),
        scheme,
        sector,
        location: {
          state: stateName,
          district: district || 'Central District',
          address: address || 'Main Campus Facility'
        },
        assignedOfficer: currentRole?.name || 'Inspector Vikram Rathore',
        complianceStatus,
        priority,
        activeBatch: {
          batchId: `BATCH-${Date.now().toString(36).toUpperCase()}`,
          courseName: batchCourse,
          enrolledCount: Number(enrolledCount) || 25,
          startTime: '09:00',
          endTime: '17:00'
        },
        attendance: {
          declaredExpected: Number(enrolledCount) || 25,
          detectedByAI: Number(enrolledCount) || 25,
          difference: 0,
          discrepancyRate: 0.0,
          status: 'VERIFIED'
        },
        infrastructure: {
          totalRequired: 5,
          totalDetected: 5,
          status: 'ADEQUATE',
          items: [
            { name: 'Training Workstations', expected: Number(enrolledCount) || 25, detected: Number(enrolledCount) || 25, status: 'VERIFIED' },
            { name: 'Sector Practical Kit', expected: 2, detected: 2, status: 'VERIFIED' },
            { name: 'First Aid Station', expected: 1, detected: 1, status: 'VERIFIED' },
            { name: 'Fire Extinguisher', expected: 2, detected: 2, status: 'VERIFIED' },
            { name: 'Biometric Attendance Terminal', expected: 1, detected: 1, status: 'VERIFIED' }
          ]
        },
        edgeHealth: {
          cameraCount: 2,
          camerasOnline: 2,
          camerasOffline: 0,
          edgeDeviceId: `EDGE-JETSON-${centreCode.replace(/[^A-Z0-9]/g, '')}`,
          edgeStatus: 'ONLINE',
          fps: 15.0,
          latencyMs: 50,
          lastSync: new Date().toISOString(),
          aiModelVersion: 'YOLOv8-EduCompliance-v2.4'
        }
      });

      // 2. Real audit event
      await AuditRepository.logAuditEvent({
        actor: currentRole,
        action: 'CENTRE_ONBOARDED',
        targetType: 'CENTRE',
        targetId: newCentre.centreCode || newCentre.id,
        caseId: newCentre.centreCode || newCentre.id,
        result: 'SUCCESS',
        details: `Onboarded Training Centre #${newCentre.centreCode}: "${newCentre.name}" under ${scheme}. Assigned: ${newCentre.assignedOfficer}.`
      });

      addToast && addToast('Centre Onboarded', `Training Centre #${newCentre.centreCode} initialized.`, 'success');
      
      const callback = onCentreCreated || onCaseCreated;
      if (callback) callback(newCentre);
      onClose();
    } catch (err) {
      console.error(err);
      addToast && addToast('Error', err.message || 'Failed to onboard centre.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div 
        className="bg-white border border-slate-200 rounded-xl w-full max-w-lg shadow-xl overflow-hidden my-6 animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboard-centre-title"
      >
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2 id="onboard-centre-title" className="text-base font-semibold text-slate-900 tracking-tight">
                Onboard Training Centre
              </h2>
              <p className="text-xs text-slate-500">
                Register a skill development training facility for Edge-AI monitoring
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          
          {/* Identifiers Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Centre Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={centreCode}
                onChange={(e) => setCentreCode(e.target.value.toUpperCase())}
                placeholder="e.g. TC-DEL-0142"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono uppercase bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Compliance Tier
              </label>
              <select
                value={complianceStatus}
                onChange={(e) => setComplianceStatus(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
              >
                <option value="COMPLIANT">Verified Compliant</option>
                <option value="ATTENTION">Attention Required</option>
                <option value="CRITICAL">High Discrepancy Risk</option>
              </select>
            </div>
          </div>

          {/* Centre Name */}
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Centre Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Zenith Skill Academy — Okhla Centre"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
            />
          </div>

          {/* Scheme & Sector */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Skill Scheme
              </label>
              <select
                value={scheme}
                onChange={(e) => setScheme(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
              >
                <option value="PMKVY 4.0 (Electronics Sector)">PMKVY 4.0</option>
                <option value="DDU-GKY (Electronics & IT)">DDU-GKY</option>
                <option value="PMKVY 4.0 (Capital Goods)">PMKVY Capital Goods</option>
                <option value="State Skill Mission">State Skill Mission</option>
                <option value="National Apprenticeship Promotion Scheme">NAPS</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Sector Skill Council
              </label>
              <input
                type="text"
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                placeholder="e.g. Electronics & IT"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
              />
            </div>
          </div>

          {/* Location Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                State / UT
              </label>
              <input
                type="text"
                value={stateName}
                onChange={(e) => setStateName(e.target.value)}
                placeholder="e.g. Delhi"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                District
              </label>
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="e.g. South Delhi"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Campus Address / Facility Location
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Phase-II, Okhla Industrial Area"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
            />
          </div>

          {/* Active Batch & Enrolled Capacity */}
          <div className="grid grid-cols-3 gap-3 pt-1 border-t border-slate-100">
            <div className="col-span-2">
              <label className="block font-medium text-slate-700 mb-1">
                Active Batch Course
              </label>
              <input
                type="text"
                value={batchCourse}
                onChange={(e) => setBatchCourse(e.target.value)}
                placeholder="Course title"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Enrolled Count
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={enrolledCount}
                onChange={(e) => setEnrolledCount(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 font-medium rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>{isSubmitting ? 'Onboarding...' : 'Onboard Centre'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
