import React, { useState, useEffect } from 'react';
import { History, X } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatDateTimeEST } from '../lib/timezone';

interface EditHistoryEntry {
  id: string;
  edited_by_id: string;
  edited_at: string;
  old_amount: number;
  new_amount: number;
  old_description: string | null;
  new_description: string | null;
  old_category: string | null;
  new_category: string | null;
  edit_reason: string | null;
}

interface CashTransactionEditHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactionId: string;
}

export function CashTransactionEditHistoryModal({
  isOpen,
  onClose,
  transactionId,
}: CashTransactionEditHistoryModalProps) {
  const [history, setHistory] = useState<EditHistoryEntry[]>([]);
  const [employeeNames, setEmployeeNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const { selectedStoreId } = useAuth();

  useEffect(() => {
    if (isOpen && transactionId) {
      loadEditHistory();
    }
  }, [isOpen, transactionId]);

  async function loadEditHistory() {
    if (!selectedStoreId || !transactionId) return;

    try {
      setLoading(true);

      const { data: historyData, error: historyError } = await supabase
        .from('cash_transaction_edit_history')
        .select('*')
        .eq('transaction_id', transactionId)
        .order('edited_at', { ascending: false });

      if (historyError) throw historyError;

      setHistory(historyData || []);

      const employeeIds = [...new Set((historyData || []).map(h => h.edited_by_id))];

      if (employeeIds.length > 0) {
        const { data: employeeData, error: employeeError } = await supabase
          .from('employees')
          .select('id, name')
          .in('id', employeeIds);

        if (employeeError) throw employeeError;

        const nameMap: Record<string, string> = {};
        (employeeData || []).forEach(emp => {
          nameMap[emp.id] = emp.name;
        });
        setEmployeeNames(nameMap);
      }
    } catch (error) {
      console.error('Failed to load edit history:', error);
    } finally {
      setLoading(false);
    }
  }

  function renderChange(label: string, oldValue: any, newValue: any) {
    if (oldValue === newValue) return null;

    const formatValue = (val: any) => {
      if (val === null || val === undefined) return 'N/A';
      if (typeof val === 'number') return `$${val.toFixed(2)}`;
      return val;
    };

    return (
      <div className="mb-3">
        <p className="text-xs font-medium text-gray-600 mb-1">{label}:</p>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-900 bg-red-50 px-2 py-1 rounded border border-red-200">
            {formatValue(oldValue)}
          </span>
          <span className="text-gray-400">→</span>
          <span className="text-sm text-gray-900 bg-green-50 px-2 py-1 rounded border border-green-200">
            {formatValue(newValue)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Transaction Edit History" size="lg">
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading history...</div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <History className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-900 mb-1">No Edit History</p>
            <p className="text-xs text-gray-500">This transaction has not been edited yet.</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[500px] overflow-y-auto">
            {history.map((entry, index) => (
              <div
                key={entry.id}
                className="p-4 border border-gray-200 rounded-lg bg-gray-50"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      Edit #{history.length - index}
                    </p>
                    <p className="text-xs text-gray-600">
                      Edited by: <span className="font-medium">{employeeNames[entry.edited_by_id] || 'Unknown'}</span>
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDateTimeEST(entry.edited_at)} EST
                    </p>
                  </div>
                </div>

                {renderChange('Amount', entry.old_amount, entry.new_amount)}
                {renderChange('Description', entry.old_description, entry.new_description)}
                {renderChange('Category', entry.old_category, entry.new_category)}

                {entry.edit_reason && (
                  <div className="mt-3 pt-3 border-t border-gray-300">
                    <p className="text-xs font-medium text-gray-600 mb-1">Edit Reason:</p>
                    <p className="text-sm text-gray-900 italic">{entry.edit_reason}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-gray-200">
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
