import React from 'react';

/**
 * Drishti AI Technical Content Card
 * 12px rounded corners with restrained neutral border and elevation.
 */
export default function Card({
  children,
  variant = 'default',
  className = '',
  onClick,
  ...props
}) {
  const base = 'rounded-xl transition-all duration-200';
  const variants = {
    default: 'bg-white border border-zinc-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.02)]',
    subtle: 'bg-zinc-50/80 border border-zinc-200/70',
    interactive:
      'bg-white border border-zinc-200/90 hover:border-zinc-300 hover:shadow-xs hover:-translate-y-0.5 active:translate-y-0 cursor-pointer',
    dark: 'bg-[#0e1713] border border-[#18261e] text-[#879d90]',
  }[variant] || 'bg-white border border-zinc-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.02)]';

  return (
    <div
      onClick={onClick}
      className={`${base} ${variants} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
