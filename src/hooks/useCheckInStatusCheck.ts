import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getCurrentDateEST } from '../lib/timezone';

interface CheckInStatusState {
  isLoading: boolean;
  isCheckedIn: boolean;
}

export function useCheckInStatusCheck(
  employeeId: string | null | undefined,
  storeId: string | null,
  rolePermission: string | null | undefined
): CheckInStatusState & { refetch: () => Promise<void> } {
  const [state, setState] = useState<CheckInStatusState>({
    isLoading: true,
    isCheckedIn: true, // Default to true to avoid flash of blocked page
  });

  const checkStatus = useCallback(async () => {
    // Only restrict Receptionist, Supervisor, and Technician roles
    const restrictedRoles = ['Receptionist', 'Supervisor', 'Technician'];
    if (!restrictedRoles.includes(rolePermission ?? '') || !employeeId || !storeId) {
      setState({ isLoading: false, isCheckedIn: true });
      return;
    }

    try {
      const today = getCurrentDateEST();

      const { data, error } = await supabase
        .from('attendance_records')
        .select('id')
        .eq('employee_id', employeeId)
        .eq('store_id', storeId)
        .eq('work_date', today)
        .eq('status', 'checked_in')
        .is('check_out_time', null)
        .maybeSingle();

      if (error) throw error;

      setState({
        isLoading: false,
        isCheckedIn: !!data,
      });
    } catch (error) {
      console.error('Error checking check-in status:', error);
      // On error, allow access to avoid blocking users due to network issues
      setState({ isLoading: false, isCheckedIn: true });
    }
  }, [employeeId, storeId, rolePermission]);

  useEffect(() => {
    checkStatus();

    // Poll every 60 seconds to detect check-out or auto-checkout
    const interval = setInterval(checkStatus, 60000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  return { ...state, refetch: checkStatus };
}
