import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  headerActions?: React.ReactNode;
  onConfirm?: () => void;
  confirmText?: string;
  confirmVariant?: 'default' | 'danger';
  cancelText?: string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  headerActions,
  onConfirm,
  confirmText,
  confirmVariant = 'default',
  cancelText,
}: ModalProps) {
  if (!isOpen) return null;

  const hasFooter = onConfirm || cancelText;

  const sizeStyles = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className={`bg-white rounded-lg shadow-xl w-full ${sizeStyles[size]} max-h-[90vh] overflow-y-auto`}>
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            {headerActions && (
              <div className="flex items-center gap-2">
                {headerActions}
              </div>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 ml-auto"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="px-6 py-4">
            {children}
          </div>
          {hasFooter && (
            <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
              {cancelText && (
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {cancelText}
                </button>
              )}
              {onConfirm && (
                <button
                  onClick={onConfirm}
                  className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                    confirmVariant === 'danger'
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {confirmText || 'Confirm'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
