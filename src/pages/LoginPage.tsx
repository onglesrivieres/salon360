import React, { useState } from 'react';
import { Lock, Delete } from 'lucide-react';
import { authenticateWithPIN } from '../lib/auth';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import { LanguageSelector } from '../components/LanguageSelector';

export function LoginPage() {
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, t } = useAuth();
  const { showToast } = useToast();

  const handleNumberClick = async (num: string) => {
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);

      if (newPin.length === 4) {
        await submitPIN(newPin);
      }
    }
  };

  const submitPIN = async (pinToSubmit: string) => {
    setIsLoading(true);

    try {
      const session = await authenticateWithPIN(pinToSubmit);

      if (session) {
        login(session);
      } else {
        showToast(t('auth.invalidPIN'), 'error');
        setPin('');
      }
    } catch (error) {
      showToast(t('auth.invalidPIN'), 'error');
      setPin('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setPin('');
  };

  const handleKeyPress = async (e: React.KeyboardEvent) => {
    if (e.key >= '0' && e.key <= '9' && pin.length < 4) {
      const newPin = pin + e.key;
      setPin(newPin);

      if (newPin.length === 4) {
        await submitPIN(newPin);
      }
    } else if (e.key === 'Backspace') {
      setPin(pin.slice(0, -1));
    }
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4"
      onKeyDown={handleKeyPress}
      tabIndex={0}
    >
      <div className="absolute top-4 right-4">
        <LanguageSelector />
      </div>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Salon360</h1>
          <p className="text-gray-600">{t('auth.enterPIN')}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="mb-8">
            <div className="flex justify-center gap-3 mb-2">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-14 h-14 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                    pin.length > i
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-300 bg-white'
                  }`}
                >
                  {pin.length > i && (
                    <div className="w-3 h-3 bg-blue-600 rounded-full animate-pulse"></div>
                  )}
                </div>
              ))}
            </div>
            <p className="text-center text-xs text-gray-500 mt-2">
              {pin.length}/4 {t('auth.digitsEntered')}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
              <button
                key={num}
                onClick={() => handleNumberClick(num)}
                disabled={isLoading}
                className="h-16 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 rounded-xl text-2xl font-semibold text-gray-900 transition-all duration-150 transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {num}
              </button>
            ))}
            <div className="h-16"></div>
            <button
              onClick={() => handleNumberClick('0')}
              disabled={isLoading}
              className="h-16 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 rounded-xl text-2xl font-semibold text-gray-900 transition-all duration-150 transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              0
            </button>
            <button
              onClick={handleClear}
              disabled={isLoading || pin.length === 0}
              className="h-16 bg-red-50 hover:bg-red-100 active:bg-red-200 rounded-xl text-sm font-medium text-red-700 transition-all duration-150 transform active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed shadow-sm flex items-center justify-center gap-1"
            >
              <Delete className="w-4 h-4" />
              {t('actions.reset')}
            </button>
          </div>

          {isLoading && (
            <div className="text-center text-sm text-blue-600 font-medium">
              {t('messages.loading')}
            </div>
          )}
          {!isLoading && (
            <div className="text-center text-xs text-gray-500 mt-4">
              <p>{t('auth.autoSubmit')}</p>
            </div>
          )}
        </div>

        <div className="text-center mt-6 text-sm text-gray-600">
          <p>{t('auth.forgotPIN')}</p>
        </div>
      </div>
    </div>
  );
}
