import React, { useState, useEffect } from 'react';
import { Calendar, Download, Printer, Plus, Save, DollarSign, AlertCircle, CheckCircle, Edit } from 'lucide-react';
import { supabase, EndOfDayRecord } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import { TicketEditor } from '../components/TicketEditor';
import { CashCountModal } from '../components/CashCountModal';
import { useAuth } from '../contexts/AuthContext';
import { Permissions } from '../lib/permissions';

interface EndOfDayPageProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
}

interface CashDenominations {
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
    bill_20: 0,
    bill_10: 10,
    bill_5: 10,
    bill_2: 10,
    bill_1: 20,
    coin_25: 8,
    coin_10: 0,
    coin_5: 0,
  });

  const [closingDenominations, setClosingDenominations] = useState<CashDenominations>({
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

  useEffect(() => {
    loadEODData();
  }, [selectedDate, selectedStoreId]);

  async function loadEODData() {
    if (!selectedStoreId) return;

    try {
      setLoading(true);

      const { data: existingRecord, error: recordError } = await supabase
        .from('end_of_day_records')
        .select('*')
        .eq('store_id', selectedStoreId)
        .eq('date', selectedDate)
        .maybeSingle();

      if (recordError && recordError.code !== 'PGRST116') throw recordError;

      if (existingRecord) {
        setEodRecord(existingRecord);
        setOpeningDenominations({
          bill_20: existingRecord.bill_20,
          bill_10: existingRecord.bill_10,
          bill_5: existingRecord.bill_5,
          bill_2: existingRecord.bill_2,
          bill_1: existingRecord.bill_1,
          coin_25: existingRecord.coin_25,
          coin_10: existingRecord.coin_10,
          coin_5: existingRecord.coin_5,
        });
        setClosingDenominations({
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
      }

      const { data: tickets, error: ticketsError } = await supabase
        .from('sale_tickets')
        .select('payment_cash')
        .eq('ticket_date', selectedDate)
        .eq('store_id', selectedStoreId)
        .not('closed_at', 'is', null);

      if (ticketsError) throw ticketsError;

      const totalCash = tickets?.reduce((sum, ticket) => sum + (parseFloat(ticket.payment_cash as any) || 0), 0) || 0;
      setExpectedCash(totalCash);
    } catch (error) {
      showToast('Failed to load EOD data', 'error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  function calculateTotal(denominations: CashDenominations): number {
    return (
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
  const netCashCollected = closingCashTotal - openingCashTotal;
  const cashVariance = netCashCollected - expectedCash;
  const isBalanced = Math.abs(cashVariance) < 0.01;
  const isOpeningCashRecorded = eodRecord && (
    eodRecord.opening_cash_amount > 0 ||
    eodRecord.bill_20 > 0 ||
    eodRecord.bill_10 > 0 ||
    eodRecord.bill_5 > 0 ||
    eodRecord.bill_2 > 0 ||
    eodRecord.bill_1 > 0 ||
    eodRecord.coin_25 > 0 ||
    eodRecord.coin_10 > 0 ||
    eodRecord.coin_5 > 0
  );

  function handleOpeningSubmit(denominations: CashDenominations) {
    setOpeningDenominations(denominations);
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
        bill_20: openingDenominations.bill_20,
        bill_10: openingDenominations.bill_10,
        bill_5: openingDenominations.bill_5,
        bill_2: openingDenominations.bill_2,
        bill_1: openingDenominations.bill_1,
        coin_25: openingDenominations.coin_25,
        coin_10: openingDenominations.coin_10,
        coin_5: openingDenominations.coin_5,
        closing_cash_amount: closingCashTotal,
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
      ['  $20 Bills', `${closingDenominations.bill_20} x $20`],
      ['  $10 Bills', `${closingDenominations.bill_10} x $10`],
      ['  $5 Bills', `${closingDenominations.bill_5} x $5`],
      ['  $2 Bills', `${closingDenominations.bill_2} x $2`],
      ['  $1 Bills', `${closingDenominations.bill_1} x $1`],
      ['  25¢ Coins', `${closingDenominations.coin_25} x $0.25`],
      ['  10¢ Coins', `${closingDenominations.coin_10} x $0.10`],
      ['  5¢ Coins', `${closingDenominations.coin_5} x $0.05`],
      ['', ''],
      ['Net Cash Collected', netCashCollected.toFixed(2)],
      ['Expected Cash from Tickets', expectedCash.toFixed(2)],
      ['Cash Variance', cashVariance.toFixed(2)],
      ['Status', isBalanced ? 'BALANCED' : 'UNBALANCED'],
    ];

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
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
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  }

  function getMaxDate(): string {
    return new Date().toISOString().split('T')[0];
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

  return (
    <div className="max-w-7xl mx-auto">
      {!isOpeningCashRecorded && (
        <div className="mb-4 bg-amber-50 border-2 border-amber-400 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-amber-900 mb-1">Opening Cash Count Required</h3>
              <p className="text-sm text-amber-800 mb-2">
                You must count and record the opening cash before creating any sale tickets for today.
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsOpeningModalOpen(true)}
                className="bg-amber-600 hover:bg-amber-700"
              >
                <DollarSign className="w-4 h-4 mr-1" />
                Count Opening Cash Now
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
        <h2 className="text-base md:text-lg font-bold text-gray-900">End of Day - Cash Reconciliation</h2>
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <div className="flex items-center gap-2 flex-1 md:flex-initial">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              min={getMinDate()}
              max={getMaxDate()}
              className="px-2 py-2 md:py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 md:flex-initial min-h-[44px] md:min-h-0"
            />
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
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className={`bg-white rounded-lg shadow p-4 ${!isOpeningCashRecorded ? 'ring-2 ring-amber-400' : ''}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  <h3 className="text-sm font-semibold text-gray-900">Opening Cash</h3>
                </div>
                {isOpeningCashRecorded ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded">
                    <CheckCircle className="w-3 h-3" />
                    Recorded
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-1 rounded">
                    <AlertCircle className="w-3 h-3" />
                    Required
                  </span>
                )}
              </div>
              <div className="text-center py-3">
                <p className="text-xs text-gray-600 mb-1">Total Amount</p>
                <p className="text-2xl font-bold text-green-600 mb-3">${openingCashTotal.toFixed(2)}</p>
                <Button
                  variant={!isOpeningCashRecorded ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => setIsOpeningModalOpen(true)}
                  className={`w-full ${!isOpeningCashRecorded ? 'bg-amber-600 hover:bg-amber-700 animate-pulse' : ''}`}
                >
                  <Edit className="w-3 h-3 mr-1" />
                  {isOpeningCashRecorded ? 'Edit Count' : 'Count Bills'}
                </Button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-gray-900">Closing Cash</h3>
              </div>
              <div className="text-center py-3">
                <p className="text-xs text-gray-600 mb-1">Total Amount</p>
                <p className="text-2xl font-bold text-blue-600 mb-3">${closingCashTotal.toFixed(2)}</p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsClosingModalOpen(true)}
                  className="w-full"
                >
                  <Edit className="w-3 h-3 mr-1" />
                  Count Bills
                </Button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow mb-4">
            <div className="p-4">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Cash Reconciliation Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-xs text-green-700 mb-1">Opening Cash</p>
                  <p className="text-lg font-bold text-green-700">${openingCashTotal.toFixed(2)}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-xs text-blue-700 mb-1">Total Cash in Till</p>
                  <p className="text-lg font-bold text-blue-700">${closingCashTotal.toFixed(2)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-700 mb-1">Net Cash Collected</p>
                  <p className="text-lg font-bold text-gray-900">${netCashCollected.toFixed(2)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-700 mb-1">Expected from Tickets</p>
                  <p className="text-lg font-bold text-gray-900">${expectedCash.toFixed(2)}</p>
                </div>
              </div>

              <div className={`mt-4 p-4 rounded-lg border-2 ${
                isBalanced
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isBalanced ? (
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    ) : (
                      <AlertCircle className="w-6 h-6 text-red-600" />
                    )}
                    <div>
                      <p className={`text-sm font-semibold ${
                        isBalanced ? 'text-green-900' : 'text-red-900'
                      }`}>
                        {isBalanced ? 'Cash Balanced' : 'Cash Discrepancy Detected'}
                      </p>
                      <p className={`text-xs ${
                        isBalanced ? 'text-green-700' : 'text-red-700'
                      }`}>
                        Variance: ${cashVariance.toFixed(2)}
                        {!isBalanced && (cashVariance > 0 ? ' (Over)' : ' (Short)')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${
                      isBalanced ? 'text-green-600' : 'text-red-600'
                    }`}>
                      ${Math.abs(cashVariance).toFixed(2)}
                    </p>
                    <p className={`text-xs ${
                      isBalanced ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {isBalanced ? 'Perfect!' : cashVariance > 0 ? 'Overage' : 'Shortage'}
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
                  rows={3}
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
    </div>
  );
}
