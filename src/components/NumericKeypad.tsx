import React, { useEffect, useState } from 'react';
import { X, Delete } from 'lucide-react';
import { useNumericKeypad } from '../contexts/NumericKeypadContext';

export function NumericKeypad() {
  const { isOpen, value, constraints, updateValue, closeKeypad, submitValue, inputRef } = useNumericKeypad();
  const [position, setPosition] = useState<{ top?: number; bottom?: number; left: number }>({ left: 0 });

  useEffect(() => {
    if (isOpen && inputRef?.current) {
      const keypadWidth = 320;
      const viewportWidth = window.innerWidth;

      // Center horizontally and position 100px from the top
      const centeredLeft = (viewportWidth - keypadWidth) / 2;
      setPosition({
        top: 100 + window.scrollY,
        left: Math.max(20, Math.min(centeredLeft + window.scrollX, viewportWidth - keypadWidth - 20 + window.scrollX)),
      });
    }
  }, [isOpen, inputRef]);

  if (!isOpen) return null;

  const handleNumberClick = (num: string) => {
    if (value === '0' && num !== '.') {
      updateValue(num);
    } else {
      updateValue(value + num);
    }
  };

  const handleDecimalClick = () => {
    const step = constraints.step || 0.01;
    const hasDecimalStep = step < 1 && step.toString().includes('.');

    if (!hasDecimalStep) return;
    if (value.includes('.')) return;

    updateValue(value === '' ? '0.' : value + '.');
  };

  const handleBackspace = () => {
    if (value.length > 0) {
      updateValue(value.slice(0, -1));
    }
  };

  const handleClear = () => {
    updateValue('');
  };

  const handleSubmit = () => {
    const numValue = parseFloat(value);
    if (value === '' || isNaN(numValue)) {
      return;
    }

    if (constraints.min !== undefined && numValue < constraints.min) {
      return;
    }

    if (constraints.max !== undefined && numValue > constraints.max) {
      return;
    }

    submitValue();
  };

  const isValidValue = () => {
    if (value === '' || value === '-') return false;
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return false;
    if (constraints.min !== undefined && numValue < constraints.min) return false;
    if (constraints.max !== undefined && numValue > constraints.max) return false;
    return true;
  };

  const step = constraints.step || 0.01;
  const hasDecimalStep = step < 1 && step.toString().includes('.');

  const positionStyle: React.CSSProperties = {
    position: 'fixed',
    ...(position.top !== undefined ? { top: `${position.top}px` } : {}),
    ...(position.bottom !== undefined ? { bottom: `${position.bottom}px` } : {}),
    left: `${position.left}px`,
    zIndex: 9999,
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-30 z-[9998] transition-opacity"
        onClick={closeKeypad}
        style={{ animation: 'fadeIn 0.2s ease-out' }}
      />

      <div
        style={positionStyle}
        className="bg-white rounded-xl shadow-2xl border border-gray-300 p-4 w-80 animate-slideUp"
      >
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Enter Value</h3>
          <button
            onClick={closeKeypad}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-3 mb-4 min-h-[60px] flex items-center justify-end">
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900 font-mono">
              {value || '0'}
            </div>
            {constraints.min !== undefined || constraints.max !== undefined ? (
              <div className="text-xs text-gray-500 mt-1">
                {constraints.min !== undefined && constraints.max !== undefined
                  ? `Range: ${constraints.min} - ${constraints.max}`
                  : constraints.min !== undefined
                  ? `Min: ${constraints.min}`
                  : `Max: ${constraints.max}`}
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          {['7', '8', '9'].map((num) => (
            <button
              key={num}
              onClick={() => handleNumberClick(num)}
              className="bg-white hover:bg-gray-100 active:bg-gray-200 border border-gray-300 rounded-lg h-14 text-xl font-semibold text-gray-800 transition-all duration-100 transform active:scale-95"
            >
              {num}
            </button>
          ))}
          {['4', '5', '6'].map((num) => (
            <button
              key={num}
              onClick={() => handleNumberClick(num)}
              className="bg-white hover:bg-gray-100 active:bg-gray-200 border border-gray-300 rounded-lg h-14 text-xl font-semibold text-gray-800 transition-all duration-100 transform active:scale-95"
            >
              {num}
            </button>
          ))}
          {['1', '2', '3'].map((num) => (
            <button
              key={num}
              onClick={() => handleNumberClick(num)}
              className="bg-white hover:bg-gray-100 active:bg-gray-200 border border-gray-300 rounded-lg h-14 text-xl font-semibold text-gray-800 transition-all duration-100 transform active:scale-95"
            >
              {num}
            </button>
          ))}
          <button
            onClick={handleClear}
            className="bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white rounded-lg h-14 text-sm font-semibold transition-all duration-100 transform active:scale-95"
          >
            Clear
          </button>
          <button
            onClick={() => handleNumberClick('0')}
            className="bg-white hover:bg-gray-100 active:bg-gray-200 border border-gray-300 rounded-lg h-14 text-xl font-semibold text-gray-800 transition-all duration-100 transform active:scale-95"
          >
            0
          </button>
          <button
            onClick={hasDecimalStep ? handleDecimalClick : undefined}
            disabled={!hasDecimalStep || value.includes('.')}
            className={`rounded-lg h-14 text-xl font-semibold transition-all duration-100 transform ${
              hasDecimalStep && !value.includes('.')
                ? 'bg-white hover:bg-gray-100 active:bg-gray-200 border border-gray-300 text-gray-800 active:scale-95'
                : 'bg-gray-200 border border-gray-300 text-gray-400 cursor-not-allowed'
            }`}
          >
            .
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleBackspace}
            className="bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-lg h-14 flex items-center justify-center gap-2 font-semibold transition-all duration-100 transform active:scale-95"
          >
            <Delete className="w-5 h-5" />
            Delete
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValidValue()}
            className={`rounded-lg h-14 font-semibold transition-all duration-100 transform ${
              isValidValue()
                ? 'bg-green-500 hover:bg-green-600 active:bg-green-700 text-white active:scale-95'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Done
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-slideUp {
          animation: slideUp 0.2s ease-out;
        }

        @media (max-width: 768px) {
          .animate-slideUp {
            position: fixed !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            top: auto !important;
            width: 100% !important;
            border-radius: 1rem 1rem 0 0 !important;
            max-width: 100% !important;
          }

          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateY(100%);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        }
      `}</style>
    </>
  );
}
