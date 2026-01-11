import { useState, useEffect, useCallback } from 'react';
import { supabase, Client, ClientWithStats } from '../lib/supabase';

interface UseClientsOptions {
  search?: string;
  blacklistedOnly?: boolean;
  limit?: number;
  offset?: number;
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
  const { search = '', blacklistedOnly = false, limit = 50, offset = 0 } = options;

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
      // Build query
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

      // Apply pagination
      query = query.range(offset, offset + limit - 1);

      const { data, error: queryError, count } = await query;

      if (queryError) throw queryError;

      // Fetch visit stats for each client
      const clientsWithStats: ClientWithStats[] = await Promise.all(
        (data || []).map(async (client) => {
          // Get last visit and total visits
          const { data: visitData } = await supabase
            .from('sale_tickets')
            .select('ticket_date')
            .eq('client_id', client.id)
            .order('ticket_date', { ascending: false })
            .limit(1);

          const { count: visitCount } = await supabase
            .from('sale_tickets')
            .select('id', { count: 'exact', head: true })
            .eq('client_id', client.id);

          // Get last color
          const { data: colorData } = await supabase
            .from('client_color_history')
            .select('color')
            .eq('client_id', client.id)
            .order('applied_date', { ascending: false })
            .limit(1);

          // Get blacklisted_by name if applicable
          let blacklistedByName = '';
          if (client.is_blacklisted && client.blacklisted_by) {
            const { data: empData } = await supabase
              .from('employees')
              .select('display_name')
              .eq('id', client.blacklisted_by)
              .maybeSingle();
            blacklistedByName = empData?.display_name || '';
          }

          return {
            ...client,
            last_visit: visitData?.[0]?.ticket_date || undefined,
            total_visits: visitCount || 0,
            last_color: colorData?.[0]?.color || undefined,
            blacklisted_by_name: blacklistedByName,
          };
        })
      );

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
  }, [storeId, search, blacklistedOnly, limit, offset]);

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
