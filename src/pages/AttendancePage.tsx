import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Download, Users } from 'lucide-react';
import { supabase, StoreAttendance } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { Permissions } from '../lib/permissions';
import { formatTimeEST, formatDateEST } from '../lib/timezone';

interface AttendanceSession {
  attendanceRecordId: string;
  checkInTime: string;
  checkOutTime?: string;
  totalHours?: number;
  status: string;
}

interface AttendanceSummary {
  [employeeId: string]: {
    employeeName: string;
    payType: string;
    dates: {
      [date: string]: AttendanceSession[];
    };
    totalHours: number;
    daysPresent: number;
  };
}

export function AttendancePage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [attendanceData, setAttendanceData] = useState<StoreAttendance[]>([]);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();
  const { session, selectedStoreId } = useAuth();

  useEffect(() => {
    if (selectedStoreId) {
      fetchAttendance();
    }
  }, [currentDate, selectedStoreId]);

  async function fetchAttendance() {
    if (!selectedStoreId) return;

    try {
      setLoading(true);
      const { startDate, endDate } = getDateRange();

      const isTechnician = session?.role_permission === 'Technician';

      const { data, error } = await supabase.rpc('get_store_attendance', {
        p_store_id: selectedStoreId,
        p_start_date: startDate,
        p_end_date: endDate,
        p_employee_id: isTechnician ? session?.employee_id : null
      });

      if (error) throw error;

      setAttendanceData(data || []);
    } catch (error: any) {
      console.error('Error fetching attendance:', error);
      showToast('Failed to load attendance data', 'error');
    } finally {
      setLoading(false);
    }
  }

  function getDateRange() {
    // Bi-weekly payroll periods starting from October 13, 2024 (Sunday)
    // This ensures periods align as: Oct 13-26, Oct 27-Nov 9, etc.
    // Which creates the pattern: Oct 12-25, Oct 26-Nov 8 for subsequent years
    const payrollStartDate = new Date(2024, 9, 13); // October 13, 2024

    // Normalize dates to midnight for accurate day calculation
    const normalizedCurrent = new Date(currentDate);
    normalizedCurrent.setHours(0, 0, 0, 0);

    const normalizedStart = new Date(payrollStartDate);
    normalizedStart.setHours(0, 0, 0, 0);

    const daysSinceStart = Math.floor((normalizedCurrent.getTime() - normalizedStart.getTime()) / (1000 * 60 * 60 * 24));
    const periodNumber = Math.floor(daysSinceStart / 14);

    const periodStart = new Date(normalizedStart);
    periodStart.setDate(periodStart.getDate() + (periodNumber * 14));

    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() + 13); // 14 days total (0-13)

    // Use local date formatting to avoid timezone conversion
    const formatLocalDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const startDate = formatLocalDate(periodStart);
    const endDate = formatLocalDate(periodEnd);
    return { startDate, endDate };
  }

  function getCalendarDays() {
    const { startDate, endDate } = getDateRange();

    // Parse dates properly to avoid timezone issues
    const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = endDate.split('-').map(Number);

    const start = new Date(startYear, startMonth - 1, startDay);
    const end = new Date(endYear, endMonth - 1, endDay);
    const days: Date[] = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d));
    }

    return days;
  }

  function processAttendanceData(): AttendanceSummary {
    const summary: AttendanceSummary = {};

    attendanceData.forEach((record) => {
      if (!summary[record.employee_id]) {
        summary[record.employee_id] = {
          employeeName: record.employee_name,
          payType: record.pay_type,
          dates: {},
          totalHours: 0,
          daysPresent: 0
        };
      }

      if (!summary[record.employee_id].dates[record.work_date]) {
        summary[record.employee_id].dates[record.work_date] = [];
      }

      summary[record.employee_id].dates[record.work_date].push({
        attendanceRecordId: record.attendance_record_id,
        checkInTime: record.check_in_time,
        checkOutTime: record.check_out_time,
        totalHours: record.total_hours,
        status: record.status
      });

      if (record.total_hours) {
        summary[record.employee_id].totalHours += record.total_hours;
      }
    });

    // Calculate days present (unique dates)
    Object.values(summary).forEach(employee => {
      employee.daysPresent = Object.keys(employee.dates).length;
    });

    return summary;
  }

  function navigatePrevious() {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 14);
    setCurrentDate(newDate);
  }

  function navigateNext() {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 14);
    setCurrentDate(newDate);
  }

  function navigateToday() {
    setCurrentDate(new Date());
  }

  function exportCSV() {
    const summary = processAttendanceData();
    const { startDate, endDate } = getDateRange();

    const headers = ['Employee', 'Date', 'Check In', 'Check Out', 'Hours', 'Status'];
    const rows: string[][] = [];

    Object.values(summary).forEach((employee) => {
      Object.entries(employee.dates).forEach(([date, sessions]) => {
        sessions.forEach((record) => {
          const checkIn = formatTimeEST(record.checkInTime);
          const checkOut = record.checkOutTime
            ? formatTimeEST(record.checkOutTime)
            : '';
          const hours = record.totalHours ? record.totalHours.toFixed(2) : '';

          rows.push([
            employee.employeeName,
          date,
          checkIn,
          checkOut,
          hours,
          record.status
          ]);
        });
      });
    });

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-${startDate}-to-${endDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    showToast('Attendance report exported successfully', 'success');
  }

  const calendarDays = getCalendarDays();
  const summary = processAttendanceData();
  const { startDate, endDate } = getDateRange();

  // Parse dates properly to avoid timezone issues
  const parseLocalDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const periodRange = `${formatDateEST(parseLocalDate(startDate), { month: 'short', day: 'numeric' })} - ${formatDateEST(parseLocalDate(endDate), { month: 'short', day: 'numeric', year: 'numeric' })}`;

  if (session && session.role && !Permissions.endOfDay.canView(session.role)) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-600">You don't have permission to view attendance records.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full mx-auto px-2">
      <div className="mb-2 flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
        <h2 className="text-sm md:text-base font-bold text-gray-900">Attendance Tracking</h2>
        {session && session.role && Permissions.endOfDay.canExport(session.role) && (
          <Button variant="secondary" size="sm" onClick={exportCSV}>
            <Download className="w-3 h-3 mr-1" />
            Export
          </Button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow mb-2">
        <div className="p-1.5 border-b border-gray-200 flex flex-col md:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={navigatePrevious} className="min-h-[44px] md:min-h-0 min-w-[44px] md:min-w-0 p-1">
              <ChevronLeft className="w-4 h-4 md:w-3.5 md:h-3.5" />
            </Button>
            <h3 className="text-xs md:text-sm font-semibold text-gray-900 min-w-[180px] text-center">
              {periodRange}
            </h3>
            <Button variant="ghost" size="sm" onClick={navigateNext} className="min-h-[44px] md:min-h-0 min-w-[44px] md:min-w-0 p-1">
              <ChevronRight className="w-4 h-4 md:w-3.5 md:h-3.5" />
            </Button>
          </div>
          <Button variant="secondary" size="sm" onClick={navigateToday} className="min-h-[44px] md:min-h-0 w-full md:w-auto text-xs">
            Today
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-sm text-gray-500">Loading attendance data...</div>
          </div>
        ) : Object.keys(summary).length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No attendance records for this period</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left p-1 text-[11px] font-semibold text-gray-900 sticky left-0 bg-white z-10 w-[70px] min-w-[70px] max-w-[70px]">
                    Employee
                  </th>
                  {calendarDays.map((day, index) => {
                    const isToday = day.toDateString() === new Date().toDateString();
                    return (
                      <th
                        key={index}
                        className={`text-center p-0.5 text-[10px] font-semibold w-[48px] min-w-[48px] max-w-[48px] ${
                          isToday
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-900'
                        }`}
                      >
                        <div className="text-[10px]">{day.toLocaleDateString('en-US', { weekday: 'narrow' })}</div>
                        <div className="text-xs font-bold">{day.getDate()}</div>
                      </th>
                    );
                  })}
                  <th className="text-right p-1 text-[11px] font-semibold text-gray-900 sticky right-0 bg-white z-10 w-[55px] min-w-[55px] max-w-[55px]">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(summary).map(([employeeId, employee]) => (
                  <tr key={employeeId} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-1 text-[11px] font-medium text-gray-900 sticky left-0 bg-white w-[70px] min-w-[70px] max-w-[70px]">
                      <div className="truncate" title={employee.employeeName}>
                        {employee.employeeName}
                      </div>
                    </td>
                    {calendarDays.map((day, index) => {
                      const dateStr = day.toISOString().split('T')[0];
                      const sessions = employee.dates[dateStr];
                      const isToday = day.toDateString() === new Date().toDateString();

                      return (
                        <td
                          key={index}
                          className={`p-0.5 text-center align-top w-[48px] min-w-[48px] max-w-[48px] ${
                            isToday ? 'bg-blue-50' : ''
                          }`}
                        >
                          {sessions && sessions.length > 0 ? (
                            <div className="space-y-0.5">
                              {sessions.map((record, sessionIdx) => (
                                <div
                                  key={sessionIdx}
                                  className={`relative group rounded p-0.5 ${
                                    record.status === 'checked_in'
                                      ? 'bg-green-500 animate-pulse'
                                      : 'bg-gray-200'
                                  }`}
                                >
                                  <div className="leading-tight">
                                    {sessions.length > 1 && (
                                      <div className={`text-[8px] font-semibold ${
                                        record.status === 'checked_in' ? 'text-white' : 'text-gray-600'
                                      }`}>
                                        S{sessionIdx + 1}
                                      </div>
                                    )}
                                    <div className={`text-[9px] ${
                                      record.status === 'checked_in' ? 'text-white' : 'text-gray-700'
                                    }`}>
                                      {formatTimeEST(record.checkInTime, {
                                        hour: 'numeric',
                                        minute: '2-digit',
                                        hour12: false
                                      })}
                                    </div>
                                    {record.checkOutTime && (
                                      <div className={`text-[9px] ${
                                        record.status === 'checked_in'
                                          ? 'text-white'
                                          : record.status === 'auto_checked_out'
                                          ? 'text-orange-600'
                                          : 'text-gray-700'
                                      }`}>
                                        {formatTimeEST(record.checkOutTime, {
                                          hour: 'numeric',
                                          minute: '2-digit',
                                          hour12: false
                                        })}
                                      </div>
                                    )}
                                    {record.totalHours && (
                                      <div className={`text-[9px] font-semibold ${
                                        record.status === 'checked_in' ? 'text-white' : 'text-gray-900'
                                      }`}>
                                        {record.totalHours.toFixed(1)}h
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-gray-300 text-[10px]">-</div>
                          )}
                        </td>
                      );
                    })}
                    <td className="p-1 text-right text-[11px] font-bold text-gray-900 sticky right-0 bg-white w-[55px] min-w-[55px] max-w-[55px]">
                      <div>{employee.totalHours.toFixed(1)}h</div>
                      <div className="text-[9px] font-normal text-gray-500">
                        {employee.daysPresent}d
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-3">
        <h3 className="text-xs font-semibold text-gray-900 mb-2">Legend</h3>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-10 h-6 bg-green-500 animate-pulse rounded"></div>
            <span className="text-[10px] text-gray-600">Currently checked in</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-10 h-6 bg-gray-200 rounded"></div>
            <span className="text-[10px] text-gray-600">Checked out</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-10 h-6 bg-gray-200 rounded flex items-center justify-center">
              <span className="text-[9px] font-medium text-orange-600">12:00</span>
            </div>
            <span className="text-[10px] text-gray-600">Auto check-out time</span>
          </div>
        </div>
      </div>
    </div>
  );
}
