import React, { useState } from 'react';
import { AlertTriangle, DollarSign } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { NumericInput } from './ui/NumericInput';
import { CashTransactionType } from '../lib/supabase';

interface CashDenominations {
  bill_100: number;
  bill_50: number;
  bill_20: number;
  bill_10: number;
  bill_5: number;
  bill_2: number;
  bill_1: number;
  coin_25: number;
  coin_10: number;
  coin_5: number;
}

const DEFAULT_DENOMINATIONS: CashDenominations = {
  bill_100: 0,
  bill_50: 0,
  bill_20: 0,
  bill_10: 0,
  bill_5: 0,
  bill_2: 0,
  bill_1: 0,
  coin_25: 0,
  coin_10: 0,
  coin_5: 0,
};

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
    denominations?: CashDenominations;
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
  denominations: CashDenominations;
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
  const [denominations, setDenominations] = useState<CashDenominations>(DEFAULT_DENOMINATIONS);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [editReason, setEditReason] = useState('');
  const [errors, setErrors] = useState<{ amount?: string; category?: string }>({});
  const [isVoidMode, setIsVoidMode] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [voidError, setVoidError] = useState<string | null>(null);

  const showVoidButton = mode === 'edit' && canVoid && transactionStatus === 'approved' && onVoid;

  function updateDenomination(key: keyof CashDenominations, value: string) {
    const numValue = parseInt(value) || 0;
    setDenominations(prev => ({ ...prev, [key]: Math.max(0, numValue) }));
    if (errors.amount) setErrors({ ...errors, amount: undefined });
  }

  function calculateTotal(): number {
    return (
      denominations.bill_100 * 100 +
      denominations.bill_50 * 50 +
      denominations.bill_20 * 20 +
      denominations.bill_10 * 10 +
      denominations.bill_5 * 5 +
      denominations.bill_2 * 2 +
      denominations.bill_1 * 1 +
      denominations.coin_25 * 0.25 +
      denominations.coin_10 * 0.10 +
      denominations.coin_5 * 0.05
    );
  }

  React.useEffect(() => {
    if (isOpen) {
      setIsVoidMode(false);
      setVoidReason('');
      setVoidError(null);
      if (mode === 'edit' && initialData) {
        setDenominations(initialData.denominations || DEFAULT_DENOMINATIONS);
        setDescription(initialData.description || '');
        setCategory(initialData.category);
        setEditReason('');
      } else {
        setDenominations(DEFAULT_DENOMINATIONS);
        setDescription(defaultDescription || '');
        setCategory(defaultCategory || '');
      }
    }
  }, [isOpen, mode, initialData, defaultCategory, defaultDescription]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const newErrors: { amount?: string; category?: string } = {};
    const total = calculateTotal();

    if (total <= 0) {
      newErrors.amount = 'Please count at least some cash (total must be greater than 0)';
    }

    if (!category) {
      newErrors.category = 'Please select a category';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit({
      amount: total,
      description: description.trim() || undefined,
      category: category,
      editReason: mode === 'edit' ? editReason.trim() || undefined : undefined,
      transactionId: mode === 'edit' ? transactionId : undefined,
      denominations: denominations,
    });

    handleClose();
  }

  function handleClose() {
    setDenominations(DEFAULT_DENOMINATIONS);
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

  const DenominationInput = ({
    label,
    value,
    onChange,
    denomination
  }: {
    label: string;
    value: number;
    onChange: (value: string) => void;
    denomination: number;
  }) => {
    const itemTotal = value * denomination;
    return (
      <div className="flex items-center">
        <label className="text-sm font-medium text-gray-700 w-8 whitespace-nowrap flex-shrink-0">{label}</label>
        <NumericInput
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-16 text-center text-sm py-1 flex-shrink-0"
          min="0"
          step="1"
        />
        <span className="text-sm font-semibold text-gray-900 ml-1 whitespace-nowrap">
          ${itemTotal.toFixed(2)}
        </span>
      </div>
    );
  };

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
          {/* Cash Count Section - Two Column Layout */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cash Count *
            </label>
            <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-lg p-3">
              {/* Bills Column */}
              <div className="space-y-1.5 pr-4 border-r border-gray-300">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Bills</h4>
                <DenominationInput
                  label="$100"
                  value={denominations.bill_100}
                  onChange={(v) => updateDenomination('bill_100', v)}
                  denomination={100}
                />
                <DenominationInput
                  label="$50"
                  value={denominations.bill_50}
                  onChange={(v) => updateDenomination('bill_50', v)}
                  denomination={50}
                />
                <DenominationInput
                  label="$20"
                  value={denominations.bill_20}
                  onChange={(v) => updateDenomination('bill_20', v)}
                  denomination={20}
                />
                <DenominationInput
                  label="$10"
                  value={denominations.bill_10}
                  onChange={(v) => updateDenomination('bill_10', v)}
                  denomination={10}
                />
                <DenominationInput
                  label="$5"
                  value={denominations.bill_5}
                  onChange={(v) => updateDenomination('bill_5', v)}
                  denomination={5}
                />
              </div>

              {/* Coins Column */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Coins</h4>
                <DenominationInput
                  label="$2"
                  value={denominations.bill_2}
                  onChange={(v) => updateDenomination('bill_2', v)}
                  denomination={2}
                />
                <DenominationInput
                  label="$1"
                  value={denominations.bill_1}
                  onChange={(v) => updateDenomination('bill_1', v)}
                  denomination={1}
                />
                <DenominationInput
                  label="25¢"
                  value={denominations.coin_25}
                  onChange={(v) => updateDenomination('coin_25', v)}
                  denomination={0.25}
                />
                <DenominationInput
                  label="10¢"
                  value={denominations.coin_10}
                  onChange={(v) => updateDenomination('coin_10', v)}
                  denomination={0.10}
                />
                <DenominationInput
                  label="5¢"
                  value={denominations.coin_5}
                  onChange={(v) => updateDenomination('coin_5', v)}
                  denomination={0.05}
                />
              </div>
            </div>

            {/* Total Display */}
            <div className={`mt-3 rounded-lg p-3 ${transactionType === 'cash_in' ? 'bg-green-50 border border-green-200' : 'bg-blue-50 border border-blue-200'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className={`w-5 h-5 ${transactionType === 'cash_in' ? 'text-green-600' : 'text-blue-600'}`} />
                  <span className="text-base font-bold text-gray-900">Total:</span>
                </div>
                <span className={`text-2xl font-bold ${transactionType === 'cash_in' ? 'text-green-600' : 'text-blue-600'}`}>
                  ${calculateTotal().toFixed(2)}
                </span>
              </div>
            </div>
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
            <input
              type="text"
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter transaction details..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
