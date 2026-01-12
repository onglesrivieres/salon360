import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { format } from 'date-fns';

const DEFAULT_TIMEZONE = 'America/New_York';

// Global timezone that can be set from the SettingsContext
let currentTimezone: string = DEFAULT_TIMEZONE;

export function setCurrentTimezone(timezone: string): void {
  currentTimezone = timezone || DEFAULT_TIMEZONE;
}

export function getCurrentTimezone(): string {
  return currentTimezone;
}

export function formatTimeEST(date: Date | string, options?: Intl.DateTimeFormatOptions, timezone?: string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const tz = timezone || currentTimezone;

  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: tz,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    ...options
  };

  return dateObj.toLocaleTimeString('en-US', defaultOptions);
}

export function formatDateEST(date: Date | string, options?: Intl.DateTimeFormatOptions, timezone?: string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const tz = timezone || currentTimezone;

  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: tz,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...options
  };

  return dateObj.toLocaleDateString('en-US', defaultOptions);
}

export function formatDateTimeEST(date: Date | string, options?: Intl.DateTimeFormatOptions, timezone?: string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const tz = timezone || currentTimezone;

  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: tz,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    ...options
  };

  return dateObj.toLocaleString('en-US', defaultOptions);
}

export function getCurrentDateEST(timezone?: string): string {
  const tz = timezone || currentTimezone;
  const now = new Date();
  const tzDate = new Date(now.toLocaleString('en-US', { timeZone: tz }));
  const year = tzDate.getFullYear();
  const month = String(tzDate.getMonth() + 1).padStart(2, '0');
  const day = String(tzDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDateISOEST(date: Date | string, timezone?: string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const tz = timezone || currentTimezone;
  const tzDate = new Date(dateObj.toLocaleString('en-US', { timeZone: tz }));
  const year = tzDate.getFullYear();
  const month = String(tzDate.getMonth() + 1).padStart(2, '0');
  const day = String(tzDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getESTTimezone(): string {
  return currentTimezone;
}

export function convertToESTDatetimeString(utcDateString: string, timezone?: string): string {
  if (!utcDateString) return '';
  const tz = timezone || currentTimezone;

  // Parse the UTC date
  const utcDate = new Date(utcDateString);

  // Convert UTC to configured timezone
  const tzDate = toZonedTime(utcDate, tz);

  // Format for datetime-local input (YYYY-MM-DDTHH:mm)
  return format(tzDate, "yyyy-MM-dd'T'HH:mm");
}

export function convertESTDatetimeStringToUTC(tzDatetimeString: string, timezone?: string): string {
  if (!tzDatetimeString) return '';
  const tz = timezone || currentTimezone;

  // Parse the datetime string in format: YYYY-MM-DDTHH:mm
  const parts = tzDatetimeString.split('T');
  if (parts.length !== 2) return '';

  const [datePart, timePart] = parts;
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);

  // Create a date object representing the timezone's local time
  // Note: month is 0-indexed in Date constructor
  const tzDate = new Date(year, month - 1, day, hour, minute, 0);

  // Convert timezone time to UTC
  const utcDate = fromZonedTime(tzDate, tz);

  return utcDate.toISOString();
}

export function formatDateOnly(dateString: string): string {
  if (!dateString) return '';

  const parts = dateString.split('-');
  if (parts.length !== 3) return dateString;

  const [year, month, day] = parts;
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}
