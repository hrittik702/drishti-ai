import React from 'react';
import { 
  LayoutDashboard, 
  Building2, 
  AlertTriangle,
  ShieldCheck, 
  Cpu,
  History, 
  Search, 
  Users,
  X,
  ChevronRight
} from 'lucide-react';
import CaseGuardLogo from './CaseGuardLogo';
import RoleIcon from './RoleIcon';

export default function SidebarNav({ 
  currentView, 
  setCurrentView, 
  currentUser, 
  currentRole, 
  integrityAlertCount = 0,
  casesCount = 0,
  documentsCount = 0,
  mobileOpen,
  setMobileOpen
}) {
  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard, badge: null },
    { id: 'centres', label: 'Training Centres', icon: Building2, badge: casesCount > 0 ? `${casesCount}` : null },
    { id: 'events', label: 'Compliance Events', icon: AlertTriangle, badge: integrityAlertCount > 0 ? `${integrityAlertCount} Alert${integrityAlertCount > 1 ? 's' : ''}` : null, alert: integrityAlertCount > 0 },
    { id: 'evidence', label: 'AI Evidence', icon: ShieldCheck, badge: documentsCount > 0 ? `${documentsCount}` : null },
    { id: 'integrity', label: 'Edge & Camera Health', icon: Cpu, badge: null },
    { id: 'audit', label: 'Verification Log', icon: History, badge: null },
    { id: 'search', label: 'Search', icon: Search, badge: null },
    { id: 'access', label: 'Users & Roles', icon: Users, badge: null }
  ];

  const isItemActive = (itemId) => {
    if (currentView === itemId) return true;
    if (itemId === 'centres' && currentView === 'cases') return true;
    if (itemId === 'evidence' && currentView === 'documents') return true;
    if (itemId === 'integrity' && currentView === 'health') return true;
    return false;
  };

  const handleNavClick = (viewId) => {
    setCurrentView(viewId);
    if (setMobileOpen) setMobileOpen(false);
  };

  // Close mobile drawer on Escape keypress
  React.useEffect(() => {
    if (!mobileOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setMobileOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, setMobileOpen]);

  const activeName = currentUser?.name || currentRole?.name || 'Officer';
  const activeRoleName = currentRole?.name || currentUser?.designation || 'Investigation Officer';
  const activeClearance = currentUser?.clearance || currentRole?.clearance || 'Confidential';

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div 
          onClick={() => setMobileOpen(false)} 
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden"
          aria-label="Close navigation"
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed top-0 bottom-0 left-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-200 ease-in-out
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Top Branding Section */}
        <div>
          <div className="h-14 sm:h-16 flex items-center justify-between px-5 border-b border-slate-100">
            <CaseGuardLogo size="md" />

            {/* Mobile Close Button (44x44 touch target) */}
            <button 
              onClick={() => setMobileOpen(false)}
              className="lg:hidden w-11 h-11 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg -mr-2 transition-colors"
              aria-label="Close navigation"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="p-3 space-y-1 mt-2">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = isItemActive(item.id);

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 min-h-[44px] rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>

                  {item.badge && (
                    <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${
                      item.alert
                        ? 'bg-red-50 text-red-700 border border-red-200 animate-pulse'
                        : isActive
                          ? 'bg-slate-800 text-slate-300'
                          : 'bg-slate-100 text-slate-600'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom User & Role Section: Clean, Institutional Session */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/50">
          <div 
            onClick={() => handleNavClick('access')}
            title="View Active Session & Access Policies"
            className="group bg-white hover:bg-blue-50/30 border border-slate-200 hover:border-slate-300 rounded-lg p-2.5 shadow-2xs space-y-2 cursor-pointer transition-colors"
          >
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono font-medium tracking-wider">
              <span>CURRENT ACCOUNT</span>
              <span className={`px-1.5 py-0.5 rounded font-mono font-medium text-[9px] uppercase border shrink-0 ${
                activeClearance === 'Top Secret' ? 'bg-red-50 text-red-700 border-red-200' :
                activeClearance === 'Secret' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                'bg-blue-50 text-blue-700 border-blue-200'
              }`}>
                {activeClearance}
              </span>
            </div>

            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-blue-50 border border-slate-200 group-hover:border-blue-200 flex items-center justify-center text-slate-700 shrink-0 transition-colors">
                <RoleIcon role={currentRole} className="w-4 h-4 text-slate-700 group-hover:text-blue-700" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-slate-900 group-hover:text-blue-700 transition-colors truncate">
                  {activeName}
                </div>
                <div className="text-[11px] text-slate-500 truncate font-normal">
                  {activeRoleName}
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 shrink-0 transition-colors" />
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
