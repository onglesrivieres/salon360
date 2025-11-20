import React, { useState, useEffect } from 'react';
import { X, DollarSign } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

interface CashDenominations {
  bill_20: number;
  bill_10: number;
  bill_5: number;
  bill_2: number;
  bill_1: number;
  coin_25: number;
  coin_10: number;
  coin_5: number;
}

interface CashCountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (denominations: CashDenominations) => void;
  title: string;
  initialValues: CashDenominations;
  type: 'opening' | 'closing';
}

export function CashCountModal({
  isOpen,
  onClose,
  onSubmit,
  title,
  initialValues,
  type,
}: CashCountModalProps) {
  const [denominations, setDenominations] = useState<CashDenominations>(initialValues);

  useEffect(() => {
    setDenominations(initialValues);
  }, [initialValues, isOpen]);

  useEffect(() => {
    if (isOpen) {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  function calculateTotal(): number {
    return (
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

  function updateDenomination(key: keyof CashDenominations, value: string) {
    const numValue = parseInt(value) || 0;
    setDenominations(prev => ({ ...prev, [key]: Math.max(0, numValue) }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(denominations);
    onClose();
  }

  function handleCancel() {
    setDenominations(initialValues);
    onClose();
  }

  const total = calculateTotal();

  const DenominationInput = ({
    label,
    value,
    onChange,
    denomination,
    autoFocus = false,
  }: {
    label: string;
    value: number;
    onChange: (value: string) => void;
    denomination: number;
    autoFocus?: boolean;
  }) => {
    const lineTotal = value * denomination;
    return (
      <div className="flex items-center gap-3 py-2">
        <label className="text-sm font-medium text-gray-700 w-24">{label}</label>
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-24 text-center"
          min="0"
          autoFocus={autoFocus}
        />
        <span className="text-sm text-gray-500 w-20">× ${denomination.toFixed(2)}</span>
        <span className="text-sm font-semibold text-gray-900 w-28 text-right">
          = ${lineTotal.toFixed(2)}
        </span>
      </div>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={handleCancel}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              type === 'opening' ? 'bg-green-100' : 'bg-blue-100'
            }`}>
              <DollarSign className={`w-6 h-6 ${
                type === 'opening' ? 'text-green-600' : 'text-blue-600'
              }`} />
            </div>
            <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          </div>
          <button
            onClick={handleCancel}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-1">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Bills</h3>
              <div className="space-y-1">
                <DenominationInput
                  label="$20 Bills"
                  value={denominations.bill_20}
                  onChange={(v) => updateDenomination('bill_20', v)}
                  denomination={20}
                  autoFocus={true}
                />
                <DenominationInput
                  label="$10 Bills"
                  value={denominations.bill_10}
                  onChange={(v) => updateDenomination('bill_10', v)}
                  denomination={10}
                />
                <DenominationInput
                  label="$5 Bills"
                  value={denominations.bill_5}
                  onChange={(v) => updateDenomination('bill_5', v)}
                  denomination={5}
                />
                <DenominationInput
                  label="$2 Bills"
                  value={denominations.bill_2}
                  onChange={(v) => updateDenomination('bill_2', v)}
                  denomination={2}
                />
                <DenominationInput
                  label="$1 Bills"
                  value={denominations.bill_1}
                  onChange={(v) => updateDenomination('bill_1', v)}
                  denomination={1}
                />
              </div>
            </div>

            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Coins</h3>
              <div className="space-y-1">
                <DenominationInput
                  label="25¢ Coins"
                  value={denominations.coin_25}
                  onChange={(v) => updateDenomination('coin_25', v)}
                  denomination={0.25}
                />
                <DenominationInput
                  label="10¢ Coins"
                  value={denominations.coin_10}
                  onChange={(v) => updateDenomination('coin_10', v)}
                  denomination={0.10}
                />
                <DenominationInput
                  label="5¢ Coins"
                  value={denominations.coin_5}
                  onChange={(v) => updateDenomination('coin_5', v)}
                  denomination={0.05}
                />
              </div>
            </div>

            <div className={`mt-6 p-4 rounded-lg border-2 ${
              type === 'opening'
                ? 'bg-green-50 border-green-200'
                : 'bg-blue-50 border-blue-200'
            }`}>
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-gray-900">Total:</span>
                <span className={`text-3xl font-bold ${
                  type === 'opening' ? 'text-green-600' : 'text-blue-600'
                }`}>
                  ${total.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
            <Button
              type="button"
              variant="secondary"
              onClick={handleCancel}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
            >
              Submit
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
