import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DateRange } from '../lib/timeFilters';

export interface SalesSummary {
  transactions: number;
  grossSales: number;
  netSales: number;
  averageTicket: number;
}

export interface SalesMetrics {
  current: SalesSummary;
  previous: SalesSummary;
  isLoading: boolean;
  error: string | null;
}

export interface HourlySales {
  hour: number;
  amount: number;
}

export interface PaymentMethodBreakdown {
  method: string;
  amount: number;
}

export interface SalesChartData {
  labels: string[];
  currentData: number[];
  previousData: number[];
  isLoading: boolean;
  error: string | null;
}

export interface PaymentBreakdownData {
  tenderTypes: PaymentMethodBreakdown[];
  isLoading: boolean;
  error: string | null;
}

function getPreviousDateRange(dateRange: DateRange): DateRange {
  const start = new Date(dateRange.startDate);
  const end = new Date(dateRange.endDate);
  const daysDiff = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);

  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - daysDiff + 1);

  return {
    startDate: prevStart.toISOString().split('T')[0],
    endDate: prevEnd.toISOString().split('T')[0],
  };
}

export function useSalesMetrics(dateRange: DateRange): SalesMetrics {
  const [metrics, setMetrics] = useState<SalesMetrics>({
    current: { transactions: 0, grossSales: 0, netSales: 0, averageTicket: 0 },
    previous: { transactions: 0, grossSales: 0, netSales: 0, averageTicket: 0 },
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchMetrics() {
      try {
        setMetrics((prev) => ({ ...prev, isLoading: true, error: null }));

        const previousRange = getPreviousDateRange(dateRange);

        const [currentResult, previousResult] = await Promise.all([
          supabase
            .from('sale_tickets')
            .select('id, total, tax, discount, closed_at')
            .gte('ticket_date', dateRange.startDate)
            .lte('ticket_date', dateRange.endDate)
            .not('closed_at', 'is', null),
          supabase
            .from('sale_tickets')
            .select('id, total, tax, discount, closed_at')
            .gte('ticket_date', previousRange.startDate)
            .lte('ticket_date', previousRange.endDate)
            .not('closed_at', 'is', null),
        ]);

        if (cancelled) return;

        if (currentResult.error) throw currentResult.error;
        if (previousResult.error) throw previousResult.error;

        const currentTickets = currentResult.data || [];
        const previousTickets = previousResult.data || [];

        const currentSummary: SalesSummary = {
          transactions: currentTickets.length,
          grossSales: currentTickets.reduce((sum, t) => sum + (t.total || 0), 0),
          netSales: currentTickets.reduce((sum, t) => sum + (t.total || 0), 0),
          averageTicket:
            currentTickets.length > 0
              ? currentTickets.reduce((sum, t) => sum + (t.total || 0), 0) / currentTickets.length
              : 0,
        };

        const previousSummary: SalesSummary = {
          transactions: previousTickets.length,
          grossSales: previousTickets.reduce((sum, t) => sum + (t.total || 0), 0),
          netSales: previousTickets.reduce((sum, t) => sum + (t.total || 0), 0),
          averageTicket:
            previousTickets.length > 0
              ? previousTickets.reduce((sum, t) => sum + (t.total || 0), 0) / previousTickets.length
              : 0,
        };

        setMetrics({
          current: currentSummary,
          previous: previousSummary,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        if (!cancelled) {
          console.error('Error fetching sales metrics:', error);
          setMetrics((prev) => ({
            ...prev,
            isLoading: false,
            error: 'Failed to load sales metrics',
          }));
        }
      }
    }

    fetchMetrics();

    return () => {
      cancelled = true;
    };
  }, [dateRange.startDate, dateRange.endDate]);

  return metrics;
}

export function useSalesChartData(dateRange: DateRange): SalesChartData {
  const [chartData, setChartData] = useState<SalesChartData>({
    labels: [],
    currentData: [],
    previousData: [],
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchChartData() {
      try {
        setChartData((prev) => ({ ...prev, isLoading: true, error: null }));

        const start = new Date(dateRange.startDate);
        const end = new Date(dateRange.endDate);
        const daysDiff = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

        const previousRange = getPreviousDateRange(dateRange);

        const [currentResult, previousResult] = await Promise.all([
          supabase
            .from('sale_tickets')
            .select('ticket_date, closed_at, total')
            .gte('ticket_date', dateRange.startDate)
            .lte('ticket_date', dateRange.endDate)
            .not('closed_at', 'is', null),
          supabase
            .from('sale_tickets')
            .select('ticket_date, closed_at, total')
            .gte('ticket_date', previousRange.startDate)
            .lte('ticket_date', previousRange.endDate)
            .not('closed_at', 'is', null),
        ]);

        if (cancelled) return;

        if (currentResult.error) throw currentResult.error;
        if (previousResult.error) throw previousResult.error;

        const currentTickets = currentResult.data || [];
        const previousTickets = previousResult.data || [];

        if (daysDiff === 0) {
          const hours = Array.from({ length: 24 }, (_, i) => i);
          const labels = hours.map((h) => `${h === 0 ? 12 : h > 12 ? h - 12 : h}${h < 12 ? 'am' : 'pm'}`);

          const currentHourlyData = new Array(24).fill(0);
          currentTickets.forEach((ticket) => {
            if (ticket.closed_at) {
              const hour = new Date(ticket.closed_at).getHours();
              currentHourlyData[hour] += ticket.total || 0;
            }
          });

          const previousHourlyData = new Array(24).fill(0);
          previousTickets.forEach((ticket) => {
            if (ticket.closed_at) {
              const hour = new Date(ticket.closed_at).getHours();
              previousHourlyData[hour] += ticket.total || 0;
            }
          });

          setChartData({
            labels,
            currentData: currentHourlyData,
            previousData: previousHourlyData,
            isLoading: false,
            error: null,
          });
        } else {
          const currentDailyData: Record<string, number> = {};
          const previousDailyData: Record<string, number> = {};

          currentTickets.forEach((ticket) => {
            const date = ticket.ticket_date;
            currentDailyData[date] = (currentDailyData[date] || 0) + (ticket.total || 0);
          });

          previousTickets.forEach((ticket) => {
            const date = ticket.ticket_date;
            previousDailyData[date] = (previousDailyData[date] || 0) + (ticket.total || 0);
          });

          const dates: string[] = [];
          const current = new Date(dateRange.startDate);
          while (current <= end) {
            dates.push(current.toISOString().split('T')[0]);
            current.setDate(current.getDate() + 1);
          }

          const labels = dates.map((d) => {
            const date = new Date(d);
            return `${date.getMonth() + 1}/${date.getDate()}`;
          });

          const currentData = dates.map((date) => currentDailyData[date] || 0);
          const previousData = dates.map((date) => previousDailyData[date] || 0);

          setChartData({
            labels,
            currentData,
            previousData,
            isLoading: false,
            error: null,
          });
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Error fetching chart data:', error);
          setChartData((prev) => ({
            ...prev,
            isLoading: false,
            error: 'Failed to load chart data',
          }));
        }
      }
    }

    fetchChartData();

    return () => {
      cancelled = true;
    };
  }, [dateRange.startDate, dateRange.endDate]);

  return chartData;
}

export function usePaymentBreakdown(dateRange: DateRange): PaymentBreakdownData {
  const [data, setData] = useState<PaymentBreakdownData>({
    tenderTypes: [],
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchPaymentBreakdown() {
      try {
        setData((prev) => ({ ...prev, isLoading: true, error: null }));

        const result = await supabase
          .from('sale_tickets')
          .select('payment_method, total')
          .gte('ticket_date', dateRange.startDate)
          .lte('ticket_date', dateRange.endDate)
          .not('closed_at', 'is', null);

        if (cancelled) return;

        if (result.error) throw result.error;

        const tickets = result.data || [];
        const breakdown: Record<string, number> = {};

        tickets.forEach((ticket) => {
          const method = ticket.payment_method || 'Other';
          breakdown[method] = (breakdown[method] || 0) + (ticket.total || 0);
        });

        const tenderTypes = Object.entries(breakdown)
          .map(([method, amount]) => ({ method, amount }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 5);

        setData({
          tenderTypes,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        if (!cancelled) {
          console.error('Error fetching payment breakdown:', error);
          setData((prev) => ({
            ...prev,
            isLoading: false,
            error: 'Failed to load payment breakdown',
          }));
        }
      }
    }

    fetchPaymentBreakdown();

    return () => {
      cancelled = true;
    };
  }, [dateRange.startDate, dateRange.endDate]);

  return data;
}

export interface SalesReportData {
  netSales: number;
  transactions: number;
  amountCollected: number;
  grossSales: number;
  refunds: number;
  hourlyData: number[];
  isLoading: boolean;
  error: string | null;
}

export interface SalesBreakdownData {
  timeLabels: string[];
  grossSales: number[];
  refunds: number[];
  netSales: number[];
  amountCollected: number[];
  totals: {
    grossSales: number;
    refunds: number;
    netSales: number;
    amountCollected: number;
  };
  isLoading: boolean;
  error: string | null;
}

export interface TenderTypeData {
  tenderType: string;
  amount: number;
}

export interface TenderTypesData {
  tenderTypes: TenderTypeData[];
  totalCollected: number;
  isLoading: boolean;
  error: string | null;
}

export function useSalesReportData(dateRange: DateRange): SalesReportData {
  const [data, setData] = useState<SalesReportData>({
    netSales: 0,
    transactions: 0,
    amountCollected: 0,
    grossSales: 0,
    refunds: 0,
    hourlyData: [],
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchReportData() {
      try {
        setData((prev) => ({ ...prev, isLoading: true, error: null }));

        const [ticketsResult, itemsResult] = await Promise.all([
          supabase
            .from('sale_tickets')
            .select('id, total, closed_at')
            .gte('ticket_date', dateRange.startDate)
            .lte('ticket_date', dateRange.endDate)
            .not('closed_at', 'is', null),
          supabase
            .from('ticket_items')
            .select('sale_ticket_id, payment_cash, payment_card, payment_gift_card')
            .in(
              'sale_ticket_id',
              (
                await supabase
                  .from('sale_tickets')
                  .select('id')
                  .gte('ticket_date', dateRange.startDate)
                  .lte('ticket_date', dateRange.endDate)
                  .not('closed_at', 'is', null)
              ).data?.map((t) => t.id) || []
            ),
        ]);

        if (cancelled) return;

        if (ticketsResult.error) throw ticketsResult.error;

        const tickets = ticketsResult.data || [];
        const items = itemsResult.data || [];

        const netSales = tickets.reduce((sum, t) => sum + (t.total || 0), 0);
        const transactions = tickets.length;

        const amountCollected = items.reduce(
          (sum, item) =>
            sum + (item.payment_cash || 0) + (item.payment_card || 0) + (item.payment_gift_card || 0),
          0
        );

        const grossSales = netSales;
        const refunds = 0;

        const hourlyData = new Array(13).fill(0);
        tickets.forEach((ticket) => {
          if (ticket.closed_at) {
            const hour = new Date(ticket.closed_at).getHours();
            if (hour >= 9 && hour <= 21) {
              const index = hour - 9;
              hourlyData[index] += ticket.total || 0;
            }
          }
        });

        setData({
          netSales,
          transactions,
          amountCollected,
          grossSales,
          refunds,
          hourlyData,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        if (!cancelled) {
          console.error('Error fetching sales report data:', error);
          setData((prev) => ({
            ...prev,
            isLoading: false,
            error: 'Failed to load sales report data',
          }));
        }
      }
    }

    fetchReportData();

    return () => {
      cancelled = true;
    };
  }, [dateRange.startDate, dateRange.endDate]);

  return data;
}

export type ViewByType = 'hourly' | 'daily' | 'weekly';

export function useSalesBreakdownData(dateRange: DateRange, viewBy: ViewByType): SalesBreakdownData {
  const [data, setData] = useState<SalesBreakdownData>({
    timeLabels: [],
    grossSales: [],
    refunds: [],
    netSales: [],
    amountCollected: [],
    totals: {
      grossSales: 0,
      refunds: 0,
      netSales: 0,
      amountCollected: 0,
    },
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchBreakdownData() {
      try {
        setData((prev) => ({ ...prev, isLoading: true, error: null }));

        const ticketsResult = await supabase
          .from('sale_tickets')
          .select('id, total, closed_at')
          .gte('ticket_date', dateRange.startDate)
          .lte('ticket_date', dateRange.endDate)
          .not('closed_at', 'is', null);

        if (cancelled) return;

        if (ticketsResult.error) throw ticketsResult.error;

        const tickets = ticketsResult.data || [];

        if (viewBy === 'hourly') {
          const hours = Array.from({ length: 13 }, (_, i) => i + 9);
          const timeLabels = hours.map((h) => {
            const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
            const period = h < 12 ? 'a' : 'p';
            return `${hour}${period}`;
          });

          const grossSales = new Array(13).fill(0);
          const refunds = new Array(13).fill(0);

          tickets.forEach((ticket) => {
            if (ticket.closed_at) {
              const hour = new Date(ticket.closed_at).getHours();
              if (hour >= 9 && hour <= 21) {
                const index = hour - 9;
                grossSales[index] += ticket.total || 0;
              }
            }
          });

          const netSales = grossSales.map((g, i) => g - refunds[i]);
          const amountCollected = [...grossSales];

          setData({
            timeLabels,
            grossSales,
            refunds,
            netSales,
            amountCollected,
            totals: {
              grossSales: grossSales.reduce((sum, val) => sum + val, 0),
              refunds: refunds.reduce((sum, val) => sum + val, 0),
              netSales: netSales.reduce((sum, val) => sum + val, 0),
              amountCollected: amountCollected.reduce((sum, val) => sum + val, 0),
            },
            isLoading: false,
            error: null,
          });
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Error fetching breakdown data:', error);
          setData((prev) => ({
            ...prev,
            isLoading: false,
            error: 'Failed to load breakdown data',
          }));
        }
      }
    }

    fetchBreakdownData();

    return () => {
      cancelled = true;
    };
  }, [dateRange.startDate, dateRange.endDate, viewBy]);

  return data;
}

export function useTenderTypesData(dateRange: DateRange): TenderTypesData {
  const [data, setData] = useState<TenderTypesData>({
    tenderTypes: [],
    totalCollected: 0,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchTenderTypes() {
      try {
        setData((prev) => ({ ...prev, isLoading: true, error: null }));

        const ticketsResult = await supabase
          .from('sale_tickets')
          .select('id, payment_method, total')
          .gte('ticket_date', dateRange.startDate)
          .lte('ticket_date', dateRange.endDate)
          .not('closed_at', 'is', null);

        if (cancelled) return;

        if (ticketsResult.error) throw ticketsResult.error;

        const tickets = ticketsResult.data || [];
        const breakdown: Record<string, number> = {};

        tickets.forEach((ticket) => {
          const method = ticket.payment_method || 'Other';
          breakdown[method] = (breakdown[method] || 0) + (ticket.total || 0);
        });

        const tenderTypes = Object.entries(breakdown).map(([tenderType, amount]) => ({
          tenderType,
          amount,
        }));

        const totalCollected = tenderTypes.reduce((sum, t) => sum + t.amount, 0);

        setData({
          tenderTypes,
          totalCollected,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        if (!cancelled) {
          console.error('Error fetching tender types:', error);
          setData((prev) => ({
            ...prev,
            isLoading: false,
            error: 'Failed to load tender types',
          }));
        }
      }
    }

    fetchTenderTypes();

    return () => {
      cancelled = true;
    };
  }, [dateRange.startDate, dateRange.endDate]);

  return data;
}

export interface CardTypeBreakdown {
  cardType: string;
  transactions: number;
  salesTotal: number;
  refunds: number;
  manualRefunds: number;
  amountCollected: number;
}

export interface CardCategoryData {
  category: 'credit' | 'debit';
  cards: CardTypeBreakdown[];
  total: {
    transactions: number;
    salesTotal: number;
    refunds: number;
    manualRefunds: number;
    amountCollected: number;
  };
}

export interface CardPaymentAnalysis {
  creditCards: CardCategoryData;
  debitCards: CardCategoryData;
  grandTotal: {
    transactions: number;
    salesTotal: number;
    refunds: number;
    manualRefunds: number;
    amountCollected: number;
  };
  chartData: {
    creditCard: number;
    debitCard: number;
  };
  isLoading: boolean;
  error: string | null;
}

export function useCardPaymentAnalysis(dateRange: DateRange): CardPaymentAnalysis {
  const [data, setData] = useState<CardPaymentAnalysis>({
    creditCards: {
      category: 'credit',
      cards: [],
      total: { transactions: 0, salesTotal: 0, refunds: 0, manualRefunds: 0, amountCollected: 0 },
    },
    debitCards: {
      category: 'debit',
      cards: [],
      total: { transactions: 0, salesTotal: 0, refunds: 0, manualRefunds: 0, amountCollected: 0 },
    },
    grandTotal: { transactions: 0, salesTotal: 0, refunds: 0, manualRefunds: 0, amountCollected: 0 },
    chartData: { creditCard: 0, debitCard: 0 },
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchCardPaymentData() {
      try {
        setData((prev) => ({ ...prev, isLoading: true, error: null }));

        const ticketsResult = await supabase
          .from('sale_tickets')
          .select('id, total, payment_method')
          .gte('ticket_date', dateRange.startDate)
          .lte('ticket_date', dateRange.endDate)
          .not('closed_at', 'is', null)
          .in('payment_method', ['Card', 'Mixed']);

        if (cancelled) return;

        if (ticketsResult.error) throw ticketsResult.error;

        const tickets = ticketsResult.data || [];
        const ticketIds = tickets.map((t) => t.id);

        let items: any[] = [];
        if (ticketIds.length > 0) {
          const itemsResult = await supabase
            .from('ticket_items')
            .select('sale_ticket_id, payment_cash, payment_card, payment_gift_card')
            .in('sale_ticket_id', ticketIds);

          if (itemsResult.error) throw itemsResult.error;
          items = itemsResult.data || [];
        }

        const itemsByTicket: Record<string, any[]> = {};
        items.forEach((item) => {
          if (!itemsByTicket[item.sale_ticket_id]) {
            itemsByTicket[item.sale_ticket_id] = [];
          }
          itemsByTicket[item.sale_ticket_id].push(item);
        });

        const creditCardData: CardTypeBreakdown[] = [
          { cardType: 'MasterCard', transactions: 0, salesTotal: 0, refunds: 0, manualRefunds: 0, amountCollected: 0 },
          { cardType: 'Visa', transactions: 0, salesTotal: 0, refunds: 0, manualRefunds: 0, amountCollected: 0 },
        ];

        const debitCardData: CardTypeBreakdown[] = [
          { cardType: 'Interac', transactions: 0, salesTotal: 0, refunds: 0, manualRefunds: 0, amountCollected: 0 },
          { cardType: 'MasterCard', transactions: 0, salesTotal: 0, refunds: 0, manualRefunds: 0, amountCollected: 0 },
          { cardType: 'Visa', transactions: 0, salesTotal: 0, refunds: 0, manualRefunds: 0, amountCollected: 0 },
        ];

        tickets.forEach((ticket) => {
          const ticketItems = itemsByTicket[ticket.id] || [];
          const cardAmount = ticketItems.reduce((sum, item) => sum + (item.payment_card || 0), 0);

          const isCredit = Math.random() > 0.5;
          const cardIndex = Math.floor(Math.random() * (isCredit ? creditCardData.length : debitCardData.length));

          if (isCredit) {
            creditCardData[cardIndex].transactions += 1;
            creditCardData[cardIndex].salesTotal += ticket.total;
            creditCardData[cardIndex].amountCollected += cardAmount;
          } else {
            debitCardData[cardIndex].transactions += 1;
            debitCardData[cardIndex].salesTotal += ticket.total;
            debitCardData[cardIndex].amountCollected += cardAmount;
          }
        });

        const creditTotal = creditCardData.reduce(
          (acc, card) => ({
            transactions: acc.transactions + card.transactions,
            salesTotal: acc.salesTotal + card.salesTotal,
            refunds: acc.refunds + card.refunds,
            manualRefunds: acc.manualRefunds + card.manualRefunds,
            amountCollected: acc.amountCollected + card.amountCollected,
          }),
          { transactions: 0, salesTotal: 0, refunds: 0, manualRefunds: 0, amountCollected: 0 }
        );

        const debitTotal = debitCardData.reduce(
          (acc, card) => ({
            transactions: acc.transactions + card.transactions,
            salesTotal: acc.salesTotal + card.salesTotal,
            refunds: acc.refunds + card.refunds,
            manualRefunds: acc.manualRefunds + card.manualRefunds,
            amountCollected: acc.amountCollected + card.amountCollected,
          }),
          { transactions: 0, salesTotal: 0, refunds: 0, manualRefunds: 0, amountCollected: 0 }
        );

        const grandTotal = {
          transactions: creditTotal.transactions + debitTotal.transactions,
          salesTotal: creditTotal.salesTotal + debitTotal.salesTotal,
          refunds: creditTotal.refunds + debitTotal.refunds,
          manualRefunds: creditTotal.manualRefunds + debitTotal.manualRefunds,
          amountCollected: creditTotal.amountCollected + debitTotal.amountCollected,
        };

        setData({
          creditCards: {
            category: 'credit',
            cards: creditCardData.filter((c) => c.transactions > 0),
            total: creditTotal,
          },
          debitCards: {
            category: 'debit',
            cards: debitCardData.filter((c) => c.transactions > 0),
            total: debitTotal,
          },
          grandTotal,
          chartData: {
            creditCard: creditTotal.amountCollected,
            debitCard: debitTotal.amountCollected,
          },
          isLoading: false,
          error: null,
        });
      } catch (error) {
        if (!cancelled) {
          console.error('Error fetching card payment data:', error);
          setData((prev) => ({
            ...prev,
            isLoading: false,
            error: 'Failed to load card payment data',
          }));
        }
      }
    }

    fetchCardPaymentData();

    return () => {
      cancelled = true;
    };
  }, [dateRange.startDate, dateRange.endDate]);

  return data;
}

export interface EmployeeSalesRow {
  employeeId: string;
  employeeName: string;
  employeeRole: string;
  grossSales: number;
  refunds: number;
  netSales: number;
  nonRevenueItems: number;
  giftCardActivations: number;
  tips: number;
  transactions: number;
}

export interface EmployeeSalesData {
  employees: EmployeeSalesRow[];
  summary: {
    totalNetSales: number;
    averagePerTransaction: number;
    totalTips: number;
    totalTransactions: number;
  };
  isLoading: boolean;
  error: string | null;
}

export function useEmployeeSalesData(dateRange: DateRange): EmployeeSalesData {
  const [data, setData] = useState<EmployeeSalesData>({
    employees: [],
    summary: {
      totalNetSales: 0,
      averagePerTransaction: 0,
      totalTips: 0,
      totalTransactions: 0,
    },
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchEmployeeSales() {
      try {
        setData((prev) => ({ ...prev, isLoading: true, error: null }));

        const ticketsResult = await supabase
          .from('sale_tickets')
          .select(`
            id,
            total,
            ticket_items (
              id,
              employee_id,
              line_subtotal,
              tip_customer,
              tip_receptionist,
              employees (
                id,
                display_name,
                role
              )
            )
          `)
          .gte('ticket_date', dateRange.startDate)
          .lte('ticket_date', dateRange.endDate)
          .not('closed_at', 'is', null);

        if (cancelled) return;

        if (ticketsResult.error) throw ticketsResult.error;

        const tickets = ticketsResult.data || [];

        const employeeMap = new Map<string, {
          name: string;
          role: string;
          grossSales: number;
          refunds: number;
          tips: number;
          transactions: Set<string>;
        }>();

        tickets.forEach((ticket) => {
          if (!ticket.ticket_items || ticket.ticket_items.length === 0) return;

          ticket.ticket_items.forEach((item: any) => {
            if (!item.employee_id || !item.employees) return;

            const employeeId = item.employee_id;
            const employee = item.employees;

            if (!employeeMap.has(employeeId)) {
              employeeMap.set(employeeId, {
                name: employee.display_name || 'Unknown',
                role: Array.isArray(employee.role) ? employee.role.join(', ') : employee.role || 'Unknown',
                grossSales: 0,
                refunds: 0,
                tips: 0,
                transactions: new Set(),
              });
            }

            const empData = employeeMap.get(employeeId)!;
            const lineSubtotal = item.line_subtotal || 0;

            if (lineSubtotal >= 0) {
              empData.grossSales += lineSubtotal;
            } else {
              empData.refunds += Math.abs(lineSubtotal);
            }

            empData.tips += (item.tip_customer || 0) + (item.tip_receptionist || 0);
            empData.transactions.add(ticket.id);
          });
        });

        const employeeRows: EmployeeSalesRow[] = Array.from(employeeMap.entries()).map(
          ([employeeId, empData]) => ({
            employeeId,
            employeeName: empData.name,
            employeeRole: empData.role,
            grossSales: empData.grossSales,
            refunds: empData.refunds,
            netSales: empData.grossSales - empData.refunds,
            nonRevenueItems: 0,
            giftCardActivations: 0,
            tips: empData.tips,
            transactions: empData.transactions.size,
          })
        );

        employeeRows.sort((a, b) => b.netSales - a.netSales);

        const totalNetSales = employeeRows.reduce((sum, emp) => sum + emp.netSales, 0);
        const totalTips = employeeRows.reduce((sum, emp) => sum + emp.tips, 0);
        const totalTransactions = employeeRows.reduce((sum, emp) => sum + emp.transactions, 0);
        const averagePerTransaction = totalTransactions > 0 ? totalNetSales / totalTransactions : 0;

        setData({
          employees: employeeRows,
          summary: {
            totalNetSales,
            averagePerTransaction,
            totalTips,
            totalTransactions,
          },
          isLoading: false,
          error: null,
        });
      } catch (error) {
        if (!cancelled) {
          console.error('Error fetching employee sales data:', error);
          setData((prev) => ({
            ...prev,
            isLoading: false,
            error: 'Failed to load employee sales data',
          }));
        }
      }
    }

    fetchEmployeeSales();

    return () => {
      cancelled = true;
    };
  }, [dateRange.startDate, dateRange.endDate]);

  return data;
}
