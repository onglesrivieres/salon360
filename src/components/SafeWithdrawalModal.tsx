import { useState, useCallback } from "react";
import { AlertTriangle } from "lucide-react";
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
  const [amount, setAmount] = useState("");
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const newErrors: {
      amount?: string;
      description?: string;
      category?: string;
    } = {};

    const withdrawalAmount = parseFloat(amount);

    if (!amount || withdrawalAmount <= 0) {
      newErrors.amount = "Please enter a valid amount greater than 0";
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
    setAmount("");
    setDescription("");
    setCategory("");
    setErrors({});
    setPendingPhotos([]);
    onClose();
  }

  const withdrawalAmount = parseFloat(amount) || 0;
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

        <div>
          <label
            htmlFor="amount"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Withdrawal Amount *
          </label>
          <NumericInput
            id="amount"
            step="0.01"
            min="0.01"
            max={currentBalance}
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              if (errors.amount) setErrors({ ...errors, amount: undefined });
            }}
            placeholder="0.00"
            className={errors.amount ? "border-red-500" : ""}
          />
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
            placeholder="Enter purpose of withdrawal..."
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.description ? "border-red-500" : "border-gray-300"
            }`}
            rows={3}
          />
          {errors.description && (
            <p className="text-red-500 text-xs mt-1">{errors.description}</p>
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
