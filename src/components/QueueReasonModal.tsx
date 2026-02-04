import { useState, useEffect } from 'react';
import { Modal } from './ui/Modal';
import { useAuth } from '../contexts/AuthContext';

const REASONS = ['Too difficult', 'Health', 'Lunch', 'Washroom', 'Others'] as const;
type Reason = typeof REASONS[number];

const REASON_I18N_KEYS: Record<Reason, string> = {
  'Too difficult': 'queue.reasonToodifficult',
  'Health': 'queue.reasonHealth',
  'Lunch': 'queue.reasonLunch',
  'Washroom': 'queue.reasonWashroom',
  'Others': 'queue.reasonOthers',
};

interface QueueReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string, notes: string) => void;
  title: string;
  confirmLabel: string;
  confirmingLabel: string;
  isSubmitting: boolean;
  confirmButtonColor: 'red' | 'yellow';
}

export function QueueReasonModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  confirmLabel,
  confirmingLabel,
  isSubmitting,
  confirmButtonColor,
}: QueueReasonModalProps) {
  const { t } = useAuth();
  const [reason, setReason] = useState<Reason | ''>('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setReason('');
      setNotes('');
    }
  }, [isOpen]);

  const canConfirm = reason !== '' && (reason !== 'Others' || notes.trim() !== '');

  const confirmColorClasses =
    confirmButtonColor === 'red'
      ? 'bg-red-600 text-white hover:bg-red-700'
      : 'bg-yellow-500 text-white hover:bg-yellow-600';

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isSubmitting) onClose();
      }}
      title={title}
    >
      <div className="space-y-3">
        <div className="space-y-2">
          {REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                setReason(r);
                if (r !== 'Others') setNotes('');
              }}
              disabled={isSubmitting}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-colors text-left ${
                reason === r
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  reason === r ? 'border-blue-500' : 'border-gray-300'
                }`}
              >
                {reason === r && (
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                )}
              </span>
              <span className={`text-sm font-medium ${reason === r ? 'text-blue-700' : 'text-gray-700'}`}>
                {t(REASON_I18N_KEYS[r])}
              </span>
            </button>
          ))}
        </div>

        {reason === 'Others' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('queue.notesRequired')} <span className="text-red-500">*</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('queue.notesPlaceholder')}
              rows={3}
              disabled={isSubmitting}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
          >
            {t('actions.cancel')}
          </button>
          <button
            onClick={() => onConfirm(reason, notes.trim())}
            disabled={!canConfirm || isSubmitting}
            className={`flex-1 px-6 py-2 rounded-lg transition-colors disabled:opacity-50 ${confirmColorClasses}`}
          >
            {isSubmitting ? confirmingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
