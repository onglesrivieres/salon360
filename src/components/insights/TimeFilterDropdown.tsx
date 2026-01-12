import { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import { TimeFilterType, timeFilterOptions, getFilterLabel, DateRange } from '../../lib/timeFilters';
import { Calendar } from '../ui/Calendar';
import { Button } from '../ui/Button';
import { getCurrentDateEST } from '../../lib/timezone';

interface TimeFilterDropdownProps {
  selectedFilter: TimeFilterType;
  onFilterChange: (filter: TimeFilterType) => void;
  customDateLabel?: string;
  onCustomDateApply: (range: DateRange) => void;
  customDateRange?: DateRange;
}

export function TimeFilterDropdown({
  selectedFilter,
  onFilterChange,
  customDateLabel,
  onCustomDateApply,
  customDateRange
}: TimeFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [tempStartDate, setTempStartDate] = useState('');
  const [tempEndDate, setTempEndDate] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowCalendar(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (showCalendar && customDateRange) {
      setTempStartDate(customDateRange.startDate);
      setTempEndDate(customDateRange.endDate);
    } else if (showCalendar) {
      const today = getCurrentDateEST();
      setTempStartDate(today);
      setTempEndDate(today);
    }
  }, [showCalendar, customDateRange]);

  const handleFilterSelect = (filter: TimeFilterType) => {
    if (filter === 'custom') {
      setShowCalendar(true);
    } else {
      onFilterChange(filter);
      setIsOpen(false);
      setShowCalendar(false);
    }
  };

  const handleDateRangeChange = (startDate: string, endDate: string) => {
    setTempStartDate(startDate);
    setTempEndDate(endDate);
  };

  const handleApplyCustomRange = () => {
    if (tempStartDate && tempEndDate) {
      onCustomDateApply({ startDate: tempStartDate, endDate: tempEndDate });
      setIsOpen(false);
      setShowCalendar(false);
    }
  };

  const handleCancelCustomRange = () => {
    setShowCalendar(false);
  };

  const displayLabel = selectedFilter === 'custom' && customDateLabel
    ? customDateLabel
    : getFilterLabel(selectedFilter);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <CalendarIcon className="w-4 h-4" />
        <span>{displayLabel}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          {!showCalendar ? (
            <div className="w-64 py-1">
              {timeFilterOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleFilterSelect(option.value)}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                    selectedFilter === option.value
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="w-80 p-4">
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-900">Select Date Range</h3>
                  <button
                    onClick={handleCancelCustomRange}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Back
                  </button>
                </div>
                {tempStartDate && tempEndDate && (
                  <div className="text-xs text-gray-600">
                    {new Date(tempStartDate).toLocaleDateString('en-US', { timeZone: 'America/New_York' })} - {new Date(tempEndDate).toLocaleDateString('en-US', { timeZone: 'America/New_York' })}
                  </div>
                )}
              </div>

              <Calendar
                selectedStartDate={tempStartDate}
                selectedEndDate={tempEndDate}
                onDateRangeChange={handleDateRangeChange}
              />

              <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200">
                <Button
                  variant="outline"
                  onClick={handleCancelCustomRange}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleApplyCustomRange}
                  className="flex-1"
                >
                  Apply
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
