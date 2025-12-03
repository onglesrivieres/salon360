export type TimeFilterType = 'today' | 'week' | 'period' | 'month' | 'year' | 'custom';

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface TimeFilter {
  type: TimeFilterType;
  label: string;
  dateRange?: DateRange;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function getEndOfWeek(date: Date): Date {
  const start = getStartOfWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return end;
}

function getStartOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getEndOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function getStartOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1);
}

function getEndOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 11, 31);
}

function getBiweeklyPeriod(date: Date): DateRange {
  // Bi-weekly payroll periods starting from October 13, 2024 (Sunday)
  // This ensures periods align with the company payroll schedule
  // Periods run Sunday to Saturday for 14 days
  // Example periods: Oct 13-26, Oct 27-Nov 9, Nov 10-23, Nov 24-Dec 7, etc.
  // This matches the implementation in AttendancePage.tsx
  const payrollStartDate = new Date(2024, 9, 13); // October 13, 2024

  // Normalize dates to midnight for accurate day calculation
  const normalizedCurrent = new Date(date);
  normalizedCurrent.setHours(0, 0, 0, 0);

  const normalizedStart = new Date(payrollStartDate);
  normalizedStart.setHours(0, 0, 0, 0);

  const daysSinceStart = Math.floor((normalizedCurrent.getTime() - normalizedStart.getTime()) / (1000 * 60 * 60 * 24));
  const periodNumber = Math.floor(daysSinceStart / 14);

  const periodStart = new Date(normalizedStart);
  periodStart.setDate(periodStart.getDate() + (periodNumber * 14));

  const periodEnd = new Date(periodStart);
  periodEnd.setDate(periodEnd.getDate() + 13); // 14 days total (0-13)

  return {
    startDate: formatDate(periodStart),
    endDate: formatDate(periodEnd),
  };
}

export function getDateRangeForFilter(filterType: TimeFilterType, customRange?: DateRange): DateRange {
  const today = new Date();

  switch (filterType) {
    case 'today':
      return {
        startDate: formatDate(today),
        endDate: formatDate(today),
      };

    case 'week':
      return {
        startDate: formatDate(getStartOfWeek(today)),
        endDate: formatDate(getEndOfWeek(today)),
      };

    case 'period':
      return getBiweeklyPeriod(today);

    case 'month':
      return {
        startDate: formatDate(getStartOfMonth(today)),
        endDate: formatDate(getEndOfMonth(today)),
      };

    case 'year':
      return {
        startDate: formatDate(getStartOfYear(today)),
        endDate: formatDate(getEndOfYear(today)),
      };

    case 'custom':
      return customRange || {
        startDate: formatDate(today),
        endDate: formatDate(today),
      };

    default:
      return {
        startDate: formatDate(today),
        endDate: formatDate(today),
      };
  }
}

export function getFilterLabel(filterType: TimeFilterType, dateRange?: DateRange): string {
  const today = new Date();

  switch (filterType) {
    case 'today':
      return `Today: ${formatDisplayDate(today)}`;

    case 'week': {
      const start = getStartOfWeek(today);
      const end = getEndOfWeek(today);
      return `This Week: ${formatDisplayDate(start)} - ${formatDisplayDate(end)}`;
    }

    case 'period': {
      const period = getBiweeklyPeriod(today);
      // Parse date strings using local timezone to avoid timezone conversion issues
      const [startYear, startMonth, startDay] = period.startDate.split('-').map(Number);
      const [endYear, endMonth, endDay] = period.endDate.split('-').map(Number);
      const start = new Date(startYear, startMonth - 1, startDay);
      const end = new Date(endYear, endMonth - 1, endDay);
      return `This Period: ${formatDisplayDate(start)} - ${formatDisplayDate(end)}`;
    }

    case 'month': {
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      return `This Month: ${months[today.getMonth()]} ${today.getFullYear()}`;
    }

    case 'year':
      return `This Year: ${today.getFullYear()}`;

    case 'custom': {
      if (dateRange) {
        // Parse date strings using local timezone to avoid timezone conversion issues
        const [startYear, startMonth, startDay] = dateRange.startDate.split('-').map(Number);
        const [endYear, endMonth, endDay] = dateRange.endDate.split('-').map(Number);
        const start = new Date(startYear, startMonth - 1, startDay);
        const end = new Date(endYear, endMonth - 1, endDay);
        return `Custom: ${formatDisplayDate(start)} - ${formatDisplayDate(end)}`;
      }
      return 'Custom Range';
    }

    default:
      return 'Select Period';
  }
}

export const timeFilterOptions: Array<{ value: TimeFilterType; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'period', label: 'This Period (Biweekly)' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' },
];
