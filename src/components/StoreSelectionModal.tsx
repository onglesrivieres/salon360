import { useState, useEffect } from 'react';
import { Modal } from './ui/Modal';
import { supabase } from '../lib/supabase';
import { Store, Clock } from 'lucide-react';
import { formatTimeEST } from '../lib/timezone';

interface StoreInfo {
  id: string;
  name: string;
  check_in_time?: string;
}

interface StoreSelectionModalProps {
  isOpen: boolean;
  storeIds: string[];
  onSelect: (storeId: string) => void;
  context?: 'checkin' | 'checkout' | 'ready' | 'general';
  employeeId?: string;
}

export function StoreSelectionModal({
  isOpen,
  storeIds,
  onSelect,
  context = 'general',
  employeeId
}: StoreSelectionModalProps) {
  const [stores, setStores] = useState<StoreInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen && storeIds.length > 0) {
      loadStores();
    }
  }, [isOpen, storeIds, context, employeeId]);

  async function loadStores() {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('stores')
        .select('id, name')
        .in('id', storeIds)
        .eq('active', true)
        .order('name');

      if (error) throw error;

      let storeData = data || [];

      if (context === 'checkout' && employeeId) {
        const storesWithCheckInInfo: StoreInfo[] = await Promise.all(
          storeData.map(async (store) => {
            const { data: attendance } = await supabase
              .from('attendance_records')
              .select('check_in_time')
              .eq('employee_id', employeeId)
              .eq('store_id', store.id)
              .eq('status', 'checked_in')
              .is('check_out_time', null)
              .maybeSingle();

            return {
              ...store,
              check_in_time: attendance?.check_in_time
            };
          })
        );

        setStores(storesWithCheckInInfo.filter(s => s.check_in_time));
      } else {
        setStores(storeData);
      }
    } catch (error) {
      console.error('Error loading stores:', error);
    } finally {
      setIsLoading(false);
    }
  }

  function handleStoreSelect(storeId: string) {
    onSelect(storeId);
  }

  function getTitle() {
    switch (context) {
      case 'checkin':
        return 'Select Store to Clock In';
      case 'checkout':
        return 'Select Store to Clock Out';
      case 'ready':
        return 'Select Store for Ready Queue';
      default:
        return 'Select Store';
    }
  }

  function getDescription() {
    switch (context) {
      case 'checkin':
        return 'Choose which store location you want to clock in at.';
      case 'checkout':
        return 'Choose which store location you want to clock out from.';
      case 'ready':
        return 'Choose which store location you want to join the ready queue for.';
      default:
        return 'You have access to multiple stores. Please select which store you want to work with.';
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {}}
      title={getTitle()}
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          {getDescription()}
        </p>

        {isLoading ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : stores.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-gray-600">
              {context === 'checkout'
                ? 'You are not checked in at any store location.'
                : 'No stores available.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {stores.map((store) => (
              <button
                key={store.id}
                onClick={() => handleStoreSelect(store.id)}
                className="w-full flex items-center justify-between p-4 border border-gray-300 rounded-lg cursor-pointer transition-colors hover:border-blue-400 hover:bg-blue-50"
              >
                <div className="flex items-center">
                  <Store className="w-5 h-5 mr-3 text-gray-600" />
                  <span className="font-medium">{store.name}</span>
                </div>
                {store.check_in_time && (
                  <div className="flex items-center text-sm text-gray-500">
                    <Clock className="w-4 h-4 mr-1" />
                    <span>Checked in at {formatTimeEST(store.check_in_time)}</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
