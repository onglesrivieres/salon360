import React from 'react';
import { X } from 'lucide-react';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  position?: 'left' | 'right';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  headerActions?: React.ReactNode;
  footer?: React.ReactNode;
}

const sizeClasses = {
  sm: 'md:w-80',
  md: 'md:w-96',
  lg: 'md:w-[32rem]',
  xl: 'md:w-[56rem]',
};

export function Drawer({ isOpen, onClose, title, children, position = 'right', size = 'md', headerActions, footer }: DrawerProps) {
  if (!isOpen) return null;

  const positionStyles = position === 'right' ? 'right-0' : 'left-0';
  const slideAnimation = position === 'right' ? 'animate-slide-in-right' : 'animate-slide-in-left';

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
        onClick={onClose}
      />
      <div
        className={`fixed top-0 ${positionStyles} h-full w-full ${sizeClasses[size]} bg-white shadow-xl z-50 flex flex-col ${slideAnimation}`}
      >
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <div className="flex items-center gap-2">
            {headerActions}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4">
          {children}
        </div>
        {footer && (
          <div className="flex-shrink-0 border-t border-gray-200 bg-white px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </>
  );
}
