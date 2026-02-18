import { useState, useEffect } from "react";
import { DollarSign } from "lucide-react";
import { Drawer } from "./ui/Drawer";
import { Button } from "./ui/Button";
import { NumericInput } from "./ui/NumericInput";

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

interface CashCountModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  initialDenominations: CashDenominations;
  onSubmit: (denominations: CashDenominations) => void | Promise<void>;
  colorScheme?: "green" | "blue";
}

export function CashCountModal({
  isOpen,
  onClose,
  title,
  initialDenominations,
  onSubmit,
  colorScheme = "green",
}: CashCountModalProps) {
  const [denominations, setDenominations] =
    useState<CashDenominations>(initialDenominations);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDenominations(initialDenominations);
    }
  }, [isOpen, initialDenominations]);

  function updateDenomination(key: keyof CashDenominations, value: string) {
    const numValue = parseInt(value) || 0;
    setDenominations((prev) => ({ ...prev, [key]: Math.max(0, numValue) }));
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
      denominations.coin_10 * 0.1 +
      denominations.coin_5 * 0.05
    );
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    try {
      await onSubmit(denominations);
      onClose();
    } catch (error) {
      console.error("Error submitting cash count:", error);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCancel() {
    setDenominations(initialDenominations);
    onClose();
  }

  const total = calculateTotal();
  const colorClasses =
    colorScheme === "green"
      ? "text-green-600 bg-green-50 border-green-200"
      : "text-blue-600 bg-blue-50 border-blue-200";

  const DenominationInput = ({
    label,
    value,
    onChange,
    denomination,
  }: {
    label: string;
    value: number;
    onChange: (value: string) => void;
    denomination: number;
  }) => {
    const itemTotal = value * denomination;
    return (
      <div className="flex items-center gap-1">
        <label className="text-sm font-medium text-gray-700 w-8 whitespace-nowrap flex-shrink-0">
          {label}
        </label>
        <NumericInput
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-16 text-center text-sm py-1 flex-shrink-0"
          min="0"
          step="1"
        />
        <span className="text-sm font-semibold text-gray-900 w-16 text-right whitespace-nowrap flex-shrink-0">
          ${itemTotal.toFixed(2)}
        </span>
      </div>
    );
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={handleCancel}
      title={title}
      size="lg"
      footer={
        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={handleCancel}
            className="px-8"
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            className="px-8"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving..." : "Submit"}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {/* Two-column layout: Bills on left, Coins on right */}
        <div className="grid grid-cols-2 gap-4">
          {/* Bills Column */}
          <div className="flex flex-col justify-between pr-4 border-r border-gray-300">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Bills
            </h4>
            <DenominationInput
              label="$100"
              value={denominations.bill_100}
              onChange={(v) => updateDenomination("bill_100", v)}
              denomination={100}
            />
            <DenominationInput
              label="$50"
              value={denominations.bill_50}
              onChange={(v) => updateDenomination("bill_50", v)}
              denomination={50}
            />
            <DenominationInput
              label="$20"
              value={denominations.bill_20}
              onChange={(v) => updateDenomination("bill_20", v)}
              denomination={20}
            />
            <DenominationInput
              label="$10"
              value={denominations.bill_10}
              onChange={(v) => updateDenomination("bill_10", v)}
              denomination={10}
            />
            <DenominationInput
              label="$5"
              value={denominations.bill_5}
              onChange={(v) => updateDenomination("bill_5", v)}
              denomination={5}
            />
          </div>

          {/* Coins Column */}
          <div className="flex flex-col justify-between">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Coins
            </h4>
            <DenominationInput
              label="$2"
              value={denominations.bill_2}
              onChange={(v) => updateDenomination("bill_2", v)}
              denomination={2}
            />
            <DenominationInput
              label="$1"
              value={denominations.bill_1}
              onChange={(v) => updateDenomination("bill_1", v)}
              denomination={1}
            />
            <DenominationInput
              label="25¢"
              value={denominations.coin_25}
              onChange={(v) => updateDenomination("coin_25", v)}
              denomination={0.25}
            />
            <DenominationInput
              label="10¢"
              value={denominations.coin_10}
              onChange={(v) => updateDenomination("coin_10", v)}
              denomination={0.1}
            />
            <DenominationInput
              label="5¢"
              value={denominations.coin_5}
              onChange={(v) => updateDenomination("coin_5", v)}
              denomination={0.05}
            />
          </div>
        </div>

        <div className={`${colorClasses} rounded-lg p-3`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign
                className={`w-5 h-5 ${colorScheme === "green" ? "text-green-600" : "text-blue-600"}`}
              />
              <span className="text-base font-bold text-gray-900">Total:</span>
            </div>
            <span
              className={`text-2xl font-bold ${colorScheme === "green" ? "text-green-600" : "text-blue-600"}`}
            >
              ${total.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
