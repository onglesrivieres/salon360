import { useState } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Select } from './ui/Select';

interface RemoveTechnicianModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string, notes: string) => void;
  technicianName: string;
  isSubmitting: boolean;
}

const REMOVAL_REASONS = [
  { value: 'Rule violation', label: 'Rule violation', hasCooldown: true },
  { value: 'Left work area without permission', label: 'Left work area without permission', hasCooldown: true },
  { value: 'Not following queue policy', label: 'Not following queue policy', hasCooldown: true },
  { value: 'Attendance policy violation', label: 'Attendance policy violation', hasCooldown: true },
  { value: 'Other', label: 'Other', hasCooldown: true },
  { value: 'Queue adjustment', label: 'Queue adjustment (no penalty)', hasCooldown: false },
];

export function RemoveTechnicianModal({
  isOpen,
  onClose,
  onConfirm,
  technicianName,
  isSubmitting
}: RemoveTechnicianModalProps) {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  const handleConfirm = () => {
    if (reason) {
      onConfirm(reason, notes);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setReason('');
      setNotes('');
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Remove Technician from Queue">
      <div className="space-y-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            You are about to remove <span className="font-semibold">{technicianName}</span> from the queue.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reason for Removal <span className="text-red-500">*</span>
          </label>
          <Select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isSubmitting}
          >
            <option value="">Select a reason...</option>
            {REMOVAL_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Additional Notes (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Provide additional details about the removal..."
            rows={3}
            disabled={isSubmitting}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
        </div>

        {(() => {
          const selectedReason = REMOVAL_REASONS.find(r => r.value === reason);
          const hasCooldown = selectedReason?.hasCooldown ?? true;

          if (!reason) {
            return (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-600">
                  Select a reason to continue.
                </p>
              </div>
            );
          }

          if (hasCooldown) {
            return (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800 font-medium">
                  Technician will be blocked from rejoining the queue for 30 minutes.
                </p>
              </div>
            );
          }

          return (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800 font-medium">
                Technician can rejoin the queue immediately.
              </p>
            </div>
          );
        })()}

        <div className="flex gap-3 pt-4">
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={isSubmitting}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirm}
            disabled={!reason || isSubmitting}
            className="flex-1"
          >
            {isSubmitting ? 'Removing...' : 'Confirm Removal'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
