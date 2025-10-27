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

export function formatDateTimeFullEST(date: Date | string, includeTimezone: boolean = true): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  const options: Intl.DateTimeFormatOptions = {
    timeZone: EST_TIMEZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  };

  const formatted = dateObj.toLocaleString('en-US', options);
  return includeTimezone ? `${formatted} EST` : formatted;
}

export function toESTDate(date: Date | string): Date {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const estString = dateObj.toLocaleString('en-US', { timeZone: EST_TIMEZONE });
  return new Date(estString);
}

export function formatTime24EST(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  const options: Intl.DateTimeFormatOptions = {
    timeZone: EST_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: false
  };

  return dateObj.toLocaleTimeString('en-US', options);
}

export function getESTTimezone(): string {
  return EST_TIMEZONE;
}
