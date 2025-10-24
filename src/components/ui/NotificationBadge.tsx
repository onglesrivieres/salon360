import React from 'react';

interface NotificationBadgeProps {
  count: number;
  variant?: 'default' | 'urgent';
  pulse?: boolean;
}

export function NotificationBadge({ count, variant = 'default', pulse = false }: NotificationBadgeProps) {
  if (count === 0) return null;

  const baseClasses = 'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold';

  const variantClasses = variant === 'urgent'
    ? 'bg-red-600 text-white'
    : 'bg-blue-600 text-white';

  const pulseClasses = pulse ? 'animate-pulse' : '';

  return (
    <span className={`${baseClasses} ${variantClasses} ${pulseClasses}`}>
      {count > 99 ? '99+' : count}
    </span>
  );
}
