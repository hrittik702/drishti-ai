import React from 'react';

/**
 * Drishti AI Monospace Status Badge
 * Compact data telemetry indicator with 4px border radius.
 */
export default function Badge({
  children,
  variant = 'slate',
  size = 'sm',
  pulse = false,
  className = '',
  ...props
}) {
  const variantClasses = {
    neutral: 'bg-zinc-100 text-zinc-900 border-zinc-200/90 font-semibold',
    neural: 'bg-[rgba(0,214,178,0.12)] text-[#008f77] border-[rgba(0,214,178,0.35)] font-semibold',
    emerald: 'bg-emerald-50/90 text-emerald-800 border-emerald-200/90 font-medium',
    amber: 'bg-amber-50/90 text-amber-800 border-amber-200/90 font-medium',
    rose: 'bg-rose-50/90 text-rose-800 border-rose-200/90 font-medium',
    slate: 'bg-zinc-100 text-zinc-700 border-zinc-200 font-medium',
  }[variant] || 'bg-zinc-100 text-zinc-700 border-zinc-200 font-medium';

  const sizeClasses = size === 'md' ? 'px-2 py-0.5 text-xs' : 'px-1.5 py-0.5 text-[10px]';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono rounded-md border uppercase tracking-wider select-none leading-none ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {pulse && (
        <span
          className={`w-1.5 h-1.5 rounded-full animate-pulse ${
            variant === 'neural'
              ? 'bg-[#00D6B2]'
              : variant === 'emerald'
              ? 'bg-emerald-500'
              : variant === 'amber'
              ? 'bg-amber-500'
              : variant === 'rose'
              ? 'bg-rose-500'
              : 'bg-zinc-600'
          }`}
        />
      )}
      {children}
    </span>
  );
}
