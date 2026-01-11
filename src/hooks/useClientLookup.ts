import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, Client, ClientColorHistory, ClientLookupResult } from '../lib/supabase';
import { normalizePhoneNumber, hasEnoughDigitsForLookup } from '../lib/phoneUtils';

interface UseClientLookupOptions {
  debounceMs?: number;
  enabled?: boolean;
}

interface UseClientLookupReturn {
  client: Client | null;
  lastColor: ClientColorHistory | null;
  totalVisits: number;
  lastVisit: string | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Hook for looking up clients by phone number with debouncing
 * Used in TicketEditor for real-time client detection
 */
export function useClientLookup(
  phone: string,
  storeId: string | null,
  options: UseClientLookupOptions = {}
): UseClientLookupReturn {
  const { debounceMs = 300, enabled = true } = options;

  const [client, setClient] = useState<Client | null>(null);
  const [lastColor, setLastColor] = useState<ClientColorHistory | null>(null);
  const [totalVisits, setTotalVisits] = useState(0);
  const [lastVisit, setLastVisit] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const lookupClient = useCallback(async (normalizedPhone: string, currentStoreId: string) => {
    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      // Lookup client by phone number and store
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('store_id', currentStoreId)
        .eq('phone_number', normalizedPhone)
        .maybeSingle();

      if (clientError) throw clientError;

      if (!clientData) {
        // No client found
        setClient(null);
        setLastColor(null);
        setTotalVisits(0);
        setLastVisit(null);
        setIsLoading(false);
        return;
      }

      setClient(clientData);

      // Fetch last color used
      const { data: colorData, error: colorError } = await supabase
        .from('client_color_history')
        .select('*')
        .eq('client_id', clientData.id)
        .order('applied_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!colorError) {
        setLastColor(colorData);
      }

      // Fetch visit statistics from sale_tickets
      const { data: visitData, error: visitError } = await supabase
        .from('sale_tickets')
        .select('id, ticket_date')
        .eq('client_id', clientData.id)
        .order('ticket_date', { ascending: false });

      if (!visitError && visitData) {
        setTotalVisits(visitData.length);
        setLastVisit(visitData.length > 0 ? visitData[0].ticket_date : null);
      } else {
        setTotalVisits(0);
        setLastVisit(null);
      }

      setIsLoading(false);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return; // Ignore aborted requests
      }
      console.error('Error looking up client:', err);
      setError(err.message || 'Failed to lookup client');
      setClient(null);
      setLastColor(null);
      setTotalVisits(0);
      setLastVisit(null);
      setIsLoading(false);
    }
  }, []);

  const refetch = useCallback(() => {
    const normalizedPhone = normalizePhoneNumber(phone);
    if (storeId && hasEnoughDigitsForLookup(normalizedPhone)) {
      lookupClient(normalizedPhone, storeId);
    }
  }, [phone, storeId, lookupClient]);

  useEffect(() => {
    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Reset state if disabled or no store
    if (!enabled || !storeId) {
      setClient(null);
      setLastColor(null);
      setTotalVisits(0);
      setLastVisit(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    const normalizedPhone = normalizePhoneNumber(phone);

    // Check if we have enough digits for lookup
    if (!hasEnoughDigitsForLookup(normalizedPhone)) {
      setClient(null);
      setLastColor(null);
      setTotalVisits(0);
      setLastVisit(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Set loading state immediately for better UX
    setIsLoading(true);

    // Debounce the lookup
    debounceTimerRef.current = setTimeout(() => {
      lookupClient(normalizedPhone, storeId);
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [phone, storeId, enabled, debounceMs, lookupClient]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    client,
    lastColor,
    totalVisits,
    lastVisit,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Create a new client
 */
export async function createClient(data: {
  store_id: string;
  name: string;
  phone_number: string;
  notes?: string;
}): Promise<{ client: Client | null; error: string | null }> {
  try {
    const normalizedPhone = normalizePhoneNumber(data.phone_number);

    const { data: client, error } = await supabase
      .from('clients')
      .insert([{
        store_id: data.store_id,
        name: data.name.trim(),
        phone_number: normalizedPhone,
        notes: data.notes?.trim() || '',
      }])
      .select()
      .single();

    if (error) throw error;

    return { client, error: null };
  } catch (err: any) {
    console.error('Error creating client:', err);
    // Check for unique constraint violation
    if (err.code === '23505') {
      return { client: null, error: 'A client with this phone number already exists' };
    }
    return { client: null, error: err.message || 'Failed to create client' };
  }
}

/**
 * Add color to client history
 */
export async function addColorToHistory(data: {
  client_id: string;
  ticket_id: string;
  color: string;
  service_type?: string;
}): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase
      .from('client_color_history')
      .insert([{
        client_id: data.client_id,
        ticket_id: data.ticket_id,
        color: data.color.trim(),
        service_type: data.service_type || null,
        applied_date: new Date().toISOString(),
      }]);

    if (error) throw error;

    return { success: true, error: null };
  } catch (err: any) {
    console.error('Error adding color to history:', err);
    return { success: false, error: err.message || 'Failed to add color to history' };
  }
}
