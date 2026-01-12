import { supabase } from './supabase';
import { RolePermission } from './permissions';

export interface AuthSession {
  employee_id: string;
  display_name: string;
  role: ('Admin' | 'Technician' | 'Receptionist' | 'Manager' | 'Owner' | 'Supervisor' | 'Cashier')[];
  role_permission: RolePermission;
  can_reset_pin: boolean;
  store_id?: string;
}

const SESSION_KEY = 'salon365_session';
const LAST_ACTIVITY_KEY = 'salon365_last_activity';
const LEGACY_SESSION_KEY = 'salon360_session';
const LEGACY_LAST_ACTIVITY_KEY = 'salon360_last_activity';
const AUTO_LOCK_TIMEOUT = 5 * 60 * 1000;

export async function hashPIN(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export async function verifyPIN(pin: string, hash: string): Promise<boolean> {
  const pinHash = await hashPIN(pin);
  return pinHash === hash;
}

export function saveSession(session: AuthSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  updateLastActivity();
}

export function getSession(): AuthSession | null {
  let sessionData = localStorage.getItem(SESSION_KEY);
  
  // Migrate legacy key if new key doesn't exist
  if (!sessionData) {
    const legacySessionData = localStorage.getItem(LEGACY_SESSION_KEY);
    if (legacySessionData) {
      sessionData = legacySessionData;
      try {
        JSON.parse(legacySessionData);
        localStorage.setItem(SESSION_KEY, legacySessionData);
        localStorage.removeItem(LEGACY_SESSION_KEY);
      } catch {
        localStorage.removeItem(LEGACY_SESSION_KEY);
        return null;
      }
    }
  }
  
  if (!sessionData) return null;

  let lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
  
  // Migrate legacy last activity key if new key doesn't exist
  if (!lastActivity) {
    const legacyLastActivity = localStorage.getItem(LEGACY_LAST_ACTIVITY_KEY);
    if (legacyLastActivity) {
      lastActivity = legacyLastActivity;
      try {
        const parsedTime = parseInt(lastActivity, 10);
        if (!isNaN(parsedTime)) {
          localStorage.setItem(LAST_ACTIVITY_KEY, legacyLastActivity);
          localStorage.removeItem(LEGACY_LAST_ACTIVITY_KEY);
        } else {
          localStorage.removeItem(LEGACY_LAST_ACTIVITY_KEY);
          lastActivity = null;
        }
      } catch {
        localStorage.removeItem(LEGACY_LAST_ACTIVITY_KEY);
        lastActivity = null;
      }
    }
  }
  
  if (lastActivity) {
    const parsedTime = parseInt(lastActivity, 10);
    if (isNaN(parsedTime)) {
      // Invalid lastActivity, remove it
      localStorage.removeItem(LAST_ACTIVITY_KEY);
      return null;
    }
    const timeSinceActivity = Date.now() - parsedTime;
    if (timeSinceActivity > AUTO_LOCK_TIMEOUT) {
      clearSession();
      return null;
    }
  }

  try {
    return JSON.parse(sessionData);
  } catch {
    // JSON parse failed, clear the bad session data
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(LAST_ACTIVITY_KEY);
}

export function updateLastActivity(): void {
  localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
}

export async function authenticateWithPIN(pin: string): Promise<AuthSession | null> {
  if (!/^\d{4}$/.test(pin)) {
    return null;
  }

  const { data, error } = await supabase.rpc('verify_employee_pin', {
    pin_input: pin
  });

  if (error || !data || data.length === 0) {
    return null;
  }

  const employee = data[0];

  return {
    employee_id: employee.employee_id,
    display_name: employee.display_name,
    role: employee.role,
    role_permission: employee.role_permission || 'Technician',
    can_reset_pin: employee.can_reset_pin || false,
    store_id: employee.store_id,
  };
}

export async function changePIN(employeeId: string, oldPIN: string, newPIN: string): Promise<{ success: boolean; error?: string }> {
  if (!/^\d{4}$/.test(newPIN)) {
    return { success: false, error: 'New PIN must be exactly 4 digits' };
  }

  if (oldPIN === newPIN) {
    return { success: false, error: 'New PIN must be different from old PIN' };
  }

  const { data, error } = await supabase.rpc('change_employee_pin', {
    emp_id: employeeId,
    old_pin: oldPIN,
    new_pin: newPIN
  });

  if (error) {
    console.error('Change PIN error:', error);
    return { success: false, error: error.message || 'Failed to change PIN' };
  }

  return data as { success: boolean; error?: string };
}

export async function resetPIN(employeeId: string): Promise<{ success: boolean; tempPIN?: string; error?: string }> {
  const { data, error } = await supabase.rpc('reset_employee_pin', {
    emp_id: employeeId
  });

  if (error) {
    return { success: false, error: error.message || 'Failed to reset PIN' };
  }

  const result = data as { success: boolean; temp_pin?: string; error?: string };

  return {
    success: result.success,
    tempPIN: result.temp_pin,
    error: result.error
  };
}
