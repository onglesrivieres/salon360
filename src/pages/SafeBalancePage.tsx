import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, Vault, ChevronLeft, ChevronRight, TrendingDown, AlertTriangle, History, ChevronDown, ChevronUp, Edit3, Clock } from 'lucide-react';
import { supabase, SafeBalanceSummary, CashTransactionWithDetails } from '../lib/supabase';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { getCurrentDateEST } from '../lib/timezone';
import { SafeWithdrawalModal, WithdrawalData } from '../components/SafeWithdrawalModal';
import { CashTransactionChangeRequestModal, ChangeRequestData } from '../components/CashTransactionChangeRequestModal';
import { Button } from '../components/ui/Button';
import { Permissions } from '../lib/permissions';

interface SafeBalancePageProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
}

export function SafeBalancePage({ selectedDate, onDateChange }: SafeBalancePageProps) {
  const { showToast } = useToast();
  const { session, selectedStoreId, effectiveRole } = useAuth();

  const [safeBalance, setSafeBalance] = useState<SafeBalanceSummary | null>(null);
  const [safeDeposits, setSafeDeposits] = useState<CashTransactionWithDetails[]>([]);
  const [safeWithdrawals, setSafeWithdrawals] = useState<CashTransactionWithDetails[]>([]);
  const [loadingSafeBalance, setLoadingSafeBalance] = useState(false);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [balanceWarning, setBalanceWarning] = useState<string | null>(null);
  const [balanceHistory, setBalanceHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showChangeRequestModal, setShowChangeRequestModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<CashTransactionWithDetails | null>(null);
  const [pendingProposals, setPendingProposals] = useState<Set<string>>(new Set());

  const canCreateChangeProposal = effectiveRole ? Permissions.cashTransactions.canCreateChangeProposal(effectiveRole) : false;

  useEffect(() => {
    loadSafeBalanceData();
  }, [selectedDate, selectedStoreId]);

  async function loadSafeBalanceData() {
    if (!selectedStoreId || !session?.employee_id) return;

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

      const { data: withdrawalTransactions, error: withdrawalsError } = await supabase
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
        .eq('transaction_type', 'cash_payout')
        .in('category', ['Payroll', 'Tip Payout'])
        .order('created_at', { ascending: false });

      if (withdrawalsError) throw withdrawalsError;

      const withdrawals = (withdrawalTransactions || []).map(t => ({
        ...t,
        created_by_name: t.created_by?.name,
        manager_approved_by_name: t.approved_by?.name,
      }));

      setSafeWithdrawals(withdrawals);

      // Load pending change proposals for this store
      const allTransactionIds = [
        ...deposits.map(d => d.id),
        ...withdrawals.map(w => w.id),
      ];

      if (allTransactionIds.length > 0) {
        const { data: proposals } = await supabase
          .from('cash_transaction_change_proposals')
          .select('cash_transaction_id')
          .in('cash_transaction_id', allTransactionIds)
          .eq('status', 'pending');

        const pendingIds = new Set((proposals || []).map(p => p.cash_transaction_id));
        setPendingProposals(pendingIds);
      } else {
        setPendingProposals(new Set());
      }

      await supabase.rpc('save_safe_balance_snapshot', {
        p_store_id: selectedStoreId,
        p_date: selectedDate,
        p_employee_id: session.employee_id,
      });

      const previousDate = new Date(selectedDate + 'T12:00:00');
      previousDate.setDate(previousDate.getDate() - 1);
      const prevDateStr = previousDate.toISOString().split('T')[0];

      const { data: prevSnapshot } = await supabase
        .from('safe_balance_history')
        .select('closing_balance, date')
        .eq('store_id', selectedStoreId)
        .eq('date', prevDateStr)
        .maybeSingle();

      if (balanceData && prevSnapshot) {
        const expectedOpening = parseFloat(prevSnapshot.closing_balance.toString());
        const actualOpening = parseFloat(balanceData.opening_balance.toString());
        const difference = Math.abs(expectedOpening - actualOpening);

        if (difference > 0.01) {
          setBalanceWarning(
            `Opening balance ($${actualOpening.toFixed(2)}) does not match previous day's closing balance ($${expectedOpening.toFixed(2)}). Difference: $${difference.toFixed(2)}`
          );
        } else {
          setBalanceWarning(null);
        }
      } else {
        setBalanceWarning(null);
      }
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

  async function loadBalanceHistory() {
    if (!selectedStoreId) return;

    try {
      setLoadingHistory(true);

      const { data, error } = await supabase
        .rpc('get_safe_balance_history', {
          p_store_id: selectedStoreId,
          p_start_date: null,
          p_end_date: null,
          p_limit: 14,
        });

      if (error) throw error;

      setBalanceHistory(data || []);
    } catch (error) {
      console.error('Failed to load balance history:', error);
      showToast('Failed to load balance history', 'error');
    } finally {
      setLoadingHistory(false);
    }
  }

  function toggleHistory() {
    if (!showHistory && balanceHistory.length === 0) {
      loadBalanceHistory();
    }
    setShowHistory(!showHistory);
  }

  async function handleWithdrawalSubmit(data: WithdrawalData) {
    if (!session?.employee_id || !selectedStoreId) {
      showToast('You must be logged in to record a withdrawal', 'error');
      return;
    }

    try {
      const { data: result, error } = await supabase
        .rpc('create_cash_transaction_with_validation', {
          p_store_id: selectedStoreId,
          p_date: selectedDate,
          p_transaction_type: 'cash_payout',
          p_amount: data.amount,
          p_description: data.description,
          p_category: data.category,
          p_created_by_id: session.employee_id,
        });

      if (error) throw error;

      if (result && !result.success) {
        showToast(result.error || 'Failed to submit withdrawal', 'error');
        return;
      }

      showToast('Withdrawal submitted for approval', 'success');
      setShowWithdrawalModal(false);
      loadSafeBalanceData();
    } catch (error) {
      console.error('Failed to submit withdrawal:', error);
      showToast('Failed to submit withdrawal', 'error');
    }
  }

  async function handleChangeRequestSubmit(data: ChangeRequestData) {
    if (!session?.employee_id || !selectedTransaction) {
      showToast('Unable to submit change request', 'error');
      return;
    }

    const { data: result, error } = await supabase.rpc('create_cash_transaction_change_proposal', {
      p_cash_transaction_id: selectedTransaction.id,
      p_proposed_amount: data.proposed_amount,
      p_proposed_category: data.proposed_category,
      p_proposed_description: data.proposed_description,
      p_proposed_date: data.proposed_date,
      p_is_deletion_request: data.is_deletion_request,
      p_reason_comment: data.reason_comment,
      p_created_by_employee_id: session.employee_id,
    });

    if (error) {
      console.error('Failed to submit change request:', error);
      showToast('Failed to submit change request', 'error');
      throw error;
    }

    if (result && !result.success) {
      showToast(result.error || 'Failed to submit change request', 'error');
      throw new Error(result.error);
    }

    showToast('Change request submitted for approval', 'success');
    setShowChangeRequestModal(false);
    setSelectedTransaction(null);
    loadSafeBalanceData();
  }

  function openChangeRequestModal(transaction: CashTransactionWithDetails) {
    setSelectedTransaction(transaction);
    setShowChangeRequestModal(true);
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

      {balanceWarning && (
        <div className="mb-6 bg-amber-50 border border-amber-300 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-amber-900 mb-1">Balance Mismatch Warning</h3>
              <p className="text-sm text-amber-800">{balanceWarning}</p>
              <p className="text-xs text-amber-700 mt-2">
                This may indicate missing transactions or data inconsistency. Please review the previous day's closing balance.
              </p>
            </div>
          </div>
        </div>
      )}

      {loadingSafeBalance ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-sm text-gray-500">Loading safe balance...</div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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

            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-4 h-4 text-red-600" />
                <h3 className="text-sm font-semibold text-gray-900">Total Withdrawals</h3>
              </div>
              <p className="text-2xl font-bold text-red-600">
                ${(safeBalance?.total_withdrawals || 0).toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {safeWithdrawals.filter(w => w.status === 'approved').length} approved
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

          <div className="bg-white rounded-lg shadow mb-6">
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
                      {/* Request Change button - only for Managers, approved transactions, and no pending proposal */}
                      {canCreateChangeProposal && deposit.status === 'approved' && (
                        <div className="mt-2 pt-2 border-t border-gray-100">
                          {pendingProposals.has(deposit.id) ? (
                            <span className="flex items-center gap-1 text-xs text-amber-600">
                              <Clock className="w-3 h-3" />
                              Change pending
                            </span>
                          ) : (
                            <button
                              onClick={() => openChangeRequestModal(deposit)}
                              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                            >
                              <Edit3 className="w-3 h-3" />
                              Request Change
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow">
            <div className="border-b border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-red-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Safe Withdrawals</h3>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">
                    {safeWithdrawals.length} {safeWithdrawals.length === 1 ? 'transaction' : 'transactions'}
                  </span>
                  <Button
                    variant="primary"
                    onClick={() => setShowWithdrawalModal(true)}
                  >
                    <TrendingDown className="w-4 h-4 mr-2" />
                    Withdraw Cash
                  </Button>
                </div>
              </div>
            </div>
            <div className="p-4">
              {safeWithdrawals.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <TrendingDown className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm">No withdrawals recorded for this date</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {safeWithdrawals.map((withdrawal) => (
                    <div
                      key={withdrawal.id}
                      className="p-3 border border-red-200 rounded-lg hover:border-red-300 transition-colors bg-red-50"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-red-600">
                            -${parseFloat(withdrawal.amount.toString()).toFixed(2)}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              withdrawal.status === 'approved'
                                ? 'bg-green-100 text-green-700'
                                : withdrawal.status === 'rejected'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {withdrawal.status === 'approved'
                              ? 'Approved'
                              : withdrawal.status === 'rejected'
                              ? 'Rejected'
                              : 'Pending'}
                          </span>
                        </div>
                      </div>
                      <div className="mb-1">
                        <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                          {withdrawal.category}
                        </span>
                      </div>
                      <p className="text-sm text-gray-900 font-medium">{withdrawal.description}</p>
                      <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                        <span>By: {withdrawal.created_by_name}</span>
                        <span>{new Date(withdrawal.created_at).toLocaleTimeString()}</span>
                      </div>
                      {/* Request Change button - only for Managers, approved transactions, and no pending proposal */}
                      {canCreateChangeProposal && withdrawal.status === 'approved' && (
                        <div className="mt-2 pt-2 border-t border-red-100">
                          {pendingProposals.has(withdrawal.id) ? (
                            <span className="flex items-center gap-1 text-xs text-amber-600">
                              <Clock className="w-3 h-3" />
                              Change pending
                            </span>
                          ) : (
                            <button
                              onClick={() => openChangeRequestModal(withdrawal)}
                              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                            >
                              <Edit3 className="w-3 h-3" />
                              Request Change
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow mt-6">
            <button
              onClick={toggleHistory}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Balance History</h3>
                <span className="text-xs text-gray-500">(Last 14 days)</span>
              </div>
              {showHistory ? (
                <ChevronUp className="w-5 h-5 text-gray-600" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-600" />
              )}
            </button>

            {showHistory && (
              <div className="border-t border-gray-200 p-4">
                {loadingHistory ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-sm">Loading history...</div>
                  </div>
                ) : balanceHistory.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <History className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm">No balance history available</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 px-3 font-semibold text-gray-900">Date</th>
                          <th className="text-right py-2 px-3 font-semibold text-gray-900">Opening</th>
                          <th className="text-right py-2 px-3 font-semibold text-gray-900">Deposits</th>
                          <th className="text-right py-2 px-3 font-semibold text-gray-900">Withdrawals</th>
                          <th className="text-right py-2 px-3 font-semibold text-gray-900">Closing</th>
                          <th className="text-right py-2 px-3 font-semibold text-gray-900">Change</th>
                          <th className="text-left py-2 px-3 font-semibold text-gray-900">Updated By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {balanceHistory.map((record, index) => {
                          const isCurrentDate = record.date === selectedDate;
                          return (
                            <tr
                              key={record.id}
                              className={`border-b border-gray-100 hover:bg-gray-50 ${
                                isCurrentDate ? 'bg-blue-50' : ''
                              }`}
                            >
                              <td className="py-2 px-3">
                                <div className="flex items-center gap-2">
                                  <span className={isCurrentDate ? 'font-semibold text-blue-900' : 'text-gray-900'}>
                                    {new Date(record.date + 'T12:00:00').toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric',
                                    })}
                                  </span>
                                  {isCurrentDate && (
                                    <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">Today</span>
                                  )}
                                </div>
                              </td>
                              <td className="text-right py-2 px-3 text-blue-600 font-medium">
                                ${parseFloat(record.opening_balance).toFixed(2)}
                              </td>
                              <td className="text-right py-2 px-3 text-green-600 font-medium">
                                +${parseFloat(record.total_deposits).toFixed(2)}
                              </td>
                              <td className="text-right py-2 px-3 text-red-600 font-medium">
                                -${parseFloat(record.total_withdrawals).toFixed(2)}
                              </td>
                              <td className="text-right py-2 px-3 text-gray-900 font-semibold">
                                ${parseFloat(record.closing_balance).toFixed(2)}
                              </td>
                              <td className={`text-right py-2 px-3 font-medium ${
                                parseFloat(record.balance_change) >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {parseFloat(record.balance_change) >= 0 ? '+' : ''}
                                ${parseFloat(record.balance_change).toFixed(2)}
                              </td>
                              <td className="py-2 px-3 text-gray-600 text-xs">
                                {record.updated_by_name || record.created_by_name || 'System'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      <SafeWithdrawalModal
        isOpen={showWithdrawalModal}
        onClose={() => setShowWithdrawalModal(false)}
        onSubmit={handleWithdrawalSubmit}
        currentBalance={safeBalance?.closing_balance || 0}
      />

      <CashTransactionChangeRequestModal
        isOpen={showChangeRequestModal}
        onClose={() => {
          setShowChangeRequestModal(false);
          setSelectedTransaction(null);
        }}
        onSubmit={handleChangeRequestSubmit}
        transaction={selectedTransaction}
      />
    </div>
  );
}
