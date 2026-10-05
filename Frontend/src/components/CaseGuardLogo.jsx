import React from 'react';

export function CaseGuardMark({ className = 'w-5 h-5', ...props }) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Geometric Shield Contour */}
      <path 
        d="M12 2.5L4.5 5.5V11.2C4.5 15.8 7.7 20.1 12 21.5C16.3 20.1 19.5 15.8 19.5 11.2V5.5L12 2.5Z" 
        stroke="currentColor" 
        strokeWidth="1.75" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      {/* Inner Document & Verification Vault Geometry */}
      <path 
        d="M8.5 10H15.5" 
        stroke="currentColor" 
        strokeWidth="1.5" 
        strokeLinecap="round" 
        strokeOpacity="0.6"
      />
      <path 
        d="M9 13.5L11 15.5L15 11.5" 
        stroke="currentColor" 
        strokeWidth="1.75" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function CaseGuardLogo({ 
  size = 'md', 
  showWordmark = true, 
  subtitle = 'Edge-AI Compliance Monitoring',
  badgeText = 'EDGE-AI',
  className = '' 
}) {
  const sizeConfig = {
    sm: {
      box: 'w-7 h-7 rounded-md',
      mark: 'w-4 h-4',
      title: 'text-sm',
      badge: 'text-[9px] px-1 py-0.2',
      sub: 'text-[10px]'
    },
    md: {
      box: 'w-9 h-9 rounded-lg',
      mark: 'w-5 h-5',
      title: 'text-base',
      badge: 'text-[10px] px-1.5 py-0.5',
      sub: 'text-xs'
    },
    lg: {
      box: 'w-11 h-11 rounded-xl',
      mark: 'w-6 h-6',
      title: 'text-xl',
      badge: 'text-xs px-2 py-0.5',
      sub: 'text-xs'
    }
  };

  const config = sizeConfig[size] || sizeConfig.md;

  return (
    <div className={`flex items-center space-x-2.5 ${className}`}>
      {/* Icon Mark Container */}
      <div 
        className={`${config.box} bg-slate-900 flex items-center justify-center text-blue-400 shadow-2xs shrink-0 select-none border border-slate-800`}
        title="COMPLIANCEGUARD Edge-AI Monitoring"
      >
        <CaseGuardMark className={config.mark} />
      </div>

      {/* Optional Wordmark */}
      {showWordmark && (
        <div className="min-w-0">
          <div className="flex items-center space-x-1.5 leading-none">
            <span className={`font-semibold tracking-tight text-slate-900 font-mono ${config.title}`}>
              COMPLIANCEGUARD
            </span>
            {badgeText && (
              <span className={`font-mono font-medium bg-blue-50 text-blue-700 rounded border border-blue-200 tracking-wider shrink-0 ${config.badge}`}>
                {badgeText}
              </span>
            )}
          </div>
          {subtitle && (
            <div className={`text-slate-500 font-normal leading-none mt-1 truncate ${config.sub}`}>
              {subtitle}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
