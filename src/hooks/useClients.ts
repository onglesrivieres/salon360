import { useState, useEffect, useCallback } from 'react';
import { supabase, ClientWithStats } from '../lib/supabase';

interface UseClientsOptions {
  search?: string;
  blacklistedOnly?: boolean;
}

interface UseClientsReturn {
  clients: ClientWithStats[];
  isLoading: boolean;
  error: string | null;
  totalCount: number;
  refetch: () => void;
}

/**
 * Hook for fetching and managing clients list
 */
export function useClients(
  storeId: string | null,
  options: UseClientsOptions = {}
): UseClientsReturn {
  const { search = '', blacklistedOnly = false } = options;

  const [clients, setClients] = useState<ClientWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const fetchClients = useCallback(async () => {
    if (!storeId) {
      setClients([]);
      setTotalCount(0);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Build query — fetch all clients for the store (no pagination)
      let query = supabase
        .from('clients')
        .select('*', { count: 'exact' })
        .eq('store_id', storeId)
        .order('name', { ascending: true });

      // Apply search filter
      if (search.trim()) {
        const searchTerm = search.trim();
        query = query.or(`name.ilike.%${searchTerm}%,phone_number.ilike.%${searchTerm}%`);
      }

      // Apply blacklist filter
      if (blacklistedOnly) {
        query = query.eq('is_blacklisted', true);
      }

      const { data, error: queryError, count } = await query;

      if (queryError) throw queryError;

      const allClients = data || [];
      const clientIds = allClients.map(c => c.id);

      if (clientIds.length === 0) {
        setClients([]);
        setTotalCount(0);
        setIsLoading(false);
        return;
      }

      // Batch query 1: visit stats from sale_tickets (filtered by store_id)
      const { data: ticketRows } = await supabase
        .from('sale_tickets')
        .select('client_id, ticket_date')
        .eq('store_id', storeId)
        .in('client_id', clientIds);

      // Aggregate: last_visit (max ticket_date) and total_visits (count) per client
      const visitMap = new Map<string, { last_visit: string; total_visits: number }>();
      for (const row of ticketRows || []) {
        const existing = visitMap.get(row.client_id);
        if (!existing) {
          visitMap.set(row.client_id, { last_visit: row.ticket_date, total_visits: 1 });
        } else {
          existing.total_visits++;
          if (row.ticket_date > existing.last_visit) {
            existing.last_visit = row.ticket_date;
          }
        }
      }

      // Batch query 2: last color from client_color_history
      const { data: colorRows } = await supabase
        .from('client_color_history')
        .select('client_id, color, applied_date')
        .in('client_id', clientIds)
        .order('applied_date', { ascending: false });

      // First occurrence per client_id is the most recent (ordered DESC)
      const colorMap = new Map<string, string>();
      for (const row of colorRows || []) {
        if (!colorMap.has(row.client_id)) {
          colorMap.set(row.client_id, row.color);
        }
      }

      // Batch query 3: blacklisted_by employee names
      const blacklistedByIds = [
        ...new Set(
          allClients
            .filter(c => c.is_blacklisted && c.blacklisted_by)
            .map(c => c.blacklisted_by as string)
        ),
      ];

      const empNameMap = new Map<string, string>();
      if (blacklistedByIds.length > 0) {
        const { data: empRows } = await supabase
          .from('employees')
          .select('id, display_name')
          .in('id', blacklistedByIds);

        for (const emp of empRows || []) {
          empNameMap.set(emp.id, emp.display_name);
        }
      }

      // Combine everything
      const clientsWithStats: ClientWithStats[] = allClients.map(client => {
        const visits = visitMap.get(client.id);
        return {
          ...client,
          last_visit: visits?.last_visit || undefined,
          total_visits: visits?.total_visits || 0,
          last_color: colorMap.get(client.id) || undefined,
          blacklisted_by_name:
            client.is_blacklisted && client.blacklisted_by
              ? empNameMap.get(client.blacklisted_by) || ''
              : '',
        };
      });

      setClients(clientsWithStats);
      setTotalCount(count || 0);
    } catch (err: any) {
      console.error('Error fetching clients:', err);
      setError(err.message || 'Failed to fetch clients');
      setClients([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [storeId, search, blacklistedOnly]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  return {
    clients,
    isLoading,
    error,
    totalCount,
    refetch: fetchClients,
  };
}
