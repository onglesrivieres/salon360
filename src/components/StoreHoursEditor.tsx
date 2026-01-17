import React, { useState, useEffect } from 'react';
import { Clock, Save, Loader2 } from 'lucide-react';
import { Button } from './ui/Button';
import { useToast } from './ui/Toast';
import { supabase } from '../lib/supabase';

interface StoreHoursEditorProps {
  storeId: string;
}

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
] as const;

type DayKey = typeof DAYS_OF_WEEK[number]['key'];

const DEFAULT_HOURS: Record<DayKey, string> = {
  monday: '09:00',
  tuesday: '09:00',
  wednesday: '09:00',
  thursday: '09:00',
  friday: '09:00',
  saturday: '09:00',
  sunday: '10:00',
};

const DEFAULT_CLOSING: Record<DayKey, string> = {
  monday: '17:00',
  tuesday: '17:00',
  wednesday: '17:00',
  thursday: '17:00',
  friday: '17:00',
  saturday: '17:00',
  sunday: '17:00',
};

export function StoreHoursEditor({ storeId }: StoreHoursEditorProps) {
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [openingHours, setOpeningHours] = useState<Record<DayKey, string>>(DEFAULT_HOURS);
  const [closingHours, setClosingHours] = useState<Record<DayKey, string>>(DEFAULT_CLOSING);
  const [originalOpening, setOriginalOpening] = useState<Record<DayKey, string>>(DEFAULT_HOURS);
  const [originalClosing, setOriginalClosing] = useState<Record<DayKey, string>>(DEFAULT_CLOSING);

  useEffect(() => {
    loadStoreHours();
  }, [storeId]);

  async function loadStoreHours() {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('stores')
        .select('opening_hours, closing_hours')
        .eq('id', storeId)
        .single();

      if (error) throw error;

      if (data) {
        const opening = data.opening_hours || {};
        const closing = data.closing_hours || {};

        // Convert from HH:MM:SS to HH:MM for input fields
        const convertedOpening: Record<DayKey, string> = { ...DEFAULT_HOURS };
        const convertedClosing: Record<DayKey, string> = { ...DEFAULT_CLOSING };

        DAYS_OF_WEEK.forEach(({ key }) => {
          if (opening[key]) {
            convertedOpening[key] = opening[key].substring(0, 5);
          }
          if (closing[key]) {
            convertedClosing[key] = closing[key].substring(0, 5);
          }
        });

        setOpeningHours(convertedOpening);
        setClosingHours(convertedClosing);
        setOriginalOpening(convertedOpening);
        setOriginalClosing(convertedClosing);
      }
    } catch (error) {
      console.error('Error loading store hours:', error);
      showToast('Failed to load store hours', 'error');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      // Convert from HH:MM to HH:MM:SS for database
      const dbOpening: Record<string, string> = {};
      const dbClosing: Record<string, string> = {};

      DAYS_OF_WEEK.forEach(({ key }) => {
        dbOpening[key] = openingHours[key] + ':00';
        dbClosing[key] = closingHours[key] + ':00';
      });

      const { data, error } = await supabase
        .from('stores')
        .update({
          opening_hours: dbOpening,
          closing_hours: dbClosing,
          updated_at: new Date().toISOString(),
        })
        .eq('id', storeId)
        .select();

      if (error) throw error;

      // Check for silent RLS failure (update returns 0 rows affected)
      if (!data || data.length === 0) {
        throw new Error('Update failed - you may not have permission to modify store settings');
      }

      setOriginalOpening({ ...openingHours });
      setOriginalClosing({ ...closingHours });
      showToast('Store operating hours updated successfully', 'success');
    } catch (error) {
      console.error('Error saving store hours:', error);
      showToast('Failed to save store hours', 'error');
    } finally {
      setIsSaving(false);
    }
  }

  function handleOpeningChange(day: DayKey, value: string) {
    setOpeningHours((prev) => ({ ...prev, [day]: value }));
  }

  function handleClosingChange(day: DayKey, value: string) {
    setClosingHours((prev) => ({ ...prev, [day]: value }));
  }

  const hasChanges =
    JSON.stringify(openingHours) !== JSON.stringify(originalOpening) ||
    JSON.stringify(closingHours) !== JSON.stringify(originalClosing);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-500" />
            <h3 className="font-semibold text-gray-900">Store Operating Hours</h3>
          </div>
        </div>
        <div className="px-6 py-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400 mx-auto" />
          <p className="text-sm text-gray-500 mt-2">Loading hours...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow mb-6">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-gray-500" />
          <h3 className="font-semibold text-gray-900">Store Operating Hours</h3>
        </div>
        <Button
          onClick={handleSave}
          disabled={isSaving || !hasChanges}
          size="sm"
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Day
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Opening
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Closing
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {DAYS_OF_WEEK.map(({ key, label }) => (
              <tr key={key} className="hover:bg-gray-50">
                <td className="px-6 py-3 text-sm font-medium text-gray-900">
                  {label}
                </td>
                <td className="px-6 py-3">
                  <input
                    type="time"
                    value={openingHours[key]}
                    onChange={(e) => handleOpeningChange(key, e.target.value)}
                    className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </td>
                <td className="px-6 py-3">
                  <input
                    type="time"
                    value={closingHours[key]}
                    onChange={(e) => handleClosingChange(key, e.target.value)}
                    className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasChanges && (
        <div className="px-6 py-3 bg-yellow-50 border-t border-yellow-100 text-sm text-yellow-700">
          You have unsaved changes
        </div>
      )}
    </div>
  );
}
