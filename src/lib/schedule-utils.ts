import { Employee, WeeklySchedule, DayOfWeek, DaySchedule } from './supabase';

export function getDayOfWeek(dateString: string): DayOfWeek {
  const date = new Date(dateString);
  const dayIndex = date.getDay();
  const days: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[dayIndex];
}

export function isEmployeeAvailable(employee: Employee, dateString: string): boolean {
  if (!employee.weekly_schedule) {
    return true;
  }

  const dayOfWeek = getDayOfWeek(dateString);
  return employee.weekly_schedule[dayOfWeek]?.is_working === true;
}

export function filterAvailableEmployees(employees: Employee[], dateString: string): Employee[] {
  return employees.filter(employee => isEmployeeAvailable(employee, dateString));
}

export function getDefaultSchedule(): WeeklySchedule {
  const defaultDay: DaySchedule = {
    is_working: true,
    start_time: '09:00',
    end_time: '18:00',
  };

  return {
    monday: { ...defaultDay },
    tuesday: { ...defaultDay },
    wednesday: { ...defaultDay },
    thursday: { ...defaultDay },
    friday: { ...defaultDay },
    saturday: { ...defaultDay },
    sunday: { ...defaultDay },
  };
}

export function getWorkingDays(schedule: WeeklySchedule | undefined | null): DayOfWeek[] {
  if (!schedule) {
    return ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  }

  const days: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  return days.filter(day => schedule[day]?.is_working === true);
}

export function getAbbreviatedDayName(day: DayOfWeek): string {
  const abbreviations: Record<DayOfWeek, string> = {
    monday: 'M',
    tuesday: 'T',
    wednesday: 'W',
    thursday: 'Th',
    friday: 'F',
    saturday: 'Sa',
    sunday: 'Su',
  };
  return abbreviations[day];
}

export function getFullDayName(day: DayOfWeek): string {
  return day.charAt(0).toUpperCase() + day.slice(1);
}

export function getThreeLetterDayName(day: DayOfWeek): string {
  const threeLetter: Record<DayOfWeek, string> = {
    monday: 'Mon',
    tuesday: 'Tue',
    wednesday: 'Wed',
    thursday: 'Thu',
    friday: 'Fri',
    saturday: 'Sat',
    sunday: 'Sun',
  };
  return threeLetter[day];
}

export function formatScheduleDisplay(schedule: WeeklySchedule | undefined | null): string {
  const workingDays = getWorkingDays(schedule);
  if (workingDays.length === 7) {
    return 'All days';
  }
  if (workingDays.length === 0) {
    return 'No days';
  }
  return workingDays.map(getAbbreviatedDayName).join(' ');
}
