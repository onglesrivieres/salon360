import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { format } from 'date-fns';

const EST_TIMEZONE = 'America/New_York';

export function formatTimeEST(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: EST_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    ...options
  };

  return dateObj.toLocaleTimeString('en-US', defaultOptions);
}

export function formatDateEST(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: EST_TIMEZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...options
  };

  return dateObj.toLocaleDateString('en-US', defaultOptions);
}

export function formatDateTimeEST(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: EST_TIMEZONE,
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

export function getCurrentDateEST(): string {
  const now = new Date();
  const estDate = new Date(now.toLocaleString('en-US', { timeZone: EST_TIMEZONE }));
  const year = estDate.getFullYear();
  const month = String(estDate.getMonth() + 1).padStart(2, '0');
  const day = String(estDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getESTTimezone(): string {
  return EST_TIMEZONE;
}

export function convertToESTDatetimeString(utcDateString: string): string {
  if (!utcDateString) return '';

  // Parse the UTC date
  const utcDate = new Date(utcDateString);

  // Convert UTC to EST/EDT
  const estDate = toZonedTime(utcDate, EST_TIMEZONE);

  // Format for datetime-local input (YYYY-MM-DDTHH:mm)
  return format(estDate, "yyyy-MM-dd'T'HH:mm");
}

export function convertESTDatetimeStringToUTC(estDatetimeString: string): string {
  if (!estDatetimeString) return '';

  // Parse the datetime string in format: YYYY-MM-DDTHH:mm
  const parts = estDatetimeString.split('T');
  if (parts.length !== 2) return '';

  const [datePart, timePart] = parts;
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);

  // Create a date object representing the EST time
  // Note: month is 0-indexed in Date constructor
  const estDate = new Date(year, month - 1, day, hour, minute, 0);

  // Convert EST time to UTC
  const utcDate = fromZonedTime(estDate, EST_TIMEZONE);

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
