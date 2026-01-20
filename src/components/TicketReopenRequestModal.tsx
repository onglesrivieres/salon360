import React, { useState, useEffect } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

interface TicketInfo {
  id: string;
  ticket_no: string;
  customer_name: string;
  total: number;
  ticket_date: string;
}

interface TicketReopenRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { reason_comment: string; requested_changes_description: string }) => Promise<void>;
  ticket: TicketInfo | null;
}

export function TicketReopenRequestModal({
  isOpen,
  onClose,
  onSubmit,
  ticket,
}: TicketReopenRequestModalProps) {
  const [requestedChanges, setRequestedChanges] = useState('');
  const [reasonComment, setReasonComment] = useState('');
  const [errors, setErrors] = useState<{ changes?: string; reason?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setRequestedChanges('');
      setReasonComment('');
      setErrors({});
    }
  }, [isOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const newErrors: { changes?: string; reason?: string } = {};

    if (!requestedChanges.trim()) {
      newErrors.changes = 'Please describe what changes are needed';
    }

    if (!reasonComment.trim()) {
      newErrors.reason = 'Please explain why this change is needed';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        reason_comment: reasonComment.trim(),
        requested_changes_description: requestedChanges.trim(),
      });
      handleClose();
    } catch (error) {
      // Error handling is done in parent component
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleClose() {
    setRequestedChanges('');
    setReasonComment('');
    setErrors({});
    onClose();
  }

  if (!ticket) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Request Ticket Changes">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Current Ticket Info */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Ticket Information</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-500">Ticket #:</span>{' '}
              <span className="font-medium">{ticket.ticket_no}</span>
            </div>
            <div>
              <span className="text-gray-500">Total:</span>{' '}
              <span className="font-medium">${ticket.total.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-gray-500">Customer:</span>{' '}
              <span className="font-medium">{ticket.customer_name || 'Walk-in'}</span>
            </div>
            <div>
              <span className="text-gray-500">Date:</span>{' '}
              <span className="font-medium">{ticket.ticket_date}</span>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-sm text-amber-800">
            This ticket is closed. Since you don't have permission to reopen it directly,
            you can request a Manager, Owner, or Admin to review and reopen it for you.
          </p>
        </div>

        {/* What Changes Are Needed */}
        <div>
          <label htmlFor="requestedChanges" className="block text-sm font-medium text-gray-700 mb-1">
            What changes are needed? *
          </label>
          <textarea
            id="requestedChanges"
            value={requestedChanges}
            onChange={(e) => {
              setRequestedChanges(e.target.value);
              if (errors.changes) setErrors({ ...errors, changes: undefined });
            }}
            placeholder="Describe what needs to be changed on this ticket (e.g., service price, payment method, technician assignment)..."
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.changes ? 'border-red-500' : 'border-gray-300'
            }`}
            rows={3}
          />
          {errors.changes && <p className="text-red-500 text-xs mt-1">{errors.changes}</p>}
        </div>

        {/* Reason */}
        <div>
          <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">
            Reason for this request *
          </label>
          <textarea
            id="reason"
            value={reasonComment}
            onChange={(e) => {
              setReasonComment(e.target.value);
              if (errors.reason) setErrors({ ...errors, reason: undefined });
            }}
            placeholder="Explain why this change is needed (e.g., customer complaint, input error, missing service)..."
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.reason ? 'border-red-500' : 'border-gray-300'
            }`}
            rows={3}
          />
          {errors.reason && <p className="text-red-500 text-xs mt-1">{errors.reason}</p>}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit Request'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
