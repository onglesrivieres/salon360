import React, { useState, useEffect } from 'react';
import { Download, Printer, Plus, Save, DollarSign, AlertCircle, AlertTriangle, CheckCircle, Edit, ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Eye, Vault } from 'lucide-react';
import { supabase, EndOfDayRecord, CashTransaction, PendingCashTransactionApproval, CashTransactionType } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import { TicketEditor } from '../components/TicketEditor';
import { CashCountModal } from '../components/CashCountModal';
import { CashTransactionModal, TransactionData } from '../components/CashTransactionModal';
import { TransactionListModal } from '../components/TransactionListModal';
import { useAuth } from '../contexts/AuthContext';
import { Permissions } from '../lib/permissions';
import { getCurrentDateEST } from '../lib/timezone';

interface EndOfDayPageProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
}

interface CashDenominations {
  bill_100: number;
  bill_50: number;
  bill_20: number;
  bill_10: number;
  bill_5: number;
  bill_2: number;
  bill_1: number;
  coin_25: number;
  coin_10: number;
  coin_5: number;
}

export function EndOfDayPage({ selectedDate, onDateChange }: EndOfDayPageProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();
  const { session, selectedStoreId } = useAuth();

  const [eodRecord, setEodRecord] = useState<EndOfDayRecord | null>(null);
  const [expectedCash, setExpectedCash] = useState(0);

  const [openingDenominations, setOpeningDenominations] = useState<CashDenominations>({
    bill_100: 0,
    bill_50: 0,
    bill_20: 0,
    bill_10: 0,
    bill_5: 0,
    bill_2: 0,
    bill_1: 0,
    coin_25: 0,
    coin_10: 0,
    coin_5: 0,
  });

  const [closingDenominations, setClosingDenominations] = useState<CashDenominations>({
    bill_100: 0,
    bill_50: 0,
    bill_20: 0,
    bill_10: 0,
    bill_5: 0,
    bill_2: 0,
    bill_1: 0,
    coin_25: 0,
    coin_10: 0,
    coin_5: 0,
  });

  const [notes, setNotes] = useState('');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null);
  const [isOpeningModalOpen, setIsOpeningModalOpen] = useState(false);
  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);

  const [cashInTransactions, setCashInTransactions] = useState<CashTransaction[]>([]);
  const [cashOutTransactions, setCashOutTransactions] = useState<CashTransaction[]>([]);
  const [isCashInModalOpen, setIsCashInModalOpen] = useState(false);
  const [isCashOutModalOpen, setIsCashOutModalOpen] = useState(false);
  const [isCashInListModalOpen, setIsCashInListModalOpen] = useState(false);
  const [isCashOutListModalOpen, setIsCashOutListModalOpen] = useState(false);
  const [isSafeDepositModalOpen, setIsSafeDepositModalOpen] = useState(false);
  const [editingCashTransaction, setEditingCashTransaction] = useState<CashTransaction | null>(null);
  const [isEditingCashTransaction, setIsEditingCashTransaction] = useState(false);
  const [isAutoFilledFromPreviousDay, setIsAutoFilledFromPreviousDay] = useState(false);

  useEffect(() => {
    loadEODData();
  }, [selectedDate, selectedStoreId]);

  async function loadEODData() {
    if (!selectedStoreId) return;

    try {
      setLoading(true);
      setIsAutoFilledFromPreviousDay(false);

      const { data: existingRecord, error: recordError } = await supabase
        .from('end_of_day_records')
        .select('*')
        .eq('store_id', selectedStoreId)
        .eq('date', selectedDate)
        .maybeSingle();

      if (recordError && recordError.code !== 'PGRST116') throw recordError;

      if (existingRecord) {
        setEodRecord(existingRecord);

        const hasOpeningCash = (
          existingRecord.opening_cash_amount > 0 ||
          existingRecord.bill_100 > 0 ||
          existingRecord.bill_50 > 0 ||
          existingRecord.bill_20 > 0 ||
          existingRecord.bill_10 > 0 ||
          existingRecord.bill_5 > 0 ||
          existingRecord.bill_2 > 0 ||
          existingRecord.bill_1 > 0 ||
          existingRecord.coin_25 > 0 ||
          existingRecord.coin_10 > 0 ||
          existingRecord.coin_5 > 0
        );

        if (hasOpeningCash) {
          setOpeningDenominations({
            bill_100: existingRecord.bill_100,
            bill_50: existingRecord.bill_50,
            bill_20: existingRecord.bill_20,
            bill_10: existingRecord.bill_10,
            bill_5: existingRecord.bill_5,
            bill_2: existingRecord.bill_2,
            bill_1: existingRecord.bill_1,
            coin_25: existingRecord.coin_25,
            coin_10: existingRecord.coin_10,
            coin_5: existingRecord.coin_5,
          });
        } else {
          const previousDayClosing = await fetchPreviousDayClosingCash();
          if (previousDayClosing) {
            setOpeningDenominations(previousDayClosing);
            setIsAutoFilledFromPreviousDay(true);
          } else {
            setOpeningDenominations({
              bill_100: 0,
              bill_50: 0,
              bill_20: 0,
              bill_10: 0,
              bill_5: 0,
              bill_2: 0,
              bill_1: 0,
              coin_25: 0,
              coin_10: 0,
              coin_5: 0,
            });
          }
        }

        setClosingDenominations({
          bill_100: existingRecord.closing_bill_100,
          bill_50: existingRecord.closing_bill_50,
          bill_20: existingRecord.closing_bill_20,
          bill_10: existingRecord.closing_bill_10,
          bill_5: existingRecord.closing_bill_5,
          bill_2: existingRecord.closing_bill_2,
          bill_1: existingRecord.closing_bill_1,
          coin_25: existingRecord.closing_coin_25,
          coin_10: existingRecord.closing_coin_10,
          coin_5: existingRecord.closing_coin_5,
        });
        setNotes(existingRecord.notes || '');
      } else {
        setEodRecord(null);
        const previousDayClosing = await fetchPreviousDayClosingCash();
        if (previousDayClosing) {
          setOpeningDenominations(previousDayClosing);
          setIsAutoFilledFromPreviousDay(true);
        } else {
          setOpeningDenominations({
            bill_100: 0,
            bill_50: 0,
            bill_20: 0,
            bill_10: 0,
            bill_5: 0,
            bill_2: 0,
            bill_1: 0,
            coin_25: 0,
            coin_10: 0,
            coin_5: 0,
          });
        }
        setClosingDenominations({
          bill_100: 0,
          bill_50: 0,
          bill_20: 0,
          bill_10: 0,
          bill_5: 0,
          bill_2: 0,
          bill_1: 0,
          coin_25: 0,
          coin_10: 0,
          coin_5: 0,
        });
        setNotes('');
      }

      const { data: tickets, error: ticketsError } = await supabase
        .from('sale_tickets')
        .select(
          `
          id,
          ticket_items (
            payment_cash,
            tip_customer_cash
          )
        `
        )
        .eq('ticket_date', selectedDate)
        .eq('store_id', selectedStoreId)
        .not('closed_at', 'is', null);

      if (ticketsError) throw ticketsError;

      console.log('EOD Tickets Query Results:', {
        ticketCount: tickets?.length || 0,
        sampleTicket: tickets?.[0],
        selectedDate,
        selectedStoreId
      });

      let totalCash = 0;
      for (const ticket of tickets || []) {
        const ticketItems = (ticket as any).ticket_items || [];
        console.log('Processing ticket:', ticket, 'Items:', ticketItems);

        for (const item of ticketItems) {
          const paymentCash = parseFloat(item.payment_cash) || 0;
          const tipCash = parseFloat(item.tip_customer_cash) || 0;
          const itemTotal = paymentCash + tipCash;

          console.log('Item cash calculation:', {
            payment_cash: paymentCash,
            tip_customer_cash: tipCash,
            itemTotal
          });

          totalCash += itemTotal;
        }
      }

      console.log('Total cash from tickets:', totalCash);
      setExpectedCash(totalCash);

      await loadCashTransactions();
    } catch (error) {
      showToast('Failed to load EOD data', 'error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function loadCashTransactions() {
    if (!selectedStoreId) return;

    try {
      const { data, error } = await supabase
        .from('cash_transactions')
        .select('*')
        .eq('store_id', selectedStoreId)
        .eq('date', selectedDate)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const cashIn = (data || []).filter(t => t.transaction_type === 'cash_in');
      const cashOut = (data || []).filter(t => t.transaction_type === 'cash_out');

      setCashInTransactions(cashIn);
      setCashOutTransactions(cashOut);
    } catch (error) {
      console.error('Failed to load cash transactions:', error);
    }
  }

  function getPreviousDayDate(dateString: string): string {
    const date = new Date(dateString + 'T00:00:00');
    date.setDate(date.getDate() - 1);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  async function fetchPreviousDayClosingCash(): Promise<CashDenominations | null> {
    if (!selectedStoreId) return null;

    try {
      const previousDay = getPreviousDayDate(selectedDate);

      const { data: previousRecord, error } = await supabase
        .from('end_of_day_records')
        .select('*')
        .eq('store_id', selectedStoreId)
        .eq('date', previousDay)
        .maybeSingle();

      if (error || !previousRecord) return null;

      const hasClosingCash = (
        previousRecord.closing_cash_amount > 0 ||
        previousRecord.closing_bill_100 > 0 ||
        previousRecord.closing_bill_50 > 0 ||
        previousRecord.closing_bill_20 > 0 ||
        previousRecord.closing_bill_10 > 0 ||
        previousRecord.closing_bill_5 > 0 ||
        previousRecord.closing_bill_2 > 0 ||
        previousRecord.closing_bill_1 > 0 ||
        previousRecord.closing_coin_25 > 0 ||
        previousRecord.closing_coin_10 > 0 ||
        previousRecord.closing_coin_5 > 0
      );

      if (!hasClosingCash) return null;

      return {
        bill_100: previousRecord.closing_bill_100,
        bill_50: previousRecord.closing_bill_50,
        bill_20: previousRecord.closing_bill_20,
        bill_10: previousRecord.closing_bill_10,
        bill_5: previousRecord.closing_bill_5,
        bill_2: previousRecord.closing_bill_2,
        bill_1: previousRecord.closing_bill_1,
        coin_25: previousRecord.closing_coin_25,
        coin_10: previousRecord.closing_coin_10,
        coin_5: previousRecord.closing_coin_5,
      };
    } catch (error) {
      console.error('Failed to fetch previous day closing cash:', error);
      return null;
    }
  }


  function calculateTotal(denominations: CashDenominations): number {
    return (
      denominations.bill_100 * 100 +
      denominations.bill_50 * 50 +
      denominations.bill_20 * 20 +
      denominations.bill_10 * 10 +
      denominations.bill_5 * 5 +
      denominations.bill_2 * 2 +
      denominations.bill_1 * 1 +
      denominations.coin_25 * 0.25 +
      denominations.coin_10 * 0.10 +
      denominations.coin_5 * 0.05
    );
  }

  const openingCashTotal = calculateTotal(openingDenominations);
  const closingCashTotal = calculateTotal(closingDenominations);

  const totalCashIn = cashInTransactions
    .filter(t => t.status === 'approved')
    .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

  const totalCashOut = cashOutTransactions
    .filter(t => t.status === 'approved')
    .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

  const netCashCollected = expectedCash + totalCashIn - totalCashOut;
  const actualCashChange = closingCashTotal - openingCashTotal;
  const cashVariance = actualCashChange - netCashCollected;
  const isBalanced = Math.abs(cashVariance) < 0.01;
  const isOpeningCashRecorded = eodRecord && (
    eodRecord.opening_cash_amount > 0 ||
    eodRecord.bill_100 > 0 ||
    eodRecord.bill_50 > 0 ||
    eodRecord.bill_20 > 0 ||
    eodRecord.bill_10 > 0 ||
    eodRecord.bill_5 > 0 ||
    eodRecord.bill_2 > 0 ||
    eodRecord.bill_1 > 0 ||
    eodRecord.coin_25 > 0 ||
    eodRecord.coin_10 > 0 ||
    eodRecord.coin_5 > 0
  );
  const isClosingCashRecorded = eodRecord && (
    eodRecord.closing_cash_amount > 0 ||
    eodRecord.closing_bill_100 > 0 ||
    eodRecord.closing_bill_50 > 0 ||
    eodRecord.closing_bill_20 > 0 ||
    eodRecord.closing_bill_10 > 0 ||
    eodRecord.closing_bill_5 > 0 ||
    eodRecord.closing_bill_2 > 0 ||
    eodRecord.closing_bill_1 > 0 ||
    eodRecord.closing_coin_25 > 0 ||
    eodRecord.closing_coin_10 > 0 ||
    eodRecord.closing_coin_5 > 0
  );

  async function handleOpeningSubmit(denominations: CashDenominations) {
    if (!selectedStoreId || !session?.employee_id) {
      showToast('Missing required information', 'error');
      return;
    }

    try {
      setSaving(true);
      setOpeningDenominations(denominations);

      const openingTotal = (
        denominations.bill_100 * 100 +
        denominations.bill_50 * 50 +
        denominations.bill_20 * 20 +
        denominations.bill_10 * 10 +
        denominations.bill_5 * 5 +
        denominations.bill_2 * 2 +
        denominations.bill_1 * 1 +
        denominations.coin_25 * 0.25 +
        denominations.coin_10 * 0.10 +
        denominations.coin_5 * 0.05
      );

      const recordData = {
        store_id: selectedStoreId,
        date: selectedDate,
        opening_cash_amount: openingTotal,
        bill_100: denominations.bill_100,
        bill_50: denominations.bill_50,
        bill_20: denominations.bill_20,
        bill_10: denominations.bill_10,
        bill_5: denominations.bill_5,
        bill_2: denominations.bill_2,
        bill_1: denominations.bill_1,
        coin_25: denominations.coin_25,
        coin_10: denominations.coin_10,
        coin_5: denominations.coin_5,
        closing_cash_amount: closingCashTotal,
        closing_bill_100: closingDenominations.bill_100,
        closing_bill_50: closingDenominations.bill_50,
        closing_bill_20: closingDenominations.bill_20,
        closing_bill_10: closingDenominations.bill_10,
        closing_bill_5: closingDenominations.bill_5,
        closing_bill_2: closingDenominations.bill_2,
        closing_bill_1: closingDenominations.bill_1,
        closing_coin_25: closingDenominations.coin_25,
        closing_coin_10: closingDenominations.coin_10,
        closing_coin_5: closingDenominations.coin_5,
        notes: notes,
        updated_by: session.employee_id,
        updated_at: new Date().toISOString(),
      };

      if (eodRecord) {
        const { error } = await supabase
          .from('end_of_day_records')
          .update(recordData)
          .eq('id', eodRecord.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('end_of_day_records')
          .insert({
            ...recordData,
            created_by: session.employee_id,
          });

        if (error) throw error;
      }

      showToast('Opening cash saved successfully', 'success');
      setIsAutoFilledFromPreviousDay(false);

      await supabase.rpc('save_safe_balance_snapshot', {
        p_store_id: selectedStoreId,
        p_date: selectedDate,
        p_employee_id: session.employee_id,
      });

      await loadEODData();

      window.dispatchEvent(new CustomEvent('openingCashUpdated'));
    } catch (error) {
      showToast('Failed to save opening cash', 'error');
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  function handleClosingSubmit(denominations: CashDenominations) {
    setClosingDenominations(denominations);
  }

  async function saveEODRecord() {
    if (!selectedStoreId || !session?.employee_id) {
      showToast('Missing required information', 'error');
      return;
    }

    try {
      setSaving(true);

      const recordData = {
        store_id: selectedStoreId,
        date: selectedDate,
        opening_cash_amount: openingCashTotal,
        bill_100: openingDenominations.bill_100,
        bill_50: openingDenominations.bill_50,
        bill_20: openingDenominations.bill_20,
        bill_10: openingDenominations.bill_10,
        bill_5: openingDenominations.bill_5,
        bill_2: openingDenominations.bill_2,
        bill_1: openingDenominations.bill_1,
        coin_25: openingDenominations.coin_25,
        coin_10: openingDenominations.coin_10,
        coin_5: openingDenominations.coin_5,
        closing_cash_amount: closingCashTotal,
        closing_bill_100: closingDenominations.bill_100,
        closing_bill_50: closingDenominations.bill_50,
        closing_bill_20: closingDenominations.bill_20,
        closing_bill_10: closingDenominations.bill_10,
        closing_bill_5: closingDenominations.bill_5,
        closing_bill_2: closingDenominations.bill_2,
        closing_bill_1: closingDenominations.bill_1,
        closing_coin_25: closingDenominations.coin_25,
        closing_coin_10: closingDenominations.coin_10,
        closing_coin_5: closingDenominations.coin_5,
        notes: notes,
        updated_by: session.employee_id,
        updated_at: new Date().toISOString(),
      };

      if (eodRecord) {
        const { error } = await supabase
          .from('end_of_day_records')
          .update(recordData)
          .eq('id', eodRecord.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('end_of_day_records')
          .insert({
            ...recordData,
            created_by: session.employee_id,
          });

        if (error) throw error;
      }

      showToast('EOD record saved successfully', 'success');

      await supabase.rpc('save_safe_balance_snapshot', {
        p_store_id: selectedStoreId,
        p_date: selectedDate,
        p_employee_id: session.employee_id,
      });

      loadEODData();
    } catch (error) {
      showToast('Failed to save EOD record', 'error');
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  function exportCSV() {
    const headers = ['Description', 'Amount'];
    const rows = [
      ['Opening Cash', openingCashTotal.toFixed(2)],
      ['  $100 Bills', `${openingDenominations.bill_100} x $100`],
      ['  $50 Bills', `${openingDenominations.bill_50} x $50`],
      ['  $20 Bills', `${openingDenominations.bill_20} x $20`],
      ['  $10 Bills', `${openingDenominations.bill_10} x $10`],
      ['  $5 Bills', `${openingDenominations.bill_5} x $5`],
      ['  $2 Bills', `${openingDenominations.bill_2} x $2`],
      ['  $1 Bills', `${openingDenominations.bill_1} x $1`],
      ['  25¢ Coins', `${openingDenominations.coin_25} x $0.25`],
      ['  10¢ Coins', `${openingDenominations.coin_10} x $0.10`],
      ['  5¢ Coins', `${openingDenominations.coin_5} x $0.05`],
      ['', ''],
      ['Closing Cash', closingCashTotal.toFixed(2)],
      ['  $100 Bills', `${closingDenominations.bill_100} x $100`],
      ['  $50 Bills', `${closingDenominations.bill_50} x $50`],
      ['  $20 Bills', `${closingDenominations.bill_20} x $20`],
      ['  $10 Bills', `${closingDenominations.bill_10} x $10`],
      ['  $5 Bills', `${closingDenominations.bill_5} x $5`],
      ['  $2 Bills', `${closingDenominations.bill_2} x $2`],
      ['  $1 Bills', `${closingDenominations.bill_1} x $1`],
      ['  25¢ Coins', `${closingDenominations.coin_25} x $0.25`],
      ['  10¢ Coins', `${closingDenominations.coin_10} x $0.10`],
      ['  5¢ Coins', `${closingDenominations.coin_5} x $0.05`],
      ['', ''],
      ['Total Cash In (Approved)', totalCashIn.toFixed(2)],
      ['Total Cash Out (Approved)', totalCashOut.toFixed(2)],
      ['', ''],
      ['Net Cash Collected', netCashCollected.toFixed(2)],
      ['Expected Cash from Tickets', expectedCash.toFixed(2)],
      ['Cash Variance', cashVariance.toFixed(2)],
      ['Status', isBalanced ? 'BALANCED' : 'UNBALANCED'],
    ];

    if (cashInTransactions.length > 0) {
      rows.push(['', '']);
      rows.push(['Cash In Transactions', '']);
      rows.push(['Status', 'Amount', 'Description', 'Category']);
      cashInTransactions.forEach(t => {
        rows.push([t.status, t.amount.toFixed(2), t.description, t.category || '']);
      });
    }

    if (cashOutTransactions.length > 0) {
      rows.push(['', '']);
      rows.push(['Cash Out Transactions', '']);
      rows.push(['Status', 'Amount', 'Description', 'Category']);
      cashOutTransactions.forEach(t => {
        rows.push([t.status, t.amount.toFixed(2), t.description, t.category || '']);
      });
    }

    const csv = rows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eod-cash-reconciliation-${selectedDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    showToast('Cash reconciliation exported successfully', 'success');
  }

  function handlePrint() {
    window.print();
    showToast('Opening print dialog', 'success');
  }

  function getMinDate(): string {
    const canViewUnlimitedHistory = session?.role ? Permissions.endOfDay.canViewAll(session.role) : false;

    if (canViewUnlimitedHistory) {
      return '2000-01-01';
    }

    const today = getCurrentDateEST();
    const date = new Date(today);
    date.setDate(date.getDate() - 14);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function getMaxDate(): string {
    return getCurrentDateEST();
  }

  function navigateDay(direction: 'prev' | 'next'): void {
    const currentDate = new Date(selectedDate + 'T00:00:00');
    if (direction === 'prev') {
      currentDate.setDate(currentDate.getDate() - 1);
    } else {
      currentDate.setDate(currentDate.getDate() + 1);
    }
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    onDateChange(`${year}-${month}-${day}`);
  }

  function canNavigatePrev(): boolean {
    return selectedDate > getMinDate();
  }

  function canNavigateNext(): boolean {
    return selectedDate < getMaxDate();
  }

  function openEditor(ticketId: string) {
    setEditingTicketId(ticketId);
    setIsEditorOpen(true);
  }

  function closeEditor() {
    setIsEditorOpen(false);
    setEditingTicketId(null);
    loadEODData();
  }

  function openNewTicket() {
    setEditingTicketId(null);
    setIsEditorOpen(true);
  }

  async function handleCashTransactionSubmit(transactionType: CashTransactionType, data: TransactionData) {
    if (!selectedStoreId || !session?.employee_id) {
      showToast('Missing required information', 'error');
      return;
    }

    try {
      setSaving(true);

      if (data.transactionId) {
        const { data: currentTransaction, error: fetchError } = await supabase
          .from('cash_transactions')
          .select('*')
          .eq('id', data.transactionId)
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (!currentTransaction) {
          showToast('Transaction not found', 'error');
          return;
        }

        const { error: updateError } = await supabase
          .from('cash_transactions')
          .update({
            amount: data.amount,
            description: data.description,
            category: data.category,
            last_edited_by_id: session.employee_id,
            last_edited_at: new Date().toISOString(),
          })
          .eq('id', data.transactionId);

        if (updateError) throw updateError;

        if (data.editReason) {
          await supabase
            .from('cash_transaction_edit_history')
            .insert({
              transaction_id: data.transactionId,
              edited_by_id: session.employee_id,
              edited_at: new Date().toISOString(),
              old_amount: currentTransaction.amount,
              new_amount: data.amount,
              old_description: currentTransaction.description,
              new_description: data.description,
              old_category: currentTransaction.category,
              new_category: data.category,
              edit_reason: data.editReason,
            });
        }

        showToast('Transaction updated successfully', 'success');
      } else {
        const { data: result, error } = await supabase
          .rpc('create_cash_transaction_with_validation', {
            p_store_id: selectedStoreId,
            p_date: selectedDate,
            p_transaction_type: transactionType,
            p_amount: data.amount,
            p_description: data.description,
            p_category: data.category,
            p_created_by_id: session.employee_id,
          });

        if (error) throw error;

        if (result && !result.success) {
          showToast(result.error || 'Failed to create transaction', 'error');
          return;
        }

        showToast('Transaction submitted for manager approval', 'success');
      }

      await loadCashTransactions();
    } catch (error) {
      showToast('Failed to save transaction', 'error');
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  function handleEditCashTransaction(transaction: CashTransaction) {
    setEditingCashTransaction(transaction);
    setIsEditingCashTransaction(true);

    if (transaction.transaction_type === 'cash_in') {
      setIsCashInListModalOpen(false);
      setIsCashInModalOpen(true);
    } else {
      setIsCashOutListModalOpen(false);
      setIsCashOutModalOpen(true);
    }
  }

  async function handleVoidCashTransaction(reason: string) {
    if (!editingCashTransaction || !session?.employee_id) return;

    try {
      setSaving(true);
      const { data: result, error } = await supabase.rpc('create_cash_transaction_change_proposal', {
        p_cash_transaction_id: editingCashTransaction.id,
        p_is_deletion_request: true,
        p_reason_comment: reason,
        p_created_by_employee_id: session.employee_id,
      });

      if (error) {
        showToast(error.message || 'Failed to submit void request', 'error');
        console.error('Void request error:', error);
        return;
      }

      if (result && !result.success) {
        showToast(result.error || 'Failed to submit void request', 'error');
        return;
      }

      showToast('Void request submitted for approval', 'success');
      await loadCashTransactions();
    } catch (error: any) {
      showToast(error?.message || 'Failed to submit void request', 'error');
      console.error('Void request exception:', error);
    } finally {
      setSaving(false);
      setIsCashOutModalOpen(false);
      setEditingCashTransaction(null);
      setIsEditingCashTransaction(false);
    }
  }


  return (
    <div className="max-w-7xl 2k:max-w-full mx-auto 2k:px-8">
      {!isOpeningCashRecorded && (
        <div className="mb-4 bg-amber-50 border-2 border-amber-400 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-amber-900 mb-1">Opening Cash Count Required</h3>
              <p className="text-sm text-amber-800 mb-2">
                {isAutoFilledFromPreviousDay
                  ? "Opening cash has been pre-filled with yesterday's closing balance. Please verify and adjust if needed."
                  : "You must count and record the opening cash before creating any sale tickets for today."}
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsOpeningModalOpen(true)}
                className="bg-amber-600 hover:bg-amber-700"
              >
                <DollarSign className="w-4 h-4 mr-1" />
                {isAutoFilledFromPreviousDay ? 'Verify Opening Cash' : 'Count Opening Cash Now'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
        <h2 className="text-base md:text-lg font-bold text-gray-900">End of Day</h2>
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <div className="flex items-center gap-2 flex-1 md:flex-initial">
            <button
              onClick={() => navigateDay('prev')}
              disabled={!canNavigatePrev()}
              className="p-2 md:p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors min-h-[44px] md:min-h-[32px] min-w-[44px] md:min-w-[32px] flex items-center justify-center"
              aria-label="Previous day"
            >
              <ChevronLeft className="w-5 h-5 md:w-4 md:h-4" />
            </button>
            <div className="flex items-center gap-2 flex-1 md:flex-initial">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => onDateChange(e.target.value)}
                min={getMinDate()}
                max={getMaxDate()}
                className="px-2 py-2 md:py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 md:flex-initial min-h-[44px] md:min-h-0"
              />
            </div>
            <button
              onClick={() => navigateDay('next')}
              disabled={!canNavigateNext()}
              className="p-2 md:p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors min-h-[44px] md:min-h-[32px] min-w-[44px] md:min-w-[32px] flex items-center justify-center"
              aria-label="Next day"
            >
              <ChevronRight className="w-5 h-5 md:w-4 md:h-4" />
            </button>
          </div>
          {session && session.role && Permissions.endOfDay.canExport(session.role) && (
            <>
              <Button variant="secondary" size="sm" onClick={exportCSV} className="hidden md:flex">
                <Download className="w-3 h-3 mr-1" />
                Export
              </Button>
              <Button variant="secondary" size="sm" onClick={handlePrint} className="hidden md:flex">
                <Printer className="w-3 h-3 mr-1" />
                Print
              </Button>
              <Button variant="primary" size="sm" onClick={openNewTicket} className="min-h-[44px] md:min-h-0">
                <Plus className="w-4 h-4 md:w-3 md:h-3 mr-1" />
                <span className="hidden xs:inline">New Ticket</span>
                <span className="xs:hidden">New</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-sm text-gray-500">Loading...</div>
        </div>
      ) : (
        <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 2k:grid-cols-5 gap-2 2k:gap-3 mb-4">
            <div className={`bg-white rounded-lg shadow p-3 2k:p-4 ${!isOpeningCashRecorded ? 'ring-2 ring-amber-400' : ''}`}>
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-green-600" />
                <h3 className="text-sm font-semibold text-gray-900">Opening</h3>
              </div>
              <div className="text-center py-2">
                <p className="text-xs text-gray-600 mb-1">Total Amount</p>
                <p className="text-xl font-bold text-green-600 mb-2">${openingCashTotal.toFixed(2)}</p>
                <Button
                  variant={!isOpeningCashRecorded ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => setIsOpeningModalOpen(true)}
                  className={`w-full ${!isOpeningCashRecorded ? 'bg-amber-600 hover:bg-amber-700 animate-pulse' : ''}`}
                >
                  <Edit className="w-3 h-3 mr-1" />
                  {isOpeningCashRecorded ? 'Edit Count' : 'Count Bills'}
                </Button>
                {isOpeningCashRecorded ? (
                  <div className="mt-2 flex items-center justify-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded">
                    <CheckCircle className="w-3 h-3" />
                    Recorded
                  </div>
                ) : isAutoFilledFromPreviousDay ? (
                  <div className="mt-2 flex items-center justify-center gap-1 text-xs font-medium text-blue-700 bg-blue-100 px-2 py-1 rounded">
                    <AlertCircle className="w-3 h-3" />
                    Pre-filled
                  </div>
                ) : (
                  <div className="mt-2 flex items-center justify-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-1 rounded">
                    <AlertCircle className="w-3 h-3" />
                    Required
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg shadow p-3 2k:p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-gray-700" />
                <h3 className="text-sm font-semibold text-gray-900">Current Register</h3>
              </div>
              <div className="text-center py-2">
                <p className="text-xs text-gray-600 mb-1">Current Amount</p>
                <p className="text-xl font-bold text-gray-900 mb-2">${netCashCollected.toFixed(2)}</p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsSafeDepositModalOpen(true)}
                  className="w-full"
                >
                  <Vault className="w-3 h-3 mr-1" />
                  Safe Deposit
                </Button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-3 2k:p-4">
              <div className="flex items-center gap-2 mb-2">
                <ArrowDownLeft className="w-4 h-4 text-green-600" />
                <h3 className="text-sm font-semibold text-gray-900">Cash In</h3>
              </div>
              <div className="text-center py-2">
                <p className="text-xs text-gray-600 mb-1">Total Amount</p>
                <button
                  onClick={() => setIsCashInListModalOpen(true)}
                  className="text-xl font-bold text-green-600 mb-2 hover:text-green-700 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 rounded px-2"
                  title="View all Cash In transactions"
                >
                  ${totalCashIn.toFixed(2)}
                </button>
                {cashInTransactions.length > 0 && (
                  <button
                    onClick={() => setIsCashInListModalOpen(true)}
                    className="w-full mb-2 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors flex items-center justify-center gap-1"
                  >
                    <Eye className="w-3 h-3" />
                    View {cashInTransactions.length} Transaction{cashInTransactions.length !== 1 ? 's' : ''}
                  </button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsCashInModalOpen(true)}
                  className="w-full"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Deposit
                </Button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-3 2k:p-4">
              <div className="flex items-center gap-2 mb-2">
                <ArrowUpRight className="w-4 h-4 text-red-600" />
                <h3 className="text-sm font-semibold text-gray-900">Cash Out</h3>
              </div>
              <div className="text-center py-2">
                <p className="text-xs text-gray-600 mb-1">Total Amount</p>
                <button
                  onClick={() => setIsCashOutListModalOpen(true)}
                  className="text-xl font-bold text-red-600 mb-2 hover:text-red-700 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded px-2"
                  title="View all Cash Out transactions"
                >
                  ${totalCashOut.toFixed(2)}
                </button>
                {cashOutTransactions.length > 0 && (
                  <button
                    onClick={() => setIsCashOutListModalOpen(true)}
                    className="w-full mb-2 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex items-center justify-center gap-1"
                  >
                    <Eye className="w-3 h-3" />
                    View {cashOutTransactions.length} Transaction{cashOutTransactions.length !== 1 ? 's' : ''}
                  </button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsCashOutModalOpen(true)}
                  className="w-full"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Withdraw
                </Button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-3 2k:p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-gray-900">Closing</h3>
              </div>
              <div className="text-center py-2">
                <p className="text-xs text-gray-600 mb-1">Total Amount</p>
                <p className="text-xl font-bold text-blue-600 mb-2">${closingCashTotal.toFixed(2)}</p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsClosingModalOpen(true)}
                  className="w-full"
                >
                  <Edit className="w-3 h-3 mr-1" />
                  Count Bills
                </Button>
                {isClosingCashRecorded && (
                  <div className="mt-2 flex items-center justify-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded">
                    <CheckCircle className="w-3 h-3" />
                    Recorded
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow mb-4">
            <div className="p-4">
              <div className="p-4 rounded-lg border-2 bg-white border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      Expected Cash Collected
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Cash payments + cash tips from tickets</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900">
                      ${expectedCash.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-4 rounded-lg border-2 bg-white border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      Net Cash Collected
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Expected cash + cash in - cash out</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900">
                      ${netCashCollected.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              <div className={`mt-4 p-4 rounded-lg border-2 ${
                isBalanced
                  ? 'bg-green-50 border-green-500'
                  : cashVariance < 0
                    ? 'bg-red-50 border-red-500'
                    : 'bg-yellow-50 border-yellow-500'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isBalanced ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : cashVariance < 0 ? (
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-yellow-600" />
                    )}
                    <p className="text-2xl font-bold text-gray-900">
                      Cash Discrepancy
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${
                      isBalanced
                        ? 'text-green-600'
                        : cashVariance < 0
                          ? 'text-red-600'
                          : 'text-yellow-600'
                    }`}>
                      {isBalanced
                        ? 'Balanced'
                        : cashVariance < 0
                          ? `Short by $${Math.abs(cashVariance).toFixed(2)}`
                          : `Over by $${cashVariance.toFixed(2)}`
                      }
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={1}
                  placeholder="Add any notes about cash discrepancies or other observations..."
                />
              </div>

              <div className="mt-4 flex justify-end">
                <Button
                  variant="primary"
                  onClick={saveEODRecord}
                  disabled={saving}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Saving...' : 'Save EOD Record'}
                </Button>
              </div>

              {eodRecord && (
                <div className="mt-3 text-xs text-gray-500">
                  Last updated: {new Date(eodRecord.updated_at).toLocaleString()}
                </div>
              )}
            </div>
          </div>

          {cashInTransactions.length > 0 && (
            <div className="mb-4">
              <div className="bg-white rounded-lg shadow">
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <ArrowDownLeft className="w-5 h-5 text-green-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Cash In Transactions</h3>
                  </div>
                </div>
                <div className="p-4">
                  <div className="space-y-3">
                    {cashInTransactions.map((transaction) => (
                      <div
                        key={transaction.id}
                        onClick={() => handleEditCashTransaction(transaction)}
                        className="p-3 border border-gray-200 rounded-lg hover:border-green-300 hover:bg-green-50 transition-colors cursor-pointer"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg font-bold text-green-600">
                                ${parseFloat(transaction.amount.toString()).toFixed(2)}
                              </span>
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  transaction.status === 'approved'
                                    ? 'bg-green-100 text-green-700'
                                    : transaction.status === 'rejected'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-amber-100 text-amber-700'
                                }`}
                              >
                                {transaction.status === 'approved'
                                  ? 'Approved'
                                  : transaction.status === 'rejected'
                                  ? 'Rejected'
                                  : 'Pending'}
                              </span>
                            </div>
                            <p className="text-sm text-gray-900 font-medium">{transaction.description}</p>
                            {transaction.category && (
                              <p className="text-xs text-gray-500 mt-1">Category: {transaction.category}</p>
                            )}
                            <p className="text-xs text-gray-400 mt-1">
                              {new Date(transaction.created_at).toLocaleString()}
                            </p>
                          </div>
                          <Edit className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {isEditorOpen && (
        <TicketEditor
          ticketId={editingTicketId}
          onClose={closeEditor}
          selectedDate={selectedDate}
        />
      )}

      <CashCountModal
        isOpen={isOpeningModalOpen}
        onClose={() => setIsOpeningModalOpen(false)}
        title="Opening Cash Count"
        initialDenominations={openingDenominations}
        onSubmit={handleOpeningSubmit}
        colorScheme="green"
      />

      <CashCountModal
        isOpen={isClosingModalOpen}
        onClose={() => setIsClosingModalOpen(false)}
        title="Closing Cash Count"
        initialDenominations={closingDenominations}
        onSubmit={handleClosingSubmit}
        colorScheme="blue"
      />

      <CashTransactionModal
        isOpen={isCashInModalOpen}
        onClose={() => {
          setIsCashInModalOpen(false);
          setEditingCashTransaction(null);
          setIsEditingCashTransaction(false);
        }}
        onSubmit={(data) => handleCashTransactionSubmit('cash_in', data)}
        transactionType="cash_in"
        mode={isEditingCashTransaction && editingCashTransaction?.transaction_type === 'cash_in' ? 'edit' : 'create'}
        transactionId={editingCashTransaction?.id}
        initialData={
          isEditingCashTransaction && editingCashTransaction?.transaction_type === 'cash_in'
            ? {
                amount: parseFloat(editingCashTransaction.amount.toString()),
                description: editingCashTransaction.description,
                category: editingCashTransaction.category || '',
              }
            : undefined
        }
      />

      <CashTransactionModal
        isOpen={isCashOutModalOpen}
        onClose={() => {
          setIsCashOutModalOpen(false);
          setEditingCashTransaction(null);
          setIsEditingCashTransaction(false);
        }}
        onSubmit={(data) => handleCashTransactionSubmit('cash_out', data)}
        transactionType="cash_out"
        mode={isEditingCashTransaction && editingCashTransaction?.transaction_type === 'cash_out' ? 'edit' : 'create'}
        transactionId={editingCashTransaction?.id}
        initialData={
          isEditingCashTransaction && editingCashTransaction?.transaction_type === 'cash_out'
            ? {
                amount: parseFloat(editingCashTransaction.amount.toString()),
                description: editingCashTransaction.description,
                category: editingCashTransaction.category || '',
              }
            : undefined
        }
        onVoid={handleVoidCashTransaction}
        canVoid={session?.role ? Permissions.cashTransactions.canCreateChangeProposal(session.role) : false}
        transactionStatus={editingCashTransaction?.status}
      />

      <CashTransactionModal
        isOpen={isSafeDepositModalOpen}
        onClose={() => setIsSafeDepositModalOpen(false)}
        onSubmit={(data) => handleCashTransactionSubmit('cash_out', data)}
        transactionType="cash_out"
        defaultCategory="Safe Deposit"
        defaultDescription="Safe deposit from till"
      />

      <TransactionListModal
        isOpen={isCashInListModalOpen}
        onClose={() => setIsCashInListModalOpen(false)}
        transactions={cashInTransactions}
        transactionType="cash_in"
        onAddNew={() => {
          setIsCashInListModalOpen(false);
          setIsCashInModalOpen(true);
        }}
        onEdit={handleEditCashTransaction}
      />

      <TransactionListModal
        isOpen={isCashOutListModalOpen}
        onClose={() => setIsCashOutListModalOpen(false)}
        transactions={cashOutTransactions}
        transactionType="cash_out"
        onAddNew={() => {
          setIsCashOutListModalOpen(false);
          setIsCashOutModalOpen(true);
        }}
        onEdit={handleEditCashTransaction}
      />
    </div>
  );
}
