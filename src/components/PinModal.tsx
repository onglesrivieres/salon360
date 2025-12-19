import { useState, useEffect, useRef } from 'react';
import { Modal } from './ui/Modal';
import { Lock, Delete, X } from 'lucide-react';

interface PinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (pin: string) => void;
  title?: string;
  isLoading?: boolean;
  error?: string;
}

export function PinModal({ isOpen, onClose, onSubmit, title = 'Enter PIN', isLoading = false, error }: PinModalProps) {
  const [pin, setPin] = useState(['', '', '', '']);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => {
    const checkMobileDevice = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobile = /iphone|ipad|ipod|android|webos|blackberry|windows phone/.test(userAgent);
      const isTablet = /ipad|android(?!.*mobile)/.test(userAgent) ||
                       (navigator.maxTouchPoints > 1 && /macintosh/.test(userAgent));
      setIsMobileDevice(isMobile || isTablet);
    };

    checkMobileDevice();
  }, []);

  useEffect(() => {
    if (isOpen) {
      setPin(['', '', '', '']);
      setCurrentPosition(0);
      if (!isMobileDevice) {
        setTimeout(() => inputRefs[0].current?.focus(), 100);
      }
    }
  }, [isOpen, isMobileDevice]);

  useEffect(() => {
    if (error) {
      setPin(['', '', '', '']);
      setCurrentPosition(0);
      if (!isMobileDevice) {
        setTimeout(() => inputRefs[0].current?.focus(), 100);
      }
    }
  }, [error, isMobileDevice]);

  useEffect(() => {
    const firstEmptyIndex = pin.findIndex(digit => !digit);
    setCurrentPosition(firstEmptyIndex === -1 ? 3 : firstEmptyIndex);
  }, [pin]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newPin = [...pin];
    newPin[index] = value.slice(-1);
    setPin(newPin);

    if (value && index < 3) {
      inputRefs[index + 1].current?.focus();
    }

    if (newPin.every(digit => digit !== '') && !isLoading) {
      const pinCode = newPin.join('');
      onSubmit(pinCode);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 4);
    if (!/^\d+$/.test(pastedData)) return;

    const newPin = pastedData.split('').concat(['', '', '', '']).slice(0, 4);
    setPin(newPin);

    const nextEmptyIndex = newPin.findIndex(digit => !digit);
    if (nextEmptyIndex !== -1) {
      inputRefs[nextEmptyIndex].current?.focus();
    } else {
      inputRefs[3].current?.focus();
      if (!isLoading) {
        onSubmit(newPin.join(''));
      }
    }
  };

  const handleNumberPadClick = (value: string) => {
    if (isLoading) return;

    const firstEmptyIndex = pin.findIndex(digit => !digit);
    if (firstEmptyIndex === -1) return;

    const newPin = [...pin];
    newPin[firstEmptyIndex] = value;
    setPin(newPin);

    if (!isMobileDevice) {
      if (firstEmptyIndex < 3) {
        inputRefs[firstEmptyIndex + 1].current?.focus();
      } else {
        inputRefs[3].current?.focus();
      }
    }

    if (newPin.every(digit => digit !== '')) {
      onSubmit(newPin.join(''));
    }
  };

  const handleBackspace = () => {
    if (isLoading) return;

    const lastFilledIndex = [...pin].reverse().findIndex(digit => digit !== '');
    if (lastFilledIndex === -1) return;

    const actualIndex = 3 - lastFilledIndex;
    const newPin = [...pin];
    newPin[actualIndex] = '';
    setPin(newPin);

    if (!isMobileDevice) {
      inputRefs[actualIndex].current?.focus();
    }
  };

  const handleClear = () => {
    if (isLoading) return;
    setPin(['', '', '', '']);

    if (!isMobileDevice) {
      inputRefs[0].current?.focus();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="text-center py-4">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8 text-blue-600" />
        </div>

        <p className="text-gray-600 mb-6">Enter your 4-digit PIN</p>

        <div className="flex gap-3 justify-center mb-4">
          {pin.map((digit, index) => (
            <input
              key={index}
              ref={inputRefs[index]}
              type="password"
              inputMode={isMobileDevice ? "none" : "numeric"}
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              disabled={isLoading}
              readOnly={isMobileDevice}
              className={`w-14 h-14 text-center text-2xl font-bold border-2 rounded-lg focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed transition-all ${
                isMobileDevice && currentPosition === index
                  ? 'border-blue-600 bg-blue-50'
                  : isMobileDevice
                  ? 'border-gray-300'
                  : 'border-gray-300 focus:border-blue-600'
              }`}
            />
          ))}
        </div>

        {error && (
          <p className="text-red-600 text-sm mb-4">{error}</p>
        )}

        {isLoading && (
          <p className="text-gray-500 text-sm">Verifying...</p>
        )}

        {/* On-Screen Number Pad */}
        <div className="max-w-xs mx-auto mt-6 mb-4">
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handleNumberPadClick(num.toString())}
                disabled={isLoading}
                className="w-16 h-16 text-xl font-semibold bg-gray-100 hover:bg-gray-200 active:bg-gray-300 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transform"
              >
                {num}
              </button>
            ))}
            <button
              onClick={handleClear}
              disabled={isLoading}
              className="w-16 h-16 bg-red-100 hover:bg-red-200 active:bg-red-300 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center active:scale-95 transform"
              title="Clear All"
            >
              <X className="w-6 h-6 text-red-700" />
            </button>
            <button
              onClick={() => handleNumberPadClick('0')}
              disabled={isLoading}
              className="w-16 h-16 text-xl font-semibold bg-gray-100 hover:bg-gray-200 active:bg-gray-300 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transform"
            >
              0
            </button>
            <button
              onClick={handleBackspace}
              disabled={isLoading}
              className="w-16 h-16 bg-yellow-100 hover:bg-yellow-200 active:bg-yellow-300 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center active:scale-95 transform"
              title="Backspace"
            >
              <Delete className="w-6 h-6 text-yellow-700" />
            </button>
          </div>
        </div>

        <button
          onClick={onClose}
          disabled={isLoading}
          className="mt-4 px-6 py-2 text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </Modal>
  );
}
