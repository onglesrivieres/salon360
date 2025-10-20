import { useState, useEffect } from 'react';
import { Store as StoreIcon, Check, ClipboardCheck, UserCheck, FileText } from 'lucide-react';
import { supabase, Store } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import { CheckInOutModal } from '../components/CheckInOutModal';

interface StoreSwitcherPageProps {
  onStoreSelected: (action?: 'checkin' | 'ready' | 'report') => void;
}

export function StoreSwitcherPage({ onStoreSelected }: StoreSwitcherPageProps) {
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [employeePayType, setEmployeePayType] = useState<'hourly' | 'daily'>('hourly');
  const [showCheckInOutModal, setShowCheckInOutModal] = useState(false);
  const { session, selectStore, logout, t } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    fetchStores();
  }, []);

  async function fetchStores() {
    try {
      if (!session?.employee_id) {
        setLoading(false);
        return;
      }

      const { data: employee } = await supabase
        .from('employees')
        .select('pay_type')
        .eq('id', session.employee_id)
        .maybeSingle();

      if (employee?.pay_type) {
        setEmployeePayType(employee.pay_type as 'hourly' | 'daily');
      }

      const { data: employeeStores } = await supabase
        .from('employee_stores')
        .select('store_id')
        .eq('employee_id', session.employee_id);

      const employeeStoreIds = employeeStores?.map(es => es.store_id) || [];

      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .eq('active', true)
        .order('name');

      if (error) throw error;

      let availableStores = data || [];

      if (employeeStoreIds.length > 0) {
        availableStores = availableStores.filter(store =>
          employeeStoreIds.includes(store.id)
        );
      }

      setStores(availableStores);

      if (availableStores.length > 0) {
        setSelectedStore(availableStores[0].id);
      }
    } catch (error) {
      showToast(t('messages.failed'), 'error');
    } finally {
      setLoading(false);
    }
  }

  function handleContinue() {
    if (!selectedStore) {
      showToast(t('forms.selectOption'), 'error');
      return;
    }

    selectStore(selectedStore);
    onStoreSelected();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
        <div className="text-gray-500">{t('messages.loading')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <StoreIcon className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Salon360</h1>
          <p className="text-gray-600">{t('store.selectStore')}</p>
          {session?.display_name && (
            <p className="text-sm text-gray-500 mt-2">
              {t('auth.welcome')}, {session.display_name}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {stores.map((store) => (
            <button
              key={store.id}
              onClick={() => setSelectedStore(store.id)}
              className={`relative bg-white rounded-xl p-6 shadow-lg transition-all duration-200 hover:shadow-xl ${
                selectedStore === store.id
                  ? 'ring-4 ring-blue-500 transform scale-105'
                  : 'hover:scale-102'
              }`}
            >
              {selectedStore === store.id && (
                <div className="absolute top-3 right-3 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <Check className="w-5 h-5 text-white" />
                </div>
              )}

              <div className="flex flex-col items-center text-center">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                  selectedStore === store.id
                    ? 'bg-blue-100'
                    : 'bg-gray-100'
                }`}>
                  <StoreIcon className={`w-8 h-8 ${
                    selectedStore === store.id
                      ? 'text-blue-600'
                      : 'text-gray-600'
                  }`} />
                </div>

                <h3 className="text-xl font-bold text-gray-900 mb-1">
                  {store.name}
                </h3>

                <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                  selectedStore === store.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {store.code}
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className={`grid grid-cols-1 ${employeePayType === 'hourly' ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-6 mt-8`}>
          {employeePayType === 'hourly' && (
            <button
              onClick={() => {
                if (!selectedStore) {
                  showToast(t('forms.selectOption'), 'error');
                  return;
                }
                setShowCheckInOutModal(true);
              }}
              className="bg-white rounded-xl p-8 shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-105 transform"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-4">
                  <UserCheck className="w-10 h-10 text-green-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  {t('technician.checkInOut')}
                </h3>
                <p className="text-gray-600 text-sm">
                  {t('technician.checkInOutDesc')}
                </p>
              </div>
            </button>
          )}

          <button
            onClick={async () => {
              if (!selectedStore) {
                showToast(t('forms.selectOption'), 'error');
                return;
              }

              if (!session?.employee_id) {
                showToast('Employee ID not found', 'error');
                return;
              }

              try {
                const today = new Date().toISOString().split('T')[0];

                const { data: attendanceRecord } = await supabase
                  .from('attendance_records')
                  .select('*')
                  .eq('employee_id', session.employee_id)
                  .eq('store_id', selectedStore)
                  .eq('work_date', today)
                  .maybeSingle();

                const isFirstReadyOfDay = !attendanceRecord || attendanceRecord.status !== 'checked_in';

                if (isFirstReadyOfDay && employeePayType === 'daily') {
                  const { data: employee } = await supabase
                    .from('employees')
                    .select('display_name')
                    .eq('id', session.employee_id)
                    .maybeSingle();

                  const displayName = employee?.display_name || session.display_name || 'Employee';

                  await supabase.rpc('check_in_employee', {
                    p_employee_id: session.employee_id,
                    p_store_id: selectedStore,
                    p_pay_type: 'daily'
                  });

                  const checkInTime = new Date().toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  });

                  showToast(`Welcome to work, ${displayName}! Checked in at ${checkInTime}`, 'success');
                }

                if (attendanceRecord && attendanceRecord.status === 'checked_in') {
                  await supabase.rpc('update_last_activity', {
                    p_employee_id: session.employee_id,
                    p_store_id: selectedStore
                  });
                }

                const { data: existingQueue, error: checkError } = await supabase
                  .from('technician_ready_queue')
                  .select('*')
                  .eq('employee_id', session.employee_id)
                  .eq('store_id', selectedStore)
                  .maybeSingle();

                if (checkError) throw checkError;

                if (existingQueue) {
                  showToast(t('queue.alreadyInQueue'), 'info');
                  selectStore(selectedStore);
                  onStoreSelected('report');
                  return;
                }

                const { data: openTickets, error: openTicketsError } = await supabase
                  .from('ticket_items')
                  .select(`
                    sale_ticket_id,
                    sale_tickets!inner(id, closed_at, store_id)
                  `)
                  .eq('employee_id', session.employee_id)
                  .eq('sale_tickets.store_id', selectedStore)
                  .is('sale_tickets.closed_at', null);

                if (openTicketsError) throw openTicketsError;

                if (openTickets && openTickets.length > 0) {
                  const ticketIds = [...new Set(openTickets.map(item => item.sale_ticket_id))];

                  const { error: completeError } = await supabase
                    .from('sale_tickets')
                    .update({
                      completed_at: new Date().toISOString(),
                      completed_by: session.employee_id,
                    })
                    .in('id', ticketIds);

                  if (completeError) throw completeError;

                  const ticketWord = ticketIds.length > 1 ? t('tickets.title') : t('tickets.ticketNo').replace('#', '');
                  showToast(`Completed ${ticketIds.length} ${ticketWord}`, 'success');
                }

                const { error: insertError } = await supabase
                  .from('technician_ready_queue')
                  .insert([{
                    employee_id: session.employee_id,
                    store_id: selectedStore,
                    status: 'ready',
                    ready_at: new Date().toISOString(),
                  }]);

                if (insertError) throw insertError;

                const { data: positionData, error: positionError } = await supabase
                  .rpc('get_technician_queue_position', {
                    p_employee_id: session.employee_id,
                    p_store_id: selectedStore
                  });

                if (positionError) throw positionError;

                const position = positionData || 1;

                const positionText = position === 1 ? '1st' : position === 2 ? '2nd' : position === 3 ? '3rd' : `${position}th`;

                showToast(`${t('queue.youAre')} ${positionText} ${t('queue.inTheQueue')}`, 'success');

                selectStore(selectedStore);

                setTimeout(() => {
                  onStoreSelected('report');
                }, 2000);

              } catch (error: any) {
                console.error('Error adding to queue:', error);
                showToast(error.message || t('queue.joinFailed'), 'error');
              }
            }}
            className="bg-white rounded-xl p-8 shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-105 transform"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                <ClipboardCheck className="w-10 h-10 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                {t('technician.ready')}
              </h3>
              <p className="text-gray-600 text-sm">
                {t('technician.readyDesc')}
              </p>
            </div>
          </button>

          <button
            onClick={() => {
              if (!selectedStore) {
                showToast(t('forms.selectOption'), 'error');
                return;
              }
              selectStore(selectedStore);
              onStoreSelected('report');
            }}
            className="bg-white rounded-xl p-8 shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-105 transform"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center mb-4">
                <FileText className="w-10 h-10 text-orange-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                {t('technician.report')}
              </h3>
              <p className="text-gray-600 text-sm">
                {t('technician.reportDesc')}
              </p>
            </div>
          </button>
        </div>

        {stores.length === 0 && (
          <div className="text-center mt-8">
            <p className="text-gray-600">{t('store.noStores')}</p>
            <p className="text-sm text-gray-500 mt-2">
              {t('store.contactAdmin')}
            </p>
          </div>
        )}
      </div>

      {showCheckInOutModal && selectedStore && (
        <CheckInOutModal
          storeId={selectedStore}
          onClose={() => setShowCheckInOutModal(false)}
          onCheckInComplete={() => {
            selectStore(selectedStore);
            setShowCheckInOutModal(false);
            onStoreSelected();
          }}
          onCheckOutComplete={() => {
            setShowCheckInOutModal(false);
            logout();
          }}
        />
      )}
    </div>
  );
}
