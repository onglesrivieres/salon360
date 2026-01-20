import { supabase } from './supabase';
import { getCurrentTimezone } from './timezone';

// Get store closing time for a specific date (used for "Last Ticket" detection)
export async function getStoreClosingTimeForDate(storeId: string, date: string): Promise<string | null> {
  const { data: store, error } = await supabase
    .from('stores')
    .select('closing_hours')
    .eq('id', storeId)
    .maybeSingle();

  if (error || !store || !store.closing_hours) return null;

  // Get day of week from the selected date
  const dateObj = new Date(date + 'T12:00:00'); // noon to avoid timezone issues
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayOfWeek = days[dateObj.getDay()];

  const closingTime = store.closing_hours[dayOfWeek];
  return closingTime ? closingTime.substring(0, 5) : null;
}

export interface WorkingHoursResult {
  isWithinWorkingHours: boolean;
  openingTime: string | null;
  closingTime: string | null;
  currentDay: string;
}

export async function checkStoreWorkingHours(storeId: string): Promise<WorkingHoursResult> {
  const { data: store, error } = await supabase
    .from('stores')
    .select('opening_hours, closing_hours')
    .eq('id', storeId)
    .maybeSingle();

  if (error || !store) {
    return {
      isWithinWorkingHours: true,
      openingTime: null,
      closingTime: null,
      currentDay: '',
    };
  }

  const timezone = store.timezone || getCurrentTimezone();
  const now = new Date();
  const tzNow = new Date(now.toLocaleString('en-US', { timeZone: timezone }));

  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDay = days[tzNow.getDay()];

  const openingTime = store.opening_hours?.[currentDay] || null;
  const closingTime = store.closing_hours?.[currentDay] || null;

  if (!openingTime || !closingTime) {
    return {
      isWithinWorkingHours: true,
      openingTime,
      closingTime,
      currentDay,
    };
  }

  const currentHour = tzNow.getHours();
  const currentMinute = tzNow.getMinutes();
  const currentTimeMinutes = currentHour * 60 + currentMinute;

  const [openHour, openMin] = openingTime.split(':').map(Number);
  const openingTimeMinutes = openHour * 60 + openMin;

  const [closeHour, closeMin] = closingTime.split(':').map(Number);
  const closingTimeMinutes = closeHour * 60 + closeMin;

  // Allow access 1.5 hours before opening and 1 hour after closing
  const EARLY_ACCESS_MINUTES = 90;  // 1.5 hours before opening
  const LATE_ACCESS_MINUTES = 60;   // 1 hour after closing

  const isWithinWorkingHours = currentTimeMinutes >= (openingTimeMinutes - EARLY_ACCESS_MINUTES) &&
                               currentTimeMinutes <= (closingTimeMinutes + LATE_ACCESS_MINUTES);

  return {
    isWithinWorkingHours,
    openingTime: openingTime.substring(0, 5),
    closingTime: closingTime.substring(0, 5),
    currentDay,
  };
}
