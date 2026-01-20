import { useState, useEffect } from 'react';
import { checkTimeBasedAccess } from '../lib/workingHours';

interface WorkingHoursState {
  isLoading: boolean;
  isWithinWorkingHours: boolean;
  accessStartTime: string | null;
  accessEndTime: string | null;
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
    accessStartTime: null,
    accessEndTime: null,
    closingTime: null,
    currentDay: '',
  });

  useEffect(() => {
    async function checkHours() {
      // Roles with time-based access restrictions (8:45 AM to 30 min after closing)
      const restrictedRoles = ['Technician', 'Cashier', 'Receptionist', 'Supervisor'];
      if (!restrictedRoles.includes(rolePermission ?? '') || !storeId) {
        setState(prev => ({ ...prev, isLoading: false, isWithinWorkingHours: true }));
        return;
      }

      const result = await checkTimeBasedAccess(storeId);
      setState({
        isLoading: false,
        isWithinWorkingHours: result.isWithinAccessHours,
        accessStartTime: result.accessStartTime,
        accessEndTime: result.accessEndTime,
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
