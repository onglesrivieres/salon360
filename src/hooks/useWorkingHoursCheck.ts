import { useState, useEffect } from 'react';
import { checkStoreWorkingHours } from '../lib/workingHours';

interface WorkingHoursState {
  isLoading: boolean;
  isWithinWorkingHours: boolean;
  openingTime: string | null;
  closingTime: string | null;
  currentDay: string;
}

export function useWorkingHoursCheck(
  storeId: string | null,
  rolePermission: string | null | undefined
): WorkingHoursState {
  const [state, setState] = useState<WorkingHoursState>({
    isLoading: true,
    isWithinWorkingHours: true,
    openingTime: null,
    closingTime: null,
    currentDay: '',
  });

  useEffect(() => {
    async function checkHours() {
      if (rolePermission !== 'Receptionist' || !storeId) {
        setState(prev => ({ ...prev, isLoading: false, isWithinWorkingHours: true }));
        return;
      }

      const result = await checkStoreWorkingHours(storeId);
      setState({
        isLoading: false,
        isWithinWorkingHours: result.isWithinWorkingHours,
        openingTime: result.openingTime,
        closingTime: result.closingTime,
        currentDay: result.currentDay,
      });
    }

    checkHours();

    const interval = setInterval(checkHours, 60000);
    return () => clearInterval(interval);
  }, [storeId, rolePermission]);

  return state;
}
