import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

interface CriticalSettingConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  settingName: string;
  settingDescription: string;
  helpText: string;
  requiresRestart: boolean;
  currentValue: boolean | string | number;
  newValue: boolean | string | number;
}

export function CriticalSettingConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  settingName,
  settingDescription,
  helpText,
  requiresRestart,
  currentValue,
  newValue,
}: CriticalSettingConfirmationModalProps) {
  const [acknowledged, setAcknowledged] = useState(false);

  function handleConfirm() {
    if (!acknowledged) return;
    onConfirm();
    setAcknowledged(false);
  }

  function handleClose() {
    setAcknowledged(false);
    onClose();
  }

  const isBoolean = typeof currentValue === 'boolean' && typeof newValue === 'boolean';
  const action = isBoolean ? (newValue ? 'enable' : 'disable') : 'change';

  function formatValue(value: boolean | string | number): string {
    if (typeof value === 'boolean') {
      return value ? 'Enabled' : 'Disabled';
    }
    return String(value);
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="">
      <div className="p-6">
        <div className="flex items-start gap-4 mb-6">
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-orange-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              Critical Setting Change
            </h3>
            <p className="text-sm text-gray-600">
              You are about to {action} a critical setting that may affect business operations
            </p>
          </div>
          <button
            onClick={handleClose}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h4 className="font-medium text-gray-900">{settingName}</h4>
                <p className="text-sm text-gray-600 mt-1">{settingDescription}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-xs font-medium text-gray-500">
                  {isBoolean ? 'Status' : 'Value'}
                </span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded ${
                    isBoolean && currentValue
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {formatValue(currentValue)}
                  </span>
                  <span className="text-gray-400">→</span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    isBoolean && newValue
                      ? 'bg-green-100 text-green-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {formatValue(newValue)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {helpText && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h5 className="text-sm font-medium text-blue-900 mb-2">What This Means</h5>
              <p className="text-sm text-blue-800">{helpText}</p>
            </div>
          )}

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <h5 className="text-sm font-medium text-orange-900 mb-2">Important Notes</h5>
            <ul className="list-disc list-inside space-y-1 text-sm text-orange-800">
              <li>This change will affect all employees and operations</li>
              <li>The change takes effect immediately once confirmed</li>
              {requiresRestart && (
                <li className="font-medium">
                  This setting requires a page refresh for all users to take effect
                </li>
              )}
              <li>You can revert this change at any time from the Configuration page</li>
            </ul>
          </div>

          {requiresRestart && (
            <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
              <p className="text-sm text-yellow-800">
                <span className="font-medium">Requires Restart:</span> All users must refresh their browser for this change to take effect.
              </p>
            </div>
          )}

          <label className="flex items-start gap-3 p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">
              I understand the impact of this change and confirm that I want to {action} <span className="font-medium">{settingName}</span>
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-200">
          <Button
            variant="ghost"
            onClick={handleClose}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!acknowledged}
            className={!acknowledged ? 'opacity-50 cursor-not-allowed' : ''}
          >
            Confirm Change
          </Button>
        </div>
      </div>
    </Modal>
  );
}
