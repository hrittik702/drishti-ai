import React, { useRef, useEffect } from 'react';
import { X, Filter, RotateCcw } from 'lucide-react';

const DOCUMENT_TYPES = [
  'All Types',
  'FIR',
  'Investigation Record',
  'Witness Statement',
  'Forensic Report',
  'Charge Sheet',
  'Court Filing',
  'Legal Notice',
  'Evidence',
  'Other'
];

const CLASSIFICATIONS = [
  'All Classifications',
  'Public',
  'Internal',
  'Confidential',
  'Secret',
  'Top Secret'
];

const INTEGRITY_STATUSES = [
  { id: 'ALL', label: 'All Statuses' },
  { id: 'VERIFIED', label: '✓ Verified' },
  { id: 'MISMATCH', label: '⚠ Mismatch' }
];

const DATE_RANGES = [
  { id: 'ALL', label: 'Any Date' },
  { id: 'TODAY', label: 'Today' },
  { id: '7_DAYS', label: 'Last 7 Days' },
  { id: '30_DAYS', label: 'Last 30 Days' }
];

export default function DocumentFilterPopover({
  isOpen,
  onClose,
  filters,
  onFilterChange,
  onClearFilters,
  cases = []
}) {
  const popoverRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      ref={popoverRef}
      className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 p-4 z-40 text-xs animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center space-x-1.5 font-semibold text-xs text-slate-900">
          <Filter className="w-3.5 h-3.5 text-blue-600" />
          <span>Filter Documents</span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="py-3 space-y-3 max-h-[380px] overflow-y-auto">
        {/* Case Filter */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Case Docket
          </label>
          <select
            value={filters.caseId || 'ALL'}
            onChange={(e) => onFilterChange('caseId', e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 text-xs font-normal text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">All Accessible Cases</option>
            {cases.map((c) => (
              <option key={c.id || c.caseNumber} value={c.caseNumber}>
                #{c.caseNumber} — {c.title?.slice(0, 32)}...
              </option>
            ))}
          </select>
        </div>

        {/* Document Type Filter */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Document Type
          </label>
          <select
            value={filters.docType || 'ALL'}
            onChange={(e) => onFilterChange('docType', e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 text-xs font-normal text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">All Types</option>
            {DOCUMENT_TYPES.filter(t => t !== 'All Types').map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Classification Filter */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Security Classification
          </label>
          <select
            value={filters.classification || 'ALL'}
            onChange={(e) => onFilterChange('classification', e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 text-xs font-normal text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">All Classifications</option>
            {CLASSIFICATIONS.filter(c => c !== 'All Classifications').map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Integrity Status */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Integrity Status
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {INTEGRITY_STATUSES.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => onFilterChange('integrity', st.id)}
                className={`py-1.5 px-2 rounded border text-center text-xs font-medium transition-colors ${
                  (filters.integrity || 'ALL') === st.id
                    ? 'bg-blue-50 border-blue-300 text-blue-700 font-semibold'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date Filter */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Upload Date
          </label>
          <select
            value={filters.dateRange || 'ALL'}
            onChange={(e) => onFilterChange('dateRange', e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {DATE_RANGES.map((d) => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
        <button
          onClick={onClearFilters}
          className="inline-flex items-center space-x-1 text-slate-500 hover:text-slate-800 text-xs font-medium"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset All</span>
        </button>

        <button
          onClick={onClose}
          className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition-colors"
        >
          Apply Filters
        </button>
      </div>
    </div>
  );
}
