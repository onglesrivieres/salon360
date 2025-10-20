import React, { useState, useEffect } from 'react';
import { Calendar, Download, Printer, Plus } from 'lucide-react';
import { supabase, Technician } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import { TicketEditor } from '../components/TicketEditor';
import { useAuth } from '../contexts/AuthContext';
import { Permissions } from '../lib/permissions';

interface TechnicianSummary {
  technician_id: string;
  technician_name: string;
  services_count: number;
  revenue: number;
  tips_customer_cash: number;
  tips_receptionist_cash: number;
  tips_customer_card: number;
  tips_receptionist_card: number;
  tips_total_cash: number;
  tips_total_card: number;
  tips_total: number;
  items: ServiceItemDetail[];
}

interface ServiceItemDetail {
  ticket_id: string;
  service_code: string;
  service_name: string;
  price: number;
  tip_customer_cash: number;
  tip_receptionist_cash: number;
  tip_customer_card: number;
  tip_receptionist_card: number;
  opened_at: string;
  closed_at: string | null;
}

interface EndOfDayPageProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
}

export function EndOfDayPage({ selectedDate, onDateChange }: EndOfDayPageProps) {
  const [summaries, setSummaries] = useState<TechnicianSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'summary' | 'detail'>('detail');
  const { showToast } = useToast();
  const { session, selectedStoreId } = useAuth();

  const [totals, setTotals] = useState({
    tickets: 0,
    revenue: 0,
    tips: 0,
  });

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null);

  useEffect(() => {
    fetchEODData();
  }, [selectedDate, selectedStoreId]);

  async function fetchEODData() {
    try {
      setLoading(true);

      const isTechnician = session?.role_permission === 'Technician';

      let query = supabase
        .from('sale_tickets')
        .select(
          `
          id,
          total,
          opened_at,
          closed_at,
          ticket_items${isTechnician ? '!inner' : ''} (
            id,
            service_id,
            employee_id,
            qty,
            price_each,
            addon_price,
            tip_customer,
            tip_receptionist,
            service:services(code, name),
            employee:employees(
              id,
              display_name
            )
          )
        `
        )
        .eq('ticket_date', selectedDate);

      if (selectedStoreId) {
        query = query.eq('store_id', selectedStoreId);
      }

      if (isTechnician && session?.employee_id) {
        query = query.eq('ticket_items.employee_id', session.employee_id);
      }

      const { data: tickets, error: ticketsError } = await query;

      if (ticketsError) throw ticketsError;

      const technicianMap = new Map<string, TechnicianSummary>();
      let totalRevenue = 0;
      let totalTips = 0;

      for (const ticket of tickets || []) {
        totalRevenue += ticket.total;

        for (const item of (ticket as any).ticket_items || []) {
          const itemRevenue = (parseFloat(item.qty) || 0) * (parseFloat(item.price_each) || 0) + (parseFloat(item.addon_price) || 0);
          const techId = item.employee_id;
          const technician = item.employee;

          if (!technician) continue;

          if (!technicianMap.has(techId)) {
            technicianMap.set(techId, {
              technician_id: techId,
              technician_name: technician.display_name,
              services_count: 0,
              revenue: 0,
              tips_customer_cash: 0,
              tips_receptionist_cash: 0,
              tips_customer_card: 0,
              tips_receptionist_card: 0,
              tips_total_cash: 0,
              tips_total_card: 0,
              tips_total: 0,
              items: [],
            });
          }

          const summary = technicianMap.get(techId)!;
          summary.services_count += 1;
          summary.revenue += itemRevenue;

          const tipCustomerCash = item.tip_customer || 0;
          const tipReceptionistCash = item.tip_receptionist || 0;
          const tipCustomerCard = item.tip_customer_card || 0;
          const tipReceptionistCard = item.tip_receptionist_card || 0;

          summary.tips_customer_cash += tipCustomerCash;
          summary.tips_receptionist_cash += tipReceptionistCash;
          summary.tips_customer_card += tipCustomerCard;
          summary.tips_receptionist_card += tipReceptionistCard;
          summary.tips_total_cash += tipCustomerCash + tipReceptionistCash;
          summary.tips_total_card += tipCustomerCard + tipReceptionistCard;
          summary.tips_total += tipCustomerCash + tipReceptionistCash + tipCustomerCard + tipReceptionistCard;

          totalTips += tipCustomerCash + tipReceptionistCash + tipCustomerCard + tipReceptionistCard;

          summary.items.push({
            ticket_id: ticket.id,
            service_code: item.service?.code || '',
            service_name: item.service?.name || '',
            price: itemRevenue,
            tip_customer_cash: tipCustomerCash,
            tip_receptionist_cash: tipReceptionistCash,
            tip_customer_card: tipCustomerCard,
            tip_receptionist_card: tipReceptionistCard,
            opened_at: (ticket as any).opened_at,
            closed_at: ticket.closed_at,
          });
        }
      }

      let filteredSummaries = Array.from(technicianMap.values());

      if (session?.role_permission === 'Technician') {
        filteredSummaries = filteredSummaries.filter(
          summary => summary.technician_id === session.employee_id
        );

        const technicianTotals = filteredSummaries[0];
        if (technicianTotals) {
          totalRevenue = technicianTotals.revenue;
          totalTips = technicianTotals.tips_total;
        } else {
          totalRevenue = 0;
          totalTips = 0;
        }
      }

      setSummaries(filteredSummaries);
      setTotals({
        tickets: tickets?.length || 0,
        revenue: totalRevenue,
        tips: totalTips,
      });
    } catch (error) {
      showToast('Failed to load EOD data', 'error');
    } finally {
      setLoading(false);
    }
  }

  function exportCSV() {
    const headers = [
      'Technician',
      'Services Done',
      'Revenue',
      'Tip Customer (Cash)',
      'Tip Receptionist (Cash)',
      'Total Tips (Cash)',
      'Tip Customer (Card)',
      'Tip Receptionist (Card)',
      'Total Tips (Card)',
      'Tips Grand Total',
    ];

    const rows = summaries.map((s) => [
      s.technician_name,
      s.services_count.toString(),
      s.revenue.toFixed(2),
      s.tips_customer_cash.toFixed(2),
      s.tips_receptionist_cash.toFixed(2),
      s.tips_total_cash.toFixed(2),
      s.tips_customer_card.toFixed(2),
      s.tips_receptionist_card.toFixed(2),
      s.tips_total_card.toFixed(2),
      s.tips_total.toFixed(2),
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eod-report-${selectedDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    showToast('Report exported successfully', 'success');
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
        <h2 className="text-base md:text-lg font-bold text-gray-900">Report</h2>
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <div className="flex items-center gap-1 flex-1 md:flex-initial">
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
        <div className="p-2 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">Technician Summary</h3>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={viewMode === 'summary' ? 'primary' : 'ghost'}
              onClick={() => setViewMode('summary')}
            >
              Summary
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'detail' ? 'primary' : 'ghost'}
              onClick={() => setViewMode('detail')}
            >
              Detail Grid
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-sm text-gray-500">Loading...</div>
          </div>
        ) : summaries.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">No tickets for this date</p>
          </div>
        ) : viewMode === 'summary' ? (
          <div className="p-2 md:p-3 space-y-2 md:space-y-3">
            {summaries.map((summary) => (
              <div key={summary.technician_id} className="border border-gray-200 rounded-lg p-3 bg-white">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="text-base font-bold text-gray-900 mb-0.5">
                      {summary.technician_name}
                    </h4>
                    <p className="text-xs text-gray-500">
                      {summary.services_count} {summary.services_count === 1 ? 'service' : 'services'} completed
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 mb-0.5">Total Tips</p>
                    <p className="text-lg font-bold text-blue-600">
                      ${summary.tips_total.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="mb-2">
                  <p className="text-xs font-medium text-gray-700 mb-1">Service Records:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {summary.items.map((item, index) => (
                      <div
                        key={index}
                        className="inline-flex items-center gap-1.5 px-2 py-1 bg-gray-100 rounded-lg text-xs"
                      >
                        <span className="font-medium text-gray-900 text-xs">{item.service_code}</span>
                        <span className="text-gray-400 text-xs">•</span>
                        <span className="text-gray-600 text-xs">${item.price.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200">
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Tips Cash</p>
                    <p className="text-sm font-semibold text-green-600">
                      ${summary.tips_total_cash.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-400">
                      Given: ${summary.tips_customer_cash.toFixed(2)} | Paired: ${summary.tips_receptionist_cash.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Tips Card</p>
                    <p className="text-sm font-semibold text-blue-600">
                      ${summary.tips_total_card.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-400">
                      Given: ${summary.tips_customer_card.toFixed(2)} | Paired: ${summary.tips_receptionist_card.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-1 md:p-2 overflow-x-auto">
            <div className="flex gap-1 md:gap-1.5 min-w-max">
              {summaries.map((summary) => (
                <div
                  key={summary.technician_id}
                  className="flex-shrink-0 w-[130px] md:w-[9.5%] md:min-w-[90px] border border-gray-200 rounded-md bg-white shadow-sm"
                >
                  <div className="bg-gray-50 border-b border-gray-200 px-1.5 py-1 rounded-t-md">
                    <h4 className="text-[10px] font-semibold text-gray-900 leading-tight truncate">
                      {summary.technician_name}
                    </h4>
                    <p className="text-[9px] text-gray-500">
                      {summary.services_count} service{summary.services_count !== 1 ? 's' : ''}
                    </p>
                  </div>

                  <div className="p-1">
                    <div className="mb-1 pb-1 border-b border-gray-200 space-y-0.5">
                      <p className="text-[9px] font-medium text-gray-500 uppercase tracking-wide">
                        Summary
                      </p>
                      <div className="space-y-0.5">
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] text-gray-600">Cash</span>
                          <span className="text-[9px] font-semibold text-green-600">
                            ${summary.tips_total_cash.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] text-gray-600">Card</span>
                          <span className="text-[9px] font-semibold text-blue-600">
                            ${summary.tips_total_card.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center pt-0.5 border-t border-gray-200">
                          <span className="text-[9px] font-medium text-gray-900">Total</span>
                          <span className="text-[10px] font-bold text-gray-900">
                            ${summary.tips_total.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <p className="text-[9px] font-medium text-gray-500 uppercase tracking-wide mb-0.5">
                        Sale Tickets
                      </p>
                      <div className="space-y-1 max-h-72 overflow-y-auto">
                        {summary.items.map((item, index) => {
                          const openTime = new Date(item.opened_at).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                          });
                          const openedMs = new Date(item.opened_at).getTime();
                          const closedMs = item.closed_at ? new Date(item.closed_at).getTime() : Date.now();
                          const durationMinutes = Math.round((closedMs - openedMs) / 60000);

                          const isOpen = !item.closed_at;

                          return (
                            <div
                              key={index}
                              className={`border rounded p-1 transition-colors cursor-pointer ${
                                isOpen
                                  ? 'border-orange-300 bg-orange-50 hover:bg-orange-100'
                                  : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                              }`}
                              onClick={() => openEditor(item.ticket_id)}
                            >
                              <div className="mb-0.5">
                                <div className={`text-[8px] truncate mb-0.5 ${
                                  isOpen ? 'text-red-600 font-semibold' : 'text-gray-500'
                                }`}>
                                  {openTime.replace(/\s/g, '')} ({durationMinutes}m)
                                </div>
                                <div className="text-[9px] font-semibold text-gray-900">
                                  {item.service_code}
                                </div>
                              </div>
                              <div className="space-y-0">
                                <div className="flex justify-between items-center">
                                  <span className="text-[8px] text-gray-600">Bill</span>
                                  <span className="text-[8px] font-medium text-gray-900">
                                    ${item.price.toFixed(2)}
                                  </span>
                                </div>
                                {(item.tip_customer_cash > 0 || item.tip_receptionist_cash > 0) && (
                                  <div className="flex justify-between items-center">
                                    <span className="text-[8px] text-gray-600">Cash</span>
                                    <span className="text-[8px] font-semibold text-green-600">
                                      ${(item.tip_customer_cash + item.tip_receptionist_cash).toFixed(2)}
                                    </span>
                                  </div>
                                )}
                                {(item.tip_customer_card > 0 || item.tip_receptionist_card > 0) && (
                                  <div className="flex justify-between items-center">
                                    <span className="text-[8px] text-gray-600">Card</span>
                                    <span className="text-[8px] font-semibold text-blue-600">
                                      ${(item.tip_customer_card + item.tip_receptionist_card).toFixed(2)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
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
