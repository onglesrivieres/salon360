import { useState } from 'react';
import { supabase, Client } from '../lib/supabase';
import { normalizePhoneNumber } from '../lib/phoneUtils';

interface MutationResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

interface UseClientMutationsReturn {
  createClient: (data: CreateClientData) => Promise<MutationResult<Client>>;
  updateClient: (id: string, data: UpdateClientData) => Promise<MutationResult<Client>>;
  deleteClient: (id: string) => Promise<MutationResult>;
  blacklistClient: (id: string, data: BlacklistData) => Promise<MutationResult>;
  unblacklistClient: (id: string) => Promise<MutationResult>;
  isLoading: boolean;
}

interface CreateClientData {
  store_id: string;
  name: string;
  phone_number: string;
  notes?: string;
}

interface UpdateClientData {
  name?: string;
  phone_number?: string;
  notes?: string;
}

interface BlacklistData {
  reason: string;
  blacklisted_by: string;
}

/**
 * Hook for client mutation operations
 */
export function useClientMutations(): UseClientMutationsReturn {
  const [isLoading, setIsLoading] = useState(false);

  const createClient = async (data: CreateClientData): Promise<MutationResult<Client>> => {
    setIsLoading(true);
    try {
      const { data: client, error } = await supabase
        .from('clients')
        .insert([{
          store_id: data.store_id,
          name: data.name.trim(),
          phone_number: normalizePhoneNumber(data.phone_number),
          notes: data.notes?.trim() || '',
        }])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return { success: false, error: 'A client with this phone number already exists' };
        }
        throw error;
      }

      return { success: true, data: client };
    } catch (err: any) {
      console.error('Error creating client:', err);
      return { success: false, error: err.message || 'Failed to create client' };
    } finally {
      setIsLoading(false);
    }
  };

  const updateClient = async (id: string, data: UpdateClientData): Promise<MutationResult<Client>> => {
    setIsLoading(true);
    try {
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (data.name !== undefined) {
        updateData.name = data.name.trim();
      }

      if (data.phone_number !== undefined) {
        updateData.phone_number = normalizePhoneNumber(data.phone_number);
      }

      if (data.notes !== undefined) {
        updateData.notes = data.notes.trim();
      }

      const { data: client, error } = await supabase
        .from('clients')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return { success: false, error: 'A client with this phone number already exists' };
        }
        throw error;
      }

      return { success: true, data: client };
    } catch (err: any) {
      console.error('Error updating client:', err);
      return { success: false, error: err.message || 'Failed to update client' };
    } finally {
      setIsLoading(false);
    }
  };

  const deleteClient = async (id: string): Promise<MutationResult> => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return { success: true };
    } catch (err: any) {
      console.error('Error deleting client:', err);
      return { success: false, error: err.message || 'Failed to delete client' };
    } finally {
      setIsLoading(false);
    }
  };

  const blacklistClient = async (id: string, data: BlacklistData): Promise<MutationResult> => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('clients')
        .update({
          is_blacklisted: true,
          blacklist_reason: data.reason.trim(),
          blacklist_date: new Date().toISOString(),
          blacklisted_by: data.blacklisted_by,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      return { success: true };
    } catch (err: any) {
      console.error('Error blacklisting client:', err);
      return { success: false, error: err.message || 'Failed to blacklist client' };
    } finally {
      setIsLoading(false);
    }
  };

  const unblacklistClient = async (id: string): Promise<MutationResult> => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('clients')
        .update({
          is_blacklisted: false,
          blacklist_reason: null,
          blacklist_date: null,
          blacklisted_by: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      return { success: true };
    } catch (err: any) {
      console.error('Error removing client from blacklist:', err);
      return { success: false, error: err.message || 'Failed to remove client from blacklist' };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    createClient,
    updateClient,
    deleteClient,
    blacklistClient,
    unblacklistClient,
    isLoading,
  };
}
