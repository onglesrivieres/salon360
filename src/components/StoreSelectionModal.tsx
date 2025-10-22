import { useState, useEffect } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { supabase } from '../lib/supabase';
import { Store } from 'lucide-react';

interface StoreSelectionModalProps {
  isOpen: boolean;
  storeIds: string[];
  onSelect: (storeId: string) => void;
}

export function StoreSelectionModal({ isOpen, storeIds, onSelect }: StoreSelectionModalProps) {
  const [stores, setStores] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');

  useEffect(() => {
    if (isOpen && storeIds.length > 0) {
      loadStores();
    }
  }, [isOpen, storeIds]);

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

      setStores(data || []);
      if (data && data.length > 0) {
        setSelectedStoreId(data[0].id);
      }
    } catch (error) {
      console.error('Error loading stores:', error);
    } finally {
      setIsLoading(false);
    }
  }

  function handleConfirm() {
    if (selectedStoreId) {
      onSelect(selectedStoreId);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {}}
      title="Select Store"
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          You have access to multiple stores. Please select which store you want to work with.
        </p>

        {isLoading ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : (
          <div className="space-y-2">
            {stores.map((store) => (
              <label
                key={store.id}
                className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${
                  selectedStoreId === store.id
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-300 hover:border-blue-400'
                }`}
              >
                <input
                  type="radio"
                  name="store"
                  value={store.id}
                  checked={selectedStoreId === store.id}
                  onChange={(e) => setSelectedStoreId(e.target.value)}
                  className="mr-3"
                />
                <Store className="w-5 h-5 mr-2 text-gray-600" />
                <span className="font-medium">{store.name}</span>
              </label>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <Button
            onClick={handleConfirm}
            disabled={!selectedStoreId || isLoading}
            className="px-6"
          >
            Continue
          </Button>
        </div>
      </div>
    </Modal>
  );
}
