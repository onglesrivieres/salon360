import { useState, useEffect } from 'react';
import { X, User, Loader2, AlertTriangle } from 'lucide-react';
import { ClientWithStats } from '../../lib/supabase';
import { useClientMutations } from '../../hooks/useClientMutations';
import { formatPhoneNumber, normalizePhoneNumber, isValidPhoneNumber } from '../../lib/phoneUtils';

interface ClientEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  storeId: string;
  client?: ClientWithStats | null;
  employeeId?: string;
  canBlacklist?: boolean;
  onDelete?: (client: ClientWithStats) => void;
  canDelete?: boolean;
}

export function ClientEditorModal({
  isOpen,
  onClose,
  onSuccess,
  storeId,
  client,
  employeeId,
  canBlacklist = false,
  onDelete,
  canDelete = false,
}: ClientEditorModalProps) {
  const isEditMode = !!client;

  const [formData, setFormData] = useState({
    name: '',
    phone_number: '',
    notes: '',
    is_blacklisted: false,
    blacklist_reason: '',
  });
  const [error, setError] = useState<string | null>(null);

  const { createClient, updateClient, blacklistClient, unblacklistClient, isLoading } = useClientMutations();

  // Reset form when modal opens or client changes
  useEffect(() => {
    if (isOpen) {
      if (client) {
        setFormData({
          name: client.name,
          phone_number: client.phone_number,
          notes: client.notes || '',
          is_blacklisted: client.is_blacklisted,
          blacklist_reason: client.blacklist_reason || '',
        });
      } else {
        setFormData({
          name: '',
          phone_number: '',
          notes: '',
          is_blacklisted: false,
          blacklist_reason: '',
        });
      }
      setError(null);
    }
  }, [isOpen, client]);

  if (!isOpen) return null;

  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      setError('Name is required');
      return false;
    }

    if (!formData.phone_number.trim()) {
      setError('Phone number is required');
      return false;
    }

    if (!isValidPhoneNumber(formData.phone_number)) {
      setError('Please enter a valid 10-digit phone number');
      return false;
    }

    if (formData.is_blacklisted && !formData.blacklist_reason.trim()) {
      setError('Blacklist reason is required');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setError(null);

    if (isEditMode && client) {
      // Update existing client
      const result = await updateClient(client.id, {
        name: formData.name.trim(),
        phone_number: formData.phone_number,
        notes: formData.notes.trim(),
      });

      if (!result.success) {
        setError(result.error || 'Failed to update client');
        return;
      }

      // Handle blacklist status change
      if (formData.is_blacklisted !== client.is_blacklisted) {
        if (formData.is_blacklisted && employeeId) {
          await blacklistClient(client.id, {
            reason: formData.blacklist_reason.trim(),
            blacklisted_by: employeeId,
          });
        } else {
          await unblacklistClient(client.id);
        }
      } else if (formData.is_blacklisted && formData.blacklist_reason !== client.blacklist_reason && employeeId) {
        // Update blacklist reason
        await blacklistClient(client.id, {
          reason: formData.blacklist_reason.trim(),
          blacklisted_by: employeeId,
        });
      }

      onSuccess();
    } else {
      // Create new client
      const result = await createClient({
        store_id: storeId,
        name: formData.name.trim(),
        phone_number: formData.phone_number,
        notes: formData.notes.trim(),
      });

      if (!result.success) {
        setError(result.error || 'Failed to create client');
        return;
      }

      // Blacklist if checked
      if (formData.is_blacklisted && result.data && employeeId) {
        await blacklistClient(result.data.id, {
          reason: formData.blacklist_reason.trim(),
          blacklisted_by: employeeId,
        });
      }

      onSuccess();
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">
                {isEditMode ? 'Edit Client' : 'Add New Client'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Name */}
            <div>
              <label htmlFor="client-name" className="block text-sm font-medium text-gray-700 mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                id="client-name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter client name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isLoading}
              />
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="client-phone" className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number <span className="text-red-500">*</span>
              </label>
              <input
                id="client-phone"
                type="tel"
                value={formatPhoneNumber(formData.phone_number)}
                onChange={(e) => setFormData({ ...formData, phone_number: normalizePhoneNumber(e.target.value) })}
                placeholder="(514) 123-4567"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isLoading}
              />
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="client-notes" className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                id="client-notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Optional notes about this client..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                disabled={isLoading}
              />
            </div>

            {/* Blacklist Section */}
            {canBlacklist && (
              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="checkbox"
                    id="blacklist-toggle"
                    checked={formData.is_blacklisted}
                    onChange={(e) => setFormData({ ...formData, is_blacklisted: e.target.checked })}
                    className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                    disabled={isLoading}
                  />
                  <label htmlFor="blacklist-toggle" className="text-sm font-medium text-gray-700 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    Blacklist this client
                  </label>
                </div>

                {formData.is_blacklisted && (
                  <div>
                    <label htmlFor="blacklist-reason" className="block text-sm font-medium text-gray-700 mb-1">
                      Blacklist Reason <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      id="blacklist-reason"
                      value={formData.blacklist_reason}
                      onChange={(e) => setFormData({ ...formData, blacklist_reason: e.target.value })}
                      placeholder="Enter reason for blacklisting..."
                      rows={2}
                      className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none bg-red-50"
                      disabled={isLoading}
                    />
                    {isEditMode && client?.is_blacklisted && client?.blacklisted_by_name && (
                      <p className="mt-1 text-xs text-red-600">
                        Blacklisted by {client.blacklisted_by_name} on{' '}
                        {client.blacklist_date
                          ? new Date(client.blacklist_date).toLocaleDateString()
                          : 'Unknown date'}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              {/* Delete button - only in edit mode */}
              {isEditMode && canDelete && onDelete && client && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Delete ${client.name}? This cannot be undone.`)) {
                      onDelete(client);
                    }
                  }}
                  disabled={isLoading}
                  className="px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-300 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  Delete
                </button>
              )}
              <div className="flex-1" />
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  isEditMode ? 'Save Changes' : 'Create Client'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
