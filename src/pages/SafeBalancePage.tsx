import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, Vault, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase, SafeBalanceSummary, CashTransactionWithDetails } from '../lib/supabase';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { getCurrentDateEST } from '../lib/timezone';

interface SafeBalancePageProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
}

export function SafeBalancePage({ selectedDate, onDateChange }: SafeBalancePageProps) {
  const { showToast } = useToast();
  const { session, selectedStoreId } = useAuth();

  const [safeBalance, setSafeBalance] = useState<SafeBalanceSummary | null>(null);
  const [safeDeposits, setSafeDeposits] = useState<CashTransactionWithDetails[]>([]);
  const [loadingSafeBalance, setLoadingSafeBalance] = useState(false);

  useEffect(() => {
    loadSafeBalanceData();
  }, [selectedDate, selectedStoreId]);

  async function loadSafeBalanceData() {
    if (!selectedStoreId) return;

    try {
      setLoadingSafeBalance(true);

      const { data: balanceData, error: balanceError } = await supabase
        .rpc('get_safe_balance_for_date', {
          p_store_id: selectedStoreId,
          p_date: selectedDate,
        })
        .maybeSingle();

      if (balanceError) throw balanceError;

      setSafeBalance(balanceData || {
        opening_balance: 0,
        total_deposits: 0,
        total_withdrawals: 0,
        closing_balance: 0,
      });

      const { data: transactions, error: transactionsError } = await supabase
        .from('cash_transactions')
        .select(`
          *,
          created_by:employees!cash_transactions_created_by_id_fkey (
            id,
            name:legal_name
          ),
          approved_by:employees!cash_transactions_manager_approved_by_id_fkey (
            id,
            name:legal_name
          )
        `)
        .eq('store_id', selectedStoreId)
        .eq('date', selectedDate)
        .eq('transaction_type', 'cash_out')
        .eq('category', 'Safe Deposit')
        .order('created_at', { ascending: false });

      if (transactionsError) throw transactionsError;

      const deposits = (transactions || []).map(t => ({
        ...t,
        created_by_name: t.created_by?.name,
        manager_approved_by_name: t.approved_by?.name,
      }));

      setSafeDeposits(deposits);
    } catch (error) {
      console.error('Failed to load safe balance data:', error);
      showToast('Failed to load safe balance data', 'error');
    } finally {
      setLoadingSafeBalance(false);
    }
  }

  function goToPreviousDay() {
    const date = new Date(selectedDate + 'T12:00:00');
    date.setDate(date.getDate() - 1);
    onDateChange(date.toISOString().split('T')[0]);
  }

  function goToNextDay() {
    const date = new Date(selectedDate + 'T12:00:00');
    date.setDate(date.getDate() + 1);
    onDateChange(date.toISOString().split('T')[0]);
  }

  function goToToday() {
    onDateChange(getCurrentDateEST());
  }

  const todayEST = getCurrentDateEST();
  const isToday = selectedDate === todayEST;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base md:text-lg font-bold text-gray-900">Safe Balance</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={goToPreviousDay}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Previous day"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="flex flex-col items-center min-w-[140px]">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => onDateChange(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {!isToday && (
                <button
                  onClick={goToToday}
                  className="text-xs text-blue-600 hover:text-blue-700 mt-1 font-medium"
                >
                  Go to Today
                </button>
              )}
            </div>
            <button
              onClick={goToNextDay}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Next day"
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {loadingSafeBalance ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-sm text-gray-500">Loading safe balance...</div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-gray-900">Opening Balance</h3>
              </div>
              <p className="text-2xl font-bold text-blue-600">
                ${(safeBalance?.opening_balance || 0).toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 mt-1">From previous day</p>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <h3 className="text-sm font-semibold text-gray-900">Total Deposits</h3>
              </div>
              <p className="text-2xl font-bold text-green-600">
                ${(safeBalance?.total_deposits || 0).toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {safeDeposits.filter(d => d.status === 'approved').length} approved
              </p>
            </div>

            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg shadow p-4 text-white">
              <div className="flex items-center gap-2 mb-2">
                <Vault className="w-4 h-4" />
                <h3 className="text-sm font-semibold">Current Balance</h3>
              </div>
              <p className="text-2xl font-bold">
                ${(safeBalance?.closing_balance || 0).toFixed(2)}
              </p>
              <p className="text-xs opacity-90 mt-1">Safe total</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow">
            <div className="border-b border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Safe Deposits</h3>
                </div>
                <span className="text-sm text-gray-500">
                  {safeDeposits.length} {safeDeposits.length === 1 ? 'transaction' : 'transactions'}
                </span>
              </div>
            </div>
            <div className="p-4">
              {safeDeposits.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <TrendingUp className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm">No deposits recorded for this date</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {safeDeposits.map((deposit) => (
                    <div
                      key={deposit.id}
                      className="p-3 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-green-600">
                            +${parseFloat(deposit.amount.toString()).toFixed(2)}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              deposit.status === 'approved'
                                ? 'bg-green-100 text-green-700'
                                : deposit.status === 'rejected'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {deposit.status === 'approved'
                              ? 'Approved'
                              : deposit.status === 'rejected'
                              ? 'Rejected'
                              : 'Pending'}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-900 font-medium">{deposit.description}</p>
                      <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                        <span>By: {deposit.created_by_name}</span>
                        <span>{new Date(deposit.created_at).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
