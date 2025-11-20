import React, { useState, useEffect } from 'react';
import { Calendar, Download, Printer, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import { TicketEditor } from '../components/TicketEditor';
import { useAuth } from '../contexts/AuthContext';
import { Permissions } from '../lib/permissions';

interface PaymentSummary {
  payment_method: string;
  total_amount: number;
  ticket_count: number;
}

interface EndOfDayPageProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
}

export function EndOfDayPage({ selectedDate, onDateChange }: EndOfDayPageProps) {
  const [paymentSummaries, setPaymentSummaries] = useState<PaymentSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();
  const { session, selectedStoreId, t } = useAuth();

  const [totals, setTotals] = useState({
    total_collected: 0,
    cash_collected: 0,
    card_collected: 0,
    gift_card_collected: 0,
    total_tickets: 0,
  });

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null);

  useEffect(() => {
    fetchEODData();
  }, [selectedDate, selectedStoreId]);

  async function fetchEODData() {
    try {
      setLoading(true);

      let query = supabase
        .from('sale_tickets')
        .select('id, total, payment_method, payment_cash, payment_card, payment_gift_card')
        .eq('ticket_date', selectedDate)
        .not('closed_at', 'is', null);

      if (selectedStoreId) {
        query = query.eq('store_id', selectedStoreId);
      }

      const { data: tickets, error: ticketsError } = await query;

      if (ticketsError) throw ticketsError;

      const paymentMap = new Map<string, PaymentSummary>();
      let totalCollected = 0;
      let cashCollected = 0;
      let cardCollected = 0;
      let giftCardCollected = 0;

      for (const ticket of tickets || []) {
        const paymentMethod = ticket.payment_method || 'Unknown';
        const ticketTotal = parseFloat(ticket.total) || 0;
        const ticketCash = parseFloat(ticket.payment_cash) || 0;
        const ticketCard = parseFloat(ticket.payment_card) || 0;
        const ticketGiftCard = parseFloat(ticket.payment_gift_card) || 0;

        totalCollected += ticketTotal;
        cashCollected += ticketCash;
        cardCollected += ticketCard;
        giftCardCollected += ticketGiftCard;

        if (!paymentMap.has(paymentMethod)) {
          paymentMap.set(paymentMethod, {
            payment_method: paymentMethod,
            total_amount: 0,
            ticket_count: 0,
          });
        }

        const summary = paymentMap.get(paymentMethod)!;
        summary.total_amount += ticketTotal;
        summary.ticket_count += 1;
      }

      const sortedSummaries = Array.from(paymentMap.values()).sort((a, b) =>
        a.payment_method.localeCompare(b.payment_method)
      );

      setPaymentSummaries(sortedSummaries);
      setTotals({
        total_collected: totalCollected,
        cash_collected: cashCollected,
        card_collected: cardCollected,
        gift_card_collected: giftCardCollected,
        total_tickets: tickets?.length || 0,
      });
    } catch (error) {
      showToast('Failed to load EOD data', 'error');
    } finally {
      setLoading(false);
    }
  }

  function exportCSV() {
    const headers = [
      'Payment Method',
      'Tickets',
      'Amount Collected',
    ];

    const rows = paymentSummaries.map((s) => [
      s.payment_method,
      s.ticket_count.toString(),
      s.total_amount.toFixed(2),
    ]);

    const totalRow = [
      'TOTAL',
      totals.total_tickets.toString(),
      totals.total_collected.toFixed(2),
    ];

    const detailRows = [
      ['', '', ''],
      ['Payment Breakdown', '', ''],
      ['Cash', '', totals.cash_collected.toFixed(2)],
      ['Card', '', totals.card_collected.toFixed(2)],
      ['Gift Card', '', totals.gift_card_collected.toFixed(2)],
    ];

    const csv = [headers, ...rows, totalRow, ...detailRows].map((row) => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eod-report-${selectedDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    showToast('End of Day Report exported successfully', 'success');
  }

  function handlePrint() {
    window.print();
    showToast('Opening print dialog', 'success');
  }

  function getMinDate(): string {
    const date = new Date();
    date.setDate(date.getDate() - 7);
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
    fetchEODData();
  }

  function openNewTicket() {
    setEditingTicketId(null);
    setIsEditorOpen(true);
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
        <h2 className="text-base md:text-lg font-bold text-gray-900">End of Day</h2>
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

      <div className="bg-white rounded-lg shadow mb-3">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900 mb-3">Collection Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-600 mb-1">Total Tickets</p>
              <p className="text-lg font-bold text-gray-900">{totals.total_tickets}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <p className="text-xs text-green-700 mb-1">Cash Collected</p>
              <p className="text-lg font-bold text-green-700">${totals.cash_collected.toFixed(2)}</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-xs text-blue-700 mb-1">Card Collected</p>
              <p className="text-lg font-bold text-blue-700">${totals.card_collected.toFixed(2)}</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-3">
              <p className="text-xs text-purple-700 mb-1">Gift Card</p>
              <p className="text-lg font-bold text-purple-700">${totals.gift_card_collected.toFixed(2)}</p>
            </div>
          </div>
          <div className="mt-4 bg-gray-900 rounded-lg p-4">
            <p className="text-xs text-gray-300 mb-1">Total Collected</p>
            <p className="text-2xl font-bold text-white">${totals.total_collected.toFixed(2)}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-sm text-gray-500">Loading...</div>
          </div>
        ) : paymentSummaries.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">No tickets for this date</p>
          </div>
        ) : (
          <div className="p-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Payment Method Breakdown</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Payment Method
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tickets
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount Collected
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paymentSummaries.map((summary, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {summary.payment_method}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                        {summary.ticket_count}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900">
                        ${summary.total_amount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {isEditorOpen && (
        <TicketEditor
          ticketId={editingTicketId}
          onClose={closeEditor}
          selectedDate={selectedDate}
        />
      )}
    </div>
  );
}
