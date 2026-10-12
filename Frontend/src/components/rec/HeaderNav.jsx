import React from 'react';
import Badge from './Badge';
import { Play, CheckCircle2, LayoutDashboard } from 'lucide-react';

/**
 * Drishti AI Navigation Header
 * Floating capsule navigation dock with elegant cursive brand mark and live system status.
 */
export default function HeaderNav({
  currentView,
  setCurrentView,
  health,
  isAnalyzing = false,
  hasResults = false,
}) {
  const navTabs = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'analysis', label: 'Video Analysis', icon: Play, alert: isAnalyzing },
    { id: 'results', label: 'Results', icon: CheckCircle2, badge: hasResults ? 'ready' : null },
  ];

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-[#faf9f6]/90 border-b border-zinc-200/70 transition-all duration-200">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-8 lg:px-[75px] h-16 flex items-center justify-between">
        {/* Brand Mark: Drishti in cursive/italic, AI in regular interface font */}
        <div
          onClick={() => setCurrentView('overview')}
          className="flex items-center cursor-pointer select-none group"
        >
          <div className="flex items-baseline">
            <span className="font-editorial italic font-normal text-2xl sm:text-[28px] text-zinc-900 group-hover:text-zinc-700 transition-colors">
              Drishti
            </span>
            <span className="font-display font-black text-xl sm:text-2xl text-zinc-950 tracking-tight ml-1.5">
              AI
            </span>
          </div>
        </div>

        {/* Center: Animated Capsule Pill Navigation Dock */}
        <nav
          className="flex items-center p-1 rounded-full bg-zinc-200/60 border border-zinc-200/80 backdrop-blur-md shadow-2xs gap-0.5"
          aria-label="Main Navigation"
        >
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentView === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setCurrentView(tab.id)}
                className={`relative px-3 sm:px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer select-none flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-white text-zinc-950 font-semibold shadow-xs border border-zinc-200/90'
                    : 'text-zinc-600 hover:text-zinc-950 hover:bg-white/40'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-zinc-900' : 'text-zinc-500'}`} />
                <span>{tab.label}</span>

                {tab.alert && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00D6B2] animate-pulse" />
                )}
                {tab.badge && !isActive && (
                  <span className="text-[9px] font-mono px-1 rounded-xs bg-zinc-100 text-zinc-600 border border-zinc-200">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right: Operational Telemetry Badge */}
        <div className="flex items-center gap-2">
          {health ? (
            <Badge variant="neural" pulse={true} size="sm" className="hidden sm:inline-flex">
              ONLINE
            </Badge>
          ) : (
            <Badge variant="rose" size="sm" className="hidden sm:inline-flex">
              BACKEND OFFLINE
            </Badge>
          )}

          <div
            className={`w-2.5 h-2.5 rounded-full sm:hidden ${
              health ? 'bg-[#00D6B2] animate-pulse' : 'bg-rose-500'
            }`}
            title={health ? 'Backend Online' : 'Backend Offline'}
          />
        </div>
      </div>
    </header>
  );
}
