import { useState, useEffect } from 'react';
import { Modal } from './ui/Modal';
import { supabase } from '../lib/supabase';
import { Store } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface QueueStoreSelectionModalProps {
  isOpen: boolean;
  storeIds: string[];
  employeeId: string;
  onSelect: (storeId: string, storeName: string) => void;
  onClose: () => void;
}

export function QueueStoreSelectionModal({
  isOpen,
  storeIds,
  employeeId,
  onSelect,
  onClose
}: QueueStoreSelectionModalProps) {
  const { t } = useAuth();
  const [stores, setStores] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
    } catch (error) {
      console.error('Error loading stores:', error);
    } finally {
      setIsLoading(false);
    }
  }

  function handleStoreSelect(storeId: string, storeName: string) {
    onSelect(storeId, storeName);
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('queue.selectStoreToJoin')}
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          {t('queue.selectStoreDesc')}
        </p>

        {isLoading ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : (
          <div className="space-y-2">
            {stores.map((store) => (
              <button
                key={store.id}
                onClick={() => handleStoreSelect(store.id, store.name)}
                className="w-full flex items-center p-4 border border-gray-300 rounded-lg cursor-pointer transition-colors hover:border-blue-400 hover:bg-blue-50"
              >
                <Store className="w-5 h-5 mr-3 text-gray-600" />
                <span className="font-medium">{store.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
