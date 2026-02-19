import { useState, useEffect } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { DateRange } from "../../lib/timeFilters";
import { getCurrentDateEST } from "../../lib/timezone";

interface CustomDateRangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (dateRange: DateRange) => void;
  initialDateRange?: DateRange;
}

export function CustomDateRangeModal({
  isOpen,
  onClose,
  onApply,
  initialDateRange,
}: CustomDateRangeModalProps) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      if (initialDateRange) {
        setStartDate(initialDateRange.startDate);
        setEndDate(initialDateRange.endDate);
      } else {
        const today = new Date();
        const formatted = today.toISOString().split("T")[0];
        setStartDate(formatted);
        setEndDate(formatted);
      }
      setError("");
    }
  }, [isOpen, initialDateRange]);

  const handleApply = () => {
    if (!startDate || !endDate) {
      setError("Please select both start and end dates");
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      setError("End date must be after start date");
      return;
    }

    onApply({ startDate, endDate });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Custom Date Range">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Start Date
          </label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setError("");
            }}
            max={getCurrentDateEST()}
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            End Date
          </label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setError("");
            }}
            max={getCurrentDateEST()}
            className="w-full"
          />
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleApply}>Apply</Button>
        </div>
      </div>
    </Modal>
  );
}
