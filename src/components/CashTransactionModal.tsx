import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { NumericInput } from './ui/NumericInput';
import { CashTransactionType } from '../lib/supabase';

interface CashTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: TransactionData) => void;
  transactionType: CashTransactionType;
  defaultCategory?: string;
  defaultDescription?: string;
  mode?: 'create' | 'edit';
  transactionId?: string;
  initialData?: {
    amount: number;
    description?: string;
    category: string;
  };
  onVoid?: (reason: string) => void;
  canVoid?: boolean;
  transactionStatus?: string;
}

export interface TransactionData {
  amount: number;
  description?: string;
  category: string;
  editReason?: string;
  transactionId?: string;
}

const CASH_IN_CATEGORIES = [
  'Change Fund',
  'Other',
];

const CASH_OUT_CATEGORIES = [
  'Safe Deposit',
  'Supplies Purchase',
  'Tip Payout',
  'Change Fund',
  'Vendor Payment',
  'Other',
];

export function CashTransactionModal({
  isOpen,
  onClose,
  onSubmit,
  transactionType,
  defaultCategory,
  defaultDescription,
  mode = 'create',
  transactionId,
  initialData,
  onVoid,
  canVoid,
  transactionStatus,
}: CashTransactionModalProps) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [editReason, setEditReason] = useState('');
  const [errors, setErrors] = useState<{ amount?: string; category?: string }>({});
  const [isVoidMode, setIsVoidMode] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [voidError, setVoidError] = useState<string | null>(null);

  const showVoidButton = mode === 'edit' && canVoid && transactionStatus === 'approved' && onVoid;

  React.useEffect(() => {
    if (isOpen) {
      setIsVoidMode(false);
      setVoidReason('');
      setVoidError(null);
      if (mode === 'edit' && initialData) {
        setAmount(initialData.amount.toString());
        setDescription(initialData.description || '');
        setCategory(initialData.category);
        setEditReason('');
      } else {
        setDescription(defaultDescription || '');
        setCategory(defaultCategory || '');
      }
    }
  }, [isOpen, mode, initialData, defaultCategory, defaultDescription]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const newErrors: { amount?: string; category?: string } = {};

    if (!amount || parseFloat(amount) <= 0) {
      newErrors.amount = 'Please enter a valid amount greater than 0';
    }

    if (!category) {
      newErrors.category = 'Please select a category';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit({
      amount: parseFloat(amount),
      description: description.trim() || undefined,
      category: category,
      editReason: mode === 'edit' ? editReason.trim() || undefined : undefined,
      transactionId: mode === 'edit' ? transactionId : undefined,
    });

    handleClose();
  }

  function handleClose() {
    setAmount('');
    setDescription('');
    setCategory('');
    setEditReason('');
    setErrors({});
    setIsVoidMode(false);
    setVoidReason('');
    setVoidError(null);
    onClose();
  }

  function handleVoidSubmit() {
    if (!voidReason.trim()) {
      setVoidError('Please provide a reason for voiding this transaction');
      return;
    }
    if (onVoid) {
      onVoid(voidReason.trim());
      handleClose();
    }
  }

  const title = mode === 'edit'
    ? (transactionType === 'cash_in' ? 'Edit Cash In Transaction' : 'Edit Cash Out Transaction')
    : (transactionType === 'cash_in' ? 'Add Cash In Transaction' : 'Add Cash Out Transaction');

  const availableCategories = transactionType === 'cash_in' ? CASH_IN_CATEGORIES : CASH_OUT_CATEGORIES;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={isVoidMode ? 'Void Transaction' : title}>
      {isVoidMode ? (
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-red-800">Request to Void Transaction</h4>
                <p className="text-sm text-red-700 mt-1">
                  This will submit a request to permanently delete this transaction. An Owner or Admin must approve before it takes effect.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Transaction to void:</p>
            <p className="text-sm font-medium text-gray-900">
              ${initialData?.amount.toFixed(2)} - {initialData?.category}
            </p>
            {initialData?.description && (
              <p className="text-sm text-gray-600 mt-1">{initialData.description}</p>
            )}
          </div>

          <div>
            <label htmlFor="voidReason" className="block text-sm font-medium text-gray-700 mb-1">
              Reason for voiding *
            </label>
            <textarea
              id="voidReason"
              value={voidReason}
              onChange={(e) => {
                setVoidReason(e.target.value);
                if (voidError) setVoidError(null);
              }}
              placeholder="Explain why this transaction should be voided..."
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 ${
                voidError ? 'border-red-500' : 'border-gray-300'
              }`}
              rows={3}
            />
            {voidError && <p className="text-red-500 text-xs mt-1">{voidError}</p>}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="secondary" onClick={() => setIsVoidMode(false)}>
              Back
            </Button>
            <Button type="button" variant="danger" onClick={handleVoidSubmit}>
              Request Void
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
              Amount *
            </label>
            <NumericInput
              id="amount"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                if (errors.amount) setErrors({ ...errors, amount: undefined });
              }}
              placeholder="0.00"
              className={errors.amount ? 'border-red-500' : ''}
            />
            {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount}</p>}
          </div>

          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
              Category *
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                if (errors.category) setErrors({ ...errors, category: undefined });
              }}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.category ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Select a category...</option>
              {availableCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            {errors.category && <p className="text-red-500 text-xs mt-1">{errors.category}</p>}
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter transaction details..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>

          {mode === 'edit' && (
            <div>
              <label htmlFor="editReason" className="block text-sm font-medium text-gray-700 mb-1">
                Edit Reason (optional)
              </label>
              <textarea
                id="editReason"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Why are you editing this transaction?"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
              />
            </div>
          )}

          <div className="flex justify-between gap-2 pt-4">
            <div>
              {showVoidButton && (
                <Button type="button" variant="danger" onClick={() => setIsVoidMode(true)}>
                  Void Transaction
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                {mode === 'edit' ? 'Update Transaction' : 'Submit for Approval'}
              </Button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
}
