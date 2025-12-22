import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarProps {
  selectedStartDate?: string;
  selectedEndDate?: string;
  onDateRangeChange: (startDate: string, endDate: string) => void;
  maxDate?: Date;
}

export function Calendar({ selectedStartDate, selectedEndDate, onDateRangeChange, maxDate }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (selectedStartDate) {
      const [year, month] = selectedStartDate.split('-').map(Number);
      return new Date(year, month - 1, 1);
    }
    return new Date();
  });

  const [tempStartDate, setTempStartDate] = useState<string | null>(selectedStartDate || null);
  const [tempEndDate, setTempEndDate] = useState<string | null>(selectedEndDate || null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const formatDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getDaysInMonth = (date: Date): Date[] => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: Date[] = [];

    const startDay = firstDay.getDay();
    for (let i = 0; i < startDay; i++) {
      const prevDate = new Date(year, month, -i);
      days.unshift(prevDate);
    }

    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(new Date(year, month, day));
    }

    const endDay = lastDay.getDay();
    for (let i = 1; i < 7 - endDay; i++) {
      days.push(new Date(year, month + 1, i));
    }

    return days;
  };

  const handleDateClick = (date: Date) => {
    const dateString = formatDateString(date);

    if (!tempStartDate || (tempStartDate && tempEndDate)) {
      setTempStartDate(dateString);
      setTempEndDate(null);
      onDateRangeChange(dateString, dateString);
    } else {
      const start = new Date(tempStartDate);
      if (date < start) {
        setTempStartDate(dateString);
        setTempEndDate(tempStartDate);
        onDateRangeChange(dateString, tempStartDate);
      } else {
        setTempEndDate(dateString);
        onDateRangeChange(tempStartDate, dateString);
      }
    }
  };

  const isInRange = (date: Date): boolean => {
    if (!tempStartDate || !tempEndDate) return false;
    const start = new Date(tempStartDate);
    const end = new Date(tempEndDate);
    return date >= start && date <= end;
  };

  const isStartDate = (date: Date): boolean => {
    if (!tempStartDate) return false;
    return formatDateString(date) === tempStartDate;
  };

  const isEndDate = (date: Date): boolean => {
    if (!tempEndDate) return false;
    return formatDateString(date) === tempEndDate;
  };

  const isToday = (date: Date): boolean => {
    return formatDateString(date) === formatDateString(today);
  };

  const isCurrentMonth = (date: Date): boolean => {
    return date.getMonth() === currentMonth.getMonth();
  };

  const isDisabled = (date: Date): boolean => {
    if (maxDate) {
      return date > maxDate;
    }
    return date > today;
  };

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
    const todayString = formatDateString(today);
    setTempStartDate(todayString);
    setTempEndDate(todayString);
    onDateRangeChange(todayString, todayString);
  };

  const days = getDaysInMonth(currentMonth);
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={previousMonth}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          type="button"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>

        <div className="font-semibold text-gray-900">
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </div>

        <button
          onClick={nextMonth}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          type="button"
        >
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {dayNames.map((day) => (
          <div key={day} className="text-center text-xs font-medium text-gray-500 py-1">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((date, index) => {
          const inRange = isInRange(date);
          const start = isStartDate(date);
          const end = isEndDate(date);
          const todayDate = isToday(date);
          const currentMonthDate = isCurrentMonth(date);
          const disabled = isDisabled(date);

          return (
            <button
              key={index}
              onClick={() => !disabled && handleDateClick(date)}
              disabled={disabled}
              type="button"
              className={`
                relative h-9 text-sm rounded transition-colors
                ${!currentMonthDate ? 'text-gray-300' : 'text-gray-900'}
                ${disabled ? 'cursor-not-allowed opacity-40' : 'hover:bg-gray-100 cursor-pointer'}
                ${inRange && !start && !end ? 'bg-blue-50' : ''}
                ${start || end ? 'bg-blue-600 text-white hover:bg-blue-700' : ''}
                ${todayDate && !start && !end ? 'border border-blue-600 font-semibold' : ''}
              `}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-gray-200">
        <button
          onClick={goToToday}
          type="button"
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          Go to Today
        </button>
      </div>
    </div>
  );
}
