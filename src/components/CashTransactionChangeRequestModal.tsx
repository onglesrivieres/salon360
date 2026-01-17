import React, { useState, useEffect } from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { NumericInput } from './ui/NumericInput';
import { CashTransactionWithDetails } from '../lib/supabase';

interface CashTransactionChangeRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ChangeRequestData) => Promise<void>;
  transaction: CashTransactionWithDetails | null;
}

export interface ChangeRequestData {
  proposed_amount: number | null;
  proposed_category: string | null;
  proposed_description: string | null;
  proposed_date: string | null;
  is_deletion_request: boolean;
  reason_comment: string;
}

const WITHDRAWAL_CATEGORIES = ['Payroll', 'Tip Payout', 'Headquarter Deposit', 'Other'];
const DEPOSIT_CATEGORIES = ['Safe Deposit'];

export function CashTransactionChangeRequestModal({
  isOpen,
  onClose,
  onSubmit,
  transaction,
}: CashTransactionChangeRequestModalProps) {
  const [proposedAmount, setProposedAmount] = useState('');
  const [proposedCategory, setProposedCategory] = useState('');
  const [proposedDescription, setProposedDescription] = useState('');
  const [proposedDate, setProposedDate] = useState('');
  const [isDeletionRequest, setIsDeletionRequest] = useState(false);
  const [reasonComment, setReasonComment] = useState('');
  const [errors, setErrors] = useState<{ reason?: string; change?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when transaction changes
  useEffect(() => {
    if (transaction && isOpen) {
      setProposedAmount(transaction.amount.toString());
      setProposedCategory(transaction.category || '');
      setProposedDescription(transaction.description);
      setProposedDate(transaction.date);
      setIsDeletionRequest(false);
      setReasonComment('');
      setErrors({});
    }
  }, [transaction, isOpen]);

  const isWithdrawal = transaction?.transaction_type === 'cash_payout';
  const categories = isWithdrawal ? WITHDRAWAL_CATEGORIES : DEPOSIT_CATEGORIES;

  function hasChanges(): boolean {
    if (!transaction) return false;
    if (isDeletionRequest) return true;

    const amountChanged = parseFloat(proposedAmount) !== transaction.amount;
    const categoryChanged = proposedCategory !== (transaction.category || '');
    const descriptionChanged = proposedDescription.trim() !== transaction.description;
    const dateChanged = proposedDate !== transaction.date;

    return amountChanged || categoryChanged || descriptionChanged || dateChanged;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const newErrors: { reason?: string; change?: string } = {};

    if (!reasonComment.trim()) {
      newErrors.reason = 'Please explain why you need this change';
    }

    if (!hasChanges()) {
      newErrors.change = 'Please make at least one change or request deletion';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (!transaction) return;

    setIsSubmitting(true);
    try {
      const data: ChangeRequestData = {
        proposed_amount: null,
        proposed_category: null,
        proposed_description: null,
        proposed_date: null,
        is_deletion_request: isDeletionRequest,
        reason_comment: reasonComment.trim(),
      };

      // Only include changed fields if not deletion
      if (!isDeletionRequest) {
        if (parseFloat(proposedAmount) !== transaction.amount) {
          data.proposed_amount = parseFloat(proposedAmount);
        }
        if (proposedCategory !== (transaction.category || '')) {
          data.proposed_category = proposedCategory;
        }
        if (proposedDescription.trim() !== transaction.description) {
          data.proposed_description = proposedDescription.trim();
        }
        if (proposedDate !== transaction.date) {
          data.proposed_date = proposedDate;
        }
      }

      await onSubmit(data);
      handleClose();
    } catch (error) {
      // Error handling is done in parent component
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleClose() {
    setProposedAmount('');
    setProposedCategory('');
    setProposedDescription('');
    setProposedDate('');
    setIsDeletionRequest(false);
    setReasonComment('');
    setErrors({});
    onClose();
  }

  if (!transaction) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Request Transaction Change">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Current Transaction Info */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Current Transaction</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-500">Type:</span>{' '}
              <span className="font-medium">
                {transaction.transaction_type === 'cash_payout' ? 'Withdrawal' : 'Deposit'}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Amount:</span>{' '}
              <span className="font-medium">${transaction.amount.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-gray-500">Category:</span>{' '}
              <span className="font-medium">{transaction.category || '-'}</span>
            </div>
            <div>
              <span className="text-gray-500">Date:</span>{' '}
              <span className="font-medium">{transaction.date}</span>
            </div>
          </div>
          <div className="mt-2 text-sm">
            <span className="text-gray-500">Description:</span>{' '}
            <span className="font-medium">{transaction.description}</span>
          </div>
        </div>

        {/* Deletion Option */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isDeletionRequest}
              onChange={(e) => {
                setIsDeletionRequest(e.target.checked);
                if (errors.change) setErrors({ ...errors, change: undefined });
              }}
              className="w-4 h-4 text-red-600 rounded border-gray-300 focus:ring-red-500"
            />
            <div className="flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-red-600" />
              <span className="text-sm font-medium text-red-800">Request to delete this transaction</span>
            </div>
          </label>
          {isDeletionRequest && (
            <div className="mt-2 ml-7 flex items-start gap-2 text-xs text-red-700">
              <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
              <span>This will permanently remove the transaction if approved.</span>
            </div>
          )}
        </div>

        {/* Proposed Changes (disabled if deletion is selected) */}
        {!isDeletionRequest && (
          <>
            <div className="border-t border-gray-200 pt-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Proposed Changes</h4>

              <div className="space-y-3">
                <div>
                  <label htmlFor="proposedAmount" className="block text-sm font-medium text-gray-700 mb-1">
                    Amount
                  </label>
                  <NumericInput
                    id="proposedAmount"
                    step="0.01"
                    min="0.01"
                    value={proposedAmount}
                    onChange={(e) => {
                      setProposedAmount(e.target.value);
                      if (errors.change) setErrors({ ...errors, change: undefined });
                    }}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label htmlFor="proposedCategory" className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <select
                    id="proposedCategory"
                    value={proposedCategory}
                    onChange={(e) => {
                      setProposedCategory(e.target.value);
                      if (errors.change) setErrors({ ...errors, change: undefined });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a category...</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="proposedDate" className="block text-sm font-medium text-gray-700 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    id="proposedDate"
                    value={proposedDate}
                    onChange={(e) => {
                      setProposedDate(e.target.value);
                      if (errors.change) setErrors({ ...errors, change: undefined });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="proposedDescription" className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    id="proposedDescription"
                    value={proposedDescription}
                    onChange={(e) => {
                      setProposedDescription(e.target.value);
                      if (errors.change) setErrors({ ...errors, change: undefined });
                    }}
                    placeholder="Enter description..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={2}
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {errors.change && (
          <p className="text-red-500 text-xs">{errors.change}</p>
        )}

        {/* Reason */}
        <div className="border-t border-gray-200 pt-4">
          <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">
            Reason for Change *
          </label>
          <textarea
            id="reason"
            value={reasonComment}
            onChange={(e) => {
              setReasonComment(e.target.value);
              if (errors.reason) setErrors({ ...errors, reason: undefined });
            }}
            placeholder="Explain why this change is needed..."
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
            {isSubmitting ? 'Submitting...' : 'Submit Change Request'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
