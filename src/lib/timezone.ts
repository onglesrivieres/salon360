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
  const date = new Date(utcDateString);

  const estDate = new Date(date.toLocaleString('en-US', { timeZone: EST_TIMEZONE }));
  const year = estDate.getFullYear();
  const month = String(estDate.getMonth() + 1).padStart(2, '0');
  const day = String(estDate.getDate()).padStart(2, '0');
  const hours = String(estDate.getHours()).padStart(2, '0');
  const minutes = String(estDate.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function convertESTDatetimeStringToUTC(estDatetimeString: string): string {
  if (!estDatetimeString) return '';

  const parts = estDatetimeString.split('T');
  if (parts.length !== 2) return '';

  const [datePart, timePart] = parts;

  const dateTimeString = `${datePart} ${timePart}:00`;

  const utcDate = new Date(new Date(dateTimeString).toLocaleString('en-US', { timeZone: 'UTC' }));
  const estDate = new Date(new Date(dateTimeString).toLocaleString('en-US', { timeZone: EST_TIMEZONE }));

  const diff = utcDate.getTime() - estDate.getTime();

  const localAsEST = new Date(dateTimeString);
  const correctedUTC = new Date(localAsEST.getTime() - diff);

  return correctedUTC.toISOString();
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
