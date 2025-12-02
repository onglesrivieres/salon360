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
