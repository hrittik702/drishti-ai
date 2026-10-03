import React from 'react';
import { Menu, Search, AlertTriangle, ChevronRight } from 'lucide-react';
import RoleIcon from './RoleIcon';

export default function TopHeader({
  currentView,
  selectedCase,
  onOpenMobileMenu,
  onOpenSearch,
  integrityAlertCount = 0,
  currentUser,
  currentRole,
  onNavigateToAccess
}) {
  const getViewTitle = () => {
    switch (currentView) {
      case 'dashboard': return 'Overview';
      case 'cases': return 'Cases';
      case 'documents': return 'Documents';
      case 'integrity': return 'Integrity';
      case 'audit': return 'Audit Trail';
      case 'search': return 'Search';
      case 'access': return 'Access Control';
      default: return currentView;
    }
  };

  const displayName = currentUser?.name || currentRole?.name || 'Officer';
  const displayClearance = currentUser?.clearance || currentRole?.clearance || 'Confidential';

  return (
    <header className="sticky top-0 z-30 h-14 sm:h-16 bg-white border-b border-slate-200 flex items-center justify-between px-3 sm:px-6">
      
      {/* Left: Mobile Toggle & Breadcrumbs */}
      <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden w-11 h-11 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg -ml-1 transition-colors shrink-0"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Breadcrumb Hierarchy */}
        <nav className="flex items-center space-x-1.5 text-xs text-slate-500 font-medium overflow-hidden">
          <span className="text-slate-900 font-semibold font-mono tracking-tight shrink-0">CASEGUARD</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          
          <span className={`text-slate-700 truncate ${currentView === 'cases' && selectedCase ? 'font-mono' : ''}`}>
            {currentView === 'cases' && selectedCase ? selectedCase.caseNumber : getViewTitle()}
          </span>

          {currentView === 'cases' && selectedCase && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0 hidden sm:inline" />
              <span className="text-blue-600 font-medium truncate max-w-[120px] sm:max-w-xs hidden sm:inline">
                {selectedCase.title}
              </span>
            </>
          )}
        </nav>
      </div>

      {/* Right: Quick Search, Alerts, and Active Officer Identity Badge */}
      <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
        
        {/* Quick Search Trigger (hidden on dedicated Search view to prevent duplicate inputs) */}
        {currentView !== 'search' && (
          <button
            onClick={onOpenSearch}
            className="hidden md:flex items-center space-x-2 bg-slate-100 hover:bg-slate-200/80 text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 transition-colors"
            aria-label="Search cases and documents"
          >
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <span>Search cases or documents...</span>
            <kbd className="bg-white border border-slate-300 text-[10px] px-1.5 py-0.5 rounded text-slate-500 font-mono font-medium">⌘K</kbd>
          </button>
        )}

        {/* Integrity Alert Pill */}
        {integrityAlertCount > 0 && (
          <div className="flex items-center space-x-1 bg-red-50 text-red-700 border border-red-200 px-2 sm:px-2.5 py-1 rounded-lg text-xs font-medium animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
            <span className="hidden sm:inline">{integrityAlertCount} Mismatch</span>
            <span className="sm:hidden font-mono font-semibold">{integrityAlertCount}</span>
          </div>
        )}

        {/* Active Officer Identity Badge: Navigates to Access Control */}
        <button
          onClick={onNavigateToAccess}
          title="Active Session Identity — Open Access Control"
          aria-label="Active Account — Open Access Control"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center sm:justify-start space-x-2 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 px-2 sm:px-2.5 py-1 rounded-lg transition-colors text-left"
        >
          <div className="w-6 h-6 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
            <RoleIcon role={currentRole} className="w-3.5 h-3.5 text-slate-700" />
          </div>
          <div className="text-left hidden sm:block">
            <div className="text-xs font-semibold text-slate-900 leading-none truncate max-w-[130px]">
              {displayName}
            </div>
            <div className="text-[10px] font-mono font-medium text-slate-500 uppercase mt-0.5 leading-none">
              {displayClearance}
            </div>
          </div>
        </button>

      </div>
    </header>
  );
}
