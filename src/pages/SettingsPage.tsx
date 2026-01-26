import React, { useState } from 'react';
import { Key, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { changePIN } from '../lib/auth';

export function SettingsPage() {
  const { showToast } = useToast();
  const { session, t } = useAuth();

  const [oldPIN, setOldPIN] = useState('');
  const [newPIN, setNewPIN] = useState('');
  const [confirmPIN, setConfirmPIN] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleChangePIN(e: React.FormEvent) {
    e.preventDefault();

    if (!/^\d{4}$/.test(oldPIN)) {
      showToast(t('settings.currentPinMust4Digits'), 'error');
      return;
    }

    if (!/^\d{4}$/.test(newPIN)) {
      showToast(t('settings.newPinMust4Digits'), 'error');
      return;
    }

    if (newPIN !== confirmPIN) {
      showToast(t('settings.pinsDoNotMatch'), 'error');
      return;
    }

    if (oldPIN === newPIN) {
      showToast(t('settings.pinMustBeDifferent'), 'error');
      return;
    }

    if (!session) {
      showToast(t('settings.sessionExpired'), 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await changePIN(session.employee_id, oldPIN, newPIN);

      if (result.success) {
        showToast(t('settings.pinChangedSuccess'), 'success');
        setOldPIN('');
        setNewPIN('');
        setConfirmPIN('');
      } else {
        showToast(result.error || t('settings.failedToChangePIN'), 'error');
      }
    } catch (error) {
      showToast(t('settings.anErrorOccurred'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-gray-900 mb-3">{t('settings.title')}</h2>
      </div>

      <div className="max-w-2xl">
        <div className="mb-4">
            <p className="text-sm text-gray-600">
              {t('settings.updatePinMessage')}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-start gap-3 mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">{t('settings.securityTips')}</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>{t('settings.securityTip1')}</li>
                  <li>{t('settings.securityTip2')}</li>
                  <li>{t('settings.securityTip3')}</li>
                  <li>{t('settings.securityTip4')}</li>
                </ul>
              </div>
            </div>

            <form onSubmit={handleChangePIN} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('auth.currentPIN')}
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="\d{4}"
                  maxLength={4}
                  value={oldPIN}
                  onChange={(e) => setOldPIN(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full px-4 py-3 text-2xl tracking-widest text-center border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="border-t border-gray-200 pt-6">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('auth.newPIN')}
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="\d{4}"
                    maxLength={4}
                    value={newPIN}
                    onChange={(e) => setNewPIN(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    className="w-full px-4 py-3 text-2xl tracking-widest text-center border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('settings.confirmNewPin')}
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="\d{4}"
                    maxLength={4}
                    value={confirmPIN}
                    onChange={(e) => setConfirmPIN(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    className="w-full px-4 py-3 text-2xl tracking-widest text-center border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setOldPIN('');
                    setNewPIN('');
                    setConfirmPIN('');
                  }}
                >
                  {t('common.clear')}
                </Button>
                <Button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    oldPIN.length !== 4 ||
                    newPIN.length !== 4 ||
                    confirmPIN.length !== 4
                  }
                >
                  {isSubmitting ? t('settings.changingPin') : t('auth.changePIN')}
                </Button>
              </div>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex items-start gap-2 text-sm text-gray-600">
                <Key className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                <p>
                  {t('settings.forgotPinMessage')}
                </p>
              </div>
            </div>
          </div>
        </div>
    </div>
  );
}
