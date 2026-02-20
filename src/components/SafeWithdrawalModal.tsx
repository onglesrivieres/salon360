import { useState, useCallback } from "react";
import { AlertTriangle, DollarSign } from "lucide-react";
import { Drawer } from "./ui/Drawer";
import { Button } from "./ui/Button";
import { NumericInput } from "./ui/NumericInput";
import { PhotoUpload } from "./photos/PhotoUpload";
import { PhotoThumbnail } from "./photos/PhotoThumbnail";
import { compressImage } from "../lib/image-utils";
import type { PendingPhoto } from "./photos/useTicketPhotos";

const MAX_PHOTOS = 3;

interface SafeWithdrawalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: WithdrawalData) => void;
  currentBalance: number;
}

export interface WithdrawalData {
  amount: number;
  description: string;
  category: string;
  pendingPhotos: PendingPhoto[];
}

const WITHDRAWAL_CATEGORIES = [
  "Payroll",
  "Tip Payout",
  "Headquarter Deposit",
  "Other",
];

export function SafeWithdrawalModal({
  isOpen,
  onClose,
  onSubmit,
  currentBalance,
}: SafeWithdrawalModalProps) {
  const [denominations, setDenominations] = useState({
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
  });
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [errors, setErrors] = useState<{
    amount?: string;
    description?: string;
    category?: string;
  }>({});
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);

  const handleFileSelect = useCallback(
    async (file: File) => {
      if (pendingPhotos.length >= MAX_PHOTOS) return;

      const validTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!validTypes.includes(file.type)) return;

      try {
        setIsProcessingPhoto(true);
        const compressedBlob = await compressImage(file);
        const previewUrl = URL.createObjectURL(compressedBlob);

        const pending: PendingPhoto = {
          id: crypto.randomUUID(),
          file,
          compressedBlob,
          previewUrl,
          filename: file.name,
        };

        setPendingPhotos((prev) => [...prev, pending]);
      } catch (err) {
        console.error("Failed to process photo:", err);
      } finally {
        setIsProcessingPhoto(false);
      }
    },
    [pendingPhotos.length],
  );

  const handleRemovePhoto = useCallback((id: string) => {
    setPendingPhotos((prev) => {
      const photo = prev.find((p) => p.id === id);
      if (photo) {
        URL.revokeObjectURL(photo.previewUrl);
      }
      return prev.filter((p) => p.id !== id);
    });
  }, []);

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

  function updateDenomination(key: string, value: string) {
    const numValue = parseInt(value) || 0;
    setDenominations((prev) => ({ ...prev, [key]: Math.max(0, numValue) }));
  }

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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const newErrors: {
      amount?: string;
      description?: string;
      category?: string;
    } = {};

    const withdrawalAmount = calculateTotal();

    if (withdrawalAmount <= 0) {
      newErrors.amount = "Please enter bill or coin counts";
    } else if (withdrawalAmount > currentBalance) {
      newErrors.amount = `Amount cannot exceed available safe balance ($${currentBalance.toFixed(2)})`;
    }

    if (!description.trim()) {
      newErrors.description = "Please enter a description";
    }

    if (!category) {
      newErrors.category = "Please select a category";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Capture photos reference before clearing state
    const photosToSubmit = [...pendingPhotos];

    onSubmit({
      amount: withdrawalAmount,
      description: description.trim(),
      category,
      pendingPhotos: photosToSubmit,
    });

    handleClose();
  }

  function handleClose() {
    // Revoke all blob URLs to prevent memory leaks
    for (const photo of pendingPhotos) {
      URL.revokeObjectURL(photo.previewUrl);
    }
    setDenominations({
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
    });
    setDescription("");
    setCategory("");
    setErrors({});
    setPendingPhotos([]);
    onClose();
  }

  const withdrawalAmount = calculateTotal();
  const newBalance = currentBalance - withdrawalAmount;
  const showLowBalanceWarning = newBalance < 500 && withdrawalAmount > 0;

  const footerContent = (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="secondary" onClick={handleClose}>
        Cancel
      </Button>
      <Button type="submit" form="withdrawal-form" variant="primary">
        Submit for Approval
      </Button>
    </div>
  );

  return (
    <Drawer
      isOpen={isOpen}
      onClose={handleClose}
      title="Safe Withdrawal"
      size="lg"
      footer={footerContent}
    >
      <form onSubmit={handleSubmit} id="withdrawal-form" className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-blue-900 font-medium">
              Current Safe Balance:
            </span>
            <span className="text-blue-900 font-bold text-lg">
              ${currentBalance.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Cash Count Denomination Grid */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Cash Count *
          </label>
          <div className="bg-gray-50 rounded-lg p-3">
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
          </div>

          {/* Total Bar */}
          <div className="text-blue-600 bg-blue-50 border-blue-200 border rounded-lg p-3 mt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-blue-600" />
                <span className="text-base font-bold text-gray-900">
                  Withdrawal Total:
                </span>
              </div>
              <span className="text-2xl font-bold text-blue-600">
                ${withdrawalAmount.toFixed(2)}
              </span>
            </div>
          </div>

          {errors.amount && (
            <p className="text-red-500 text-xs mt-1">{errors.amount}</p>
          )}
        </div>

        {showLowBalanceWarning && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900">
              <p className="font-medium mb-1">Low Balance Warning</p>
              <p>
                Withdrawal will reduce safe balance to ${newBalance.toFixed(2)}
              </p>
            </div>
          </div>
        )}

        <div>
          <label
            htmlFor="category"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Category *
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              if (errors.category)
                setErrors({ ...errors, category: undefined });
            }}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.category ? "border-red-500" : "border-gray-300"
            }`}
          >
            <option value="">Select a category...</option>
            {WITHDRAWAL_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          {errors.category && (
            <p className="text-red-500 text-xs mt-1">{errors.category}</p>
          )}
        </div>

        {/* Photo Upload Section */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Photos (optional)
            {pendingPhotos.length > 0 && (
              <span className="text-xs text-gray-500 ml-1">
                {pendingPhotos.length}/{MAX_PHOTOS}
              </span>
            )}
          </label>
          <div className="flex flex-wrap items-start gap-2">
            {pendingPhotos.map((photo) => (
              <PhotoThumbnail
                key={photo.id}
                photo={photo}
                isPending
                canDelete
                onDelete={() => handleRemovePhoto(photo.id)}
                size="sm"
              />
            ))}
            {pendingPhotos.length < MAX_PHOTOS && (
              <PhotoUpload
                onFileSelect={handleFileSelect}
                isUploading={isProcessingPhoto}
                remainingSlots={MAX_PHOTOS - pendingPhotos.length}
              />
            )}
          </div>
        </div>

        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Description *
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              if (errors.description)
                setErrors({ ...errors, description: undefined });
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = `${target.scrollHeight}px`;
            }}
            placeholder="Enter purpose of withdrawal..."
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${
              errors.description ? "border-red-500" : "border-gray-300"
            }`}
            rows={1}
          />
          {errors.description && (
            <p className="text-red-500 text-xs mt-1">{errors.description}</p>
          )}
        </div>

        {withdrawalAmount > 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-700 font-medium">
                New Safe Balance:
              </span>
              <span
                className={`font-bold text-lg ${newBalance < 0 ? "text-red-600" : "text-green-600"}`}
              >
                ${newBalance.toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </form>
    </Drawer>
  );
}
