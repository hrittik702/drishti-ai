import React from 'react';

/**
 * Drishti AI Precision Control Button
 * Balanced 8px rounded corners with restrained micro-motion feedback.
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  className = '',
  disabled = false,
  type = 'button',
  onClick,
  ...props
}) {
  const customClasses = {
    primary:
      'bg-zinc-900 hover:bg-zinc-800 text-white font-medium rounded-lg shadow-xs active:bg-zinc-950 focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2',
    secondary:
      'bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-medium border border-zinc-200 rounded-lg active:bg-zinc-200/80',
    outline:
      'bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-300 hover:border-zinc-400 font-medium rounded-lg shadow-2xs active:bg-zinc-100',
    neural:
      'bg-zinc-900 hover:bg-zinc-800 text-white font-medium rounded-lg border border-[rgba(0,214,178,0.45)] shadow-[0_0_12px_rgba(0,214,178,0.12)] active:bg-zinc-950 focus-visible:ring-2 focus-visible:ring-[#00D6B2]',
    ghost:
      'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100/80 rounded-lg font-medium active:bg-zinc-200/50',
    danger:
      'bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-lg shadow-xs active:bg-rose-800',
  }[variant] || 'bg-zinc-900 hover:bg-zinc-800 text-white font-medium rounded-lg shadow-xs';

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs gap-1.5 min-h-[32px]',
    md: 'px-4 py-2 text-xs font-medium gap-2 min-h-[38px]',
    lg: 'px-5 py-2.5 text-sm font-medium gap-2.5 min-h-[44px]',
  }[size] || 'px-4 py-2 text-xs font-medium gap-2 min-h-[38px]';

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`font-sans transition-all duration-150 active:scale-[0.98] select-none inline-flex items-center justify-center cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 ${sizeClasses} ${customClasses} ${className}`}
      {...props}
    >
      {icon && <span className="shrink-0 flex items-center">{icon}</span>}
      {children}
    </button>
  );
}
