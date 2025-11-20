import React, { useState, useEffect } from 'react';
import { DollarSign } from 'lucide-react';
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
  title: string;
  initialDenominations: CashDenominations;
  onSubmit: (denominations: CashDenominations) => void;
  colorScheme?: 'green' | 'blue';
}

export function CashCountModal({
  isOpen,
  onClose,
  title,
  initialDenominations,
  onSubmit,
  colorScheme = 'green',
}: CashCountModalProps) {
  const [denominations, setDenominations] = useState<CashDenominations>(initialDenominations);

  useEffect(() => {
    if (isOpen) {
      setDenominations(initialDenominations);
    }
  }, [isOpen, initialDenominations]);

  function updateDenomination(key: keyof CashDenominations, value: string) {
    const numValue = parseInt(value) || 0;
    setDenominations(prev => ({ ...prev, [key]: Math.max(0, numValue) }));
  }

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

  function handleSubmit() {
    onSubmit(denominations);
    onClose();
  }

  function handleCancel() {
    setDenominations(initialDenominations);
    onClose();
  }

  const total = calculateTotal();
  const colorClasses = colorScheme === 'green'
    ? 'text-green-600 bg-green-50 border-green-200'
    : 'text-blue-600 bg-blue-50 border-blue-200';

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
      <div className="flex items-center gap-1.5">
        <label className="text-xs text-gray-700 w-16">{label}</label>
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-14 text-center text-sm py-1"
          min="0"
        />
        <span className="text-xs text-gray-500">x ${denomination.toFixed(2)}</span>
        <span className="text-xs font-semibold text-gray-900 w-20 text-right">
          = ${itemTotal.toFixed(2)}
        </span>
      </div>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={handleCancel} title={title} size="md">
      <div className="space-y-3">
        <div className="space-y-1.5">
          <DenominationInput
            label="$20 Bills"
            value={denominations.bill_20}
            onChange={(v) => updateDenomination('bill_20', v)}
            denomination={20}
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

        <div className={`pt-4 border-t-2 border-gray-200 ${colorClasses} rounded-lg p-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className={`w-5 h-5 ${colorScheme === 'green' ? 'text-green-600' : 'text-blue-600'}`} />
              <span className="text-sm font-semibold text-gray-900">Total:</span>
            </div>
            <span className={`text-2xl font-bold ${colorScheme === 'green' ? 'text-green-600' : 'text-blue-600'}`}>
              ${total.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={handleCancel} className="flex-1">
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} className="flex-1">
            Submit
          </Button>
        </div>
      </div>
    </Modal>
  );
}
