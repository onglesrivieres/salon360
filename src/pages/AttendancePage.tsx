import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Download, Users } from "lucide-react";
import { supabase, StoreAttendance } from "../lib/supabase";
import { Button } from "../components/ui/Button";
import { useToast } from "../components/ui/Toast";
import { useAuth } from "../contexts/AuthContext";
import { Permissions } from "../lib/permissions";
import {
  formatTimeEST,
  formatDateEST,
  formatDateISOEST,
  getCurrentDateEST,
} from "../lib/timezone";
import { ShiftDetailModal } from "../components/ShiftDetailModal";

const OT_THRESHOLD_HOURS = 8;

interface AttendanceSession {
  attendanceRecordId: string;
  checkInTime: string;
  checkOutTime?: string;
  totalHours?: number;
  status: string;
  storeCode: string;
  hasPendingProposal?: boolean;
}

interface DailyHoursSummary {
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
}

function calculateOvertimeHours(totalHours: number): {
  regularHours: number;
  overtimeHours: number;
} {
  if (!totalHours || totalHours <= 0) {
    return { regularHours: 0, overtimeHours: 0 };
  }
  if (totalHours <= OT_THRESHOLD_HOURS) {
    return { regularHours: totalHours, overtimeHours: 0 };
  }
  return {
    regularHours: OT_THRESHOLD_HOURS,
    overtimeHours: totalHours - OT_THRESHOLD_HOURS,
  };
}

interface AttendanceSummary {
  [employeeId: string]: {
    employeeName: string;
    payType: string;
    countOt: boolean;
    dates: {
      [date: string]: AttendanceSession[];
    };
    totalHours: number;
    totalRegularHours: number;
    totalOvertimeHours: number;
    dailyHours: {
      [date: string]: DailyHoursSummary;
    };
    daysPresent: number;
    isMultiStore: boolean;
  };
}

function getStoreColor(storeCode: string): string {
  const codeMap: Record<string, string> = {
    OM: "M",
    OC: "C",
    OR: "R",
  };
  const abbrev = codeMap[storeCode] || storeCode;
  switch (abbrev) {
    case "M":
      return "text-pink-600";
    case "C":
      return "text-green-600";
    case "R":
      return "text-blue-600";
    default:
      return "text-gray-600";
  }
}

interface AttendancePageProps {
  currentDate: Date;
  onCurrentDateChange: (date: Date) => void;
}

export function AttendancePage({
  currentDate,
  onCurrentDateChange,
}: AttendancePageProps) {
  const [attendanceData, setAttendanceData] = useState<StoreAttendance[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAttendance, setSelectedAttendance] =
    useState<StoreAttendance | null>(null);
  const [isShiftDetailModalOpen, setIsShiftDetailModalOpen] = useState(false);
  const [employeePayType, setEmployeePayType] = useState<
    "hourly" | "daily" | "commission" | null
  >(null);
  const [employeeCountOtMap, setEmployeeCountOtMap] = useState<
    Record<string, boolean>
  >({});
  const { showToast } = useToast();
  const { session, selectedStoreId, t } = useAuth();

  useEffect(() => {
    if (selectedStoreId) {
      fetchAttendance();
    }
  }, [currentDate, selectedStoreId]);

  useEffect(() => {
    async function fetchEmployeePayType() {
      if (!session?.employee_id) return;
      const { data } = await supabase
        .from("employees")
        .select("pay_type")
        .eq("id", session.employee_id)
        .maybeSingle();
      if (data) {
        setEmployeePayType(data.pay_type);
      }
    }
    fetchEmployeePayType();
  }, [session?.employee_id]);

  async function fetchAttendance() {
    if (!selectedStoreId) return;

    try {
      setLoading(true);
      const { startDate, endDate } = getDateRange();

      const isRestrictedRole =
        session?.role_permission === "Technician" ||
        session?.role_permission === "Receptionist" ||
        session?.role_permission === "Supervisor" ||
        session?.role_permission === "Cashier";

      const { data, error } = await supabase.rpc("get_store_attendance", {
        p_store_id: selectedStoreId,
        p_start_date: startDate,
        p_end_date: endDate,
        p_employee_id: isRestrictedRole ? session?.employee_id : null,
      });

      if (error) throw error;

      setAttendanceData(data || []);

      // Fetch count_ot values for all employees in the attendance data
      if (data && data.length > 0) {
        const employeeIds = [
          ...new Set(data.map((r: StoreAttendance) => r.employee_id)),
        ];
        const { data: employeesData } = await supabase
          .from("employees")
          .select("id, count_ot")
          .in("id", employeeIds);

        if (employeesData) {
          const countOtMap: Record<string, boolean> = {};
          employeesData.forEach(
            (emp: { id: string; count_ot: boolean | null }) => {
              countOtMap[emp.id] = emp.count_ot ?? true; // Default to true if not set
            },
          );
          setEmployeeCountOtMap(countOtMap);
        }
      }
    } catch (error: any) {
      console.error("Error fetching attendance:", error);
      showToast(t("attendance.failedToLoad"), "error");
    } finally {
      setLoading(false);
    }
  }

  function getStoreCodeAbbreviation(storeCode: string): string {
    const codeMap: Record<string, string> = {
      OM: "M",
      OC: "C",
      OR: "R",
    };
    return codeMap[storeCode] || storeCode;
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

    const daysSinceStart = Math.floor(
      (normalizedCurrent.getTime() - normalizedStart.getTime()) /
        (1000 * 60 * 60 * 24),
    );
    const periodNumber = Math.floor(daysSinceStart / 14);

    const periodStart = new Date(normalizedStart);
    periodStart.setDate(periodStart.getDate() + periodNumber * 14);

    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() + 13); // 14 days total (0-13)

    const startDate = formatDateISOEST(periodStart);
    const endDate = formatDateISOEST(periodEnd);
    return { startDate, endDate };
  }

  function getCalendarDays() {
    const { startDate, endDate } = getDateRange();

    // Parse dates properly to avoid timezone issues
    const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
    const [endYear, endMonth, endDay] = endDate.split("-").map(Number);

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
          countOt: employeeCountOtMap[record.employee_id] ?? true,
          dates: {},
          totalHours: 0,
          totalRegularHours: 0,
          totalOvertimeHours: 0,
          dailyHours: {},
          daysPresent: 0,
          isMultiStore: false,
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
        status: record.status,
        storeCode: record.store_code,
        hasPendingProposal: record.has_pending_proposal,
      });

      if (record.total_hours) {
        summary[record.employee_id].totalHours += record.total_hours;
      }
    });

    // Calculate days present, daily hours, OT, and multi-store status for each employee
    Object.values(summary).forEach((employee) => {
      employee.daysPresent = Object.keys(employee.dates).length;

      // Detect if employee works at multiple stores
      const uniqueStores = new Set<string>();
      Object.values(employee.dates).forEach((sessions) => {
        sessions.forEach((s) => uniqueStores.add(s.storeCode));
      });
      employee.isMultiStore = uniqueStores.size > 1;

      // Calculate daily hours and OT for hourly employees (only when countOt is enabled)
      Object.entries(employee.dates).forEach(([date, sessions]) => {
        const dailyTotal = sessions.reduce(
          (sum, s) => sum + (s.totalHours || 0),
          0,
        );

        if (employee.payType === "hourly" && employee.countOt) {
          // Hourly with OT counting enabled - calculate regular vs overtime
          const { regularHours, overtimeHours } =
            calculateOvertimeHours(dailyTotal);
          employee.dailyHours[date] = {
            totalHours: dailyTotal,
            regularHours,
            overtimeHours,
          };
          employee.totalRegularHours += regularHours;
          employee.totalOvertimeHours += overtimeHours;
        } else {
          // For non-hourly or when countOt is disabled, all hours are combined
          employee.dailyHours[date] = {
            totalHours: dailyTotal,
            regularHours: dailyTotal,
            overtimeHours: 0,
          };
          employee.totalRegularHours += dailyTotal;
        }
      });
    });

    return summary;
  }

  function groupByPayType(summary: AttendanceSummary): {
    hourly: [string, AttendanceSummary[string]][];
    daily: [string, AttendanceSummary[string]][];
    commission: [string, AttendanceSummary[string]][];
  } {
    const hourly: [string, AttendanceSummary[string]][] = [];
    const daily: [string, AttendanceSummary[string]][] = [];
    const commission: [string, AttendanceSummary[string]][] = [];

    Object.entries(summary).forEach(([employeeId, employee]) => {
      if (employee.payType === "hourly") {
        hourly.push([employeeId, employee]);
      } else if (employee.payType === "daily") {
        daily.push([employeeId, employee]);
      } else if (employee.payType === "commission") {
        commission.push([employeeId, employee]);
      }
    });

    return { hourly, daily, commission };
  }

  function navigatePrevious() {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 14);
    onCurrentDateChange(newDate);
  }

  function isCurrentOrFuturePeriod(): boolean {
    const todayStr = getCurrentDateEST();
    const [y, m, d] = todayStr.split("-").map(Number);
    const todayDate = new Date(y, m - 1, d);

    const payrollStartDate = new Date(2024, 9, 13);
    payrollStartDate.setHours(0, 0, 0, 0);

    const normalizedCurrent = new Date(currentDate);
    normalizedCurrent.setHours(0, 0, 0, 0);
    todayDate.setHours(0, 0, 0, 0);

    const currentPeriod = Math.floor(
      (normalizedCurrent.getTime() - payrollStartDate.getTime()) /
        (1000 * 60 * 60 * 24 * 14),
    );
    const todayPeriod = Math.floor(
      (todayDate.getTime() - payrollStartDate.getTime()) /
        (1000 * 60 * 60 * 24 * 14),
    );

    return currentPeriod >= todayPeriod;
  }

  function navigateNext() {
    if (isCurrentOrFuturePeriod()) return;
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 14);
    onCurrentDateChange(newDate);
  }

  function navigateToday() {
    onCurrentDateChange(new Date());
  }

  function handleShiftClick(
    record: AttendanceSession,
    employeeId: string,
    employeeName: string,
    workDate: string,
    payType: string,
  ) {
    const isRestrictedRole =
      session?.role_permission === "Technician" ||
      session?.role_permission === "Receptionist" ||
      session?.role_permission === "Cashier";

    if (isRestrictedRole && session?.employee_id !== employeeId) {
      return;
    }

    const attendanceRecord: StoreAttendance = {
      attendance_record_id: record.attendanceRecordId,
      employee_id: employeeId,
      employee_name: employeeName,
      work_date: workDate,
      check_in_time: record.checkInTime,
      check_out_time: record.checkOutTime,
      total_hours: record.totalHours,
      status: record.status,
      pay_type: payType,
      store_code: record.storeCode,
      has_pending_proposal: record.hasPendingProposal,
    };

    setSelectedAttendance(attendanceRecord);
    setIsShiftDetailModalOpen(true);
  }

  function handleProposalSubmitted() {
    fetchAttendance();
  }

  function exportCSV() {
    const summary = processAttendanceData();
    const { startDate, endDate } = getDateRange();

    const headers = [
      "Employee",
      "Pay Type",
      "Date",
      "Store",
      "Check In",
      "Check Out",
      "Total Hours",
      "Regular Hours",
      "OT Hours",
      "Status",
    ];
    const rows: string[][] = [];

    Object.values(summary).forEach((employee) => {
      Object.entries(employee.dates).forEach(([date, sessions]) => {
        const dailyHoursSummary = employee.dailyHours[date];
        sessions.forEach((record, idx) => {
          const checkIn = formatTimeEST(record.checkInTime);
          const checkOut = record.checkOutTime
            ? formatTimeEST(record.checkOutTime)
            : "";
          const hours = record.totalHours ? record.totalHours.toFixed(2) : "";
          const store = getStoreCodeAbbreviation(record.storeCode);

          // Only show daily regular/OT hours on the first session of the day
          const regularHours =
            idx === 0 && dailyHoursSummary
              ? dailyHoursSummary.regularHours.toFixed(2)
              : "";
          const otHours =
            idx === 0 && dailyHoursSummary && employee.payType === "hourly"
              ? dailyHoursSummary.overtimeHours.toFixed(2)
              : "0";

          rows.push([
            employee.employeeName,
            employee.payType,
            date,
            store,
            checkIn,
            checkOut,
            hours,
            regularHours,
            otHours,
            record.status,
          ]);
        });
      });
    });

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${startDate}-to-${endDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    showToast(t("attendance.exportedSuccess"), "success");
  }

  const calendarDays = getCalendarDays();
  const summary = processAttendanceData();
  const hasOvertimeEmployees = Object.values(summary).some(
    (employee) => employee.payType === "hourly" && employee.countOt,
  );
  const { startDate, endDate } = getDateRange();

  // Parse dates properly to avoid timezone issues
  const parseLocalDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  const periodRange = `${formatDateEST(parseLocalDate(startDate), { month: "short", day: "numeric" })} - ${formatDateEST(parseLocalDate(endDate), { month: "short", day: "numeric", year: "numeric" })}`;

  // Check if this is an individual employee view (not management)
  const isRestrictedRole =
    session?.role_permission === "Technician" ||
    session?.role_permission === "Receptionist" ||
    session?.role_permission === "Cashier";
  if (
    session &&
    session.role &&
    !Permissions.attendance.canView(session.role, employeePayType || undefined)
  ) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-600">{t("attendance.noPermission")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full mx-auto px-2">
      <div className="mb-2 flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
        <h2 className="text-sm md:text-base font-bold text-gray-900">
          {t("attendance.tracking")}
        </h2>
        <div className="flex items-center gap-2">
          {session &&
            session.role &&
            Permissions.endOfDay.canExport(session.role) && (
              <Button variant="secondary" size="sm" onClick={exportCSV}>
                <Download className="w-3 h-3 mr-1" />
                {t("attendance.export")}
              </Button>
            )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow mb-2">
        <div className="p-1.5 border-b border-gray-200 flex flex-col md:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={navigatePrevious}
              className="min-h-[44px] md:min-h-0 min-w-[44px] md:min-w-0 p-1"
            >
              <ChevronLeft className="w-4 h-4 md:w-3.5 md:h-3.5" />
            </Button>
            <h3 className="text-xs md:text-sm font-semibold text-gray-900 min-w-[180px] text-center">
              {periodRange}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={navigateNext}
              className={`min-h-[44px] md:min-h-0 min-w-[44px] md:min-w-0 p-1 ${isCurrentOrFuturePeriod() ? "invisible" : ""}`}
            >
              <ChevronRight className="w-4 h-4 md:w-3.5 md:h-3.5" />
            </Button>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={navigateToday}
            className="min-h-[44px] md:min-h-0 w-full md:w-auto text-xs"
          >
            {t("common.today")}
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-sm text-gray-500">{t("common.loading")}</div>
          </div>
        ) : Object.keys(summary).length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-500">
              {t("attendance.noRecordsPeriod")}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left p-1 text-[11px] font-semibold text-gray-900 sticky left-0 bg-white z-10 w-[70px] min-w-[70px] max-w-[70px]">
                    {t("attendance.employee")}
                  </th>
                  {calendarDays.map((day, index) => {
                    const isToday =
                      formatDateISOEST(day) === formatDateISOEST(new Date());
                    return (
                      <th
                        key={index}
                        className={`text-center p-0.5 text-[10px] font-semibold w-[48px] min-w-[48px] max-w-[48px] ${
                          isToday ? "bg-blue-50 text-blue-700" : "text-gray-900"
                        }`}
                      >
                        <div className="text-[10px]">
                          {day.toLocaleDateString("en-US", {
                            weekday: "narrow",
                            timeZone: "America/New_York",
                          })}
                        </div>
                        <div className="text-xs font-bold">{day.getDate()}</div>
                      </th>
                    );
                  })}
                  <th className="text-right p-1 text-[11px] font-semibold text-gray-900 sticky right-0 bg-white z-10 w-[55px] min-w-[55px] max-w-[55px]">
                    {t("attendance.total")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const { hourly, daily, commission } = groupByPayType(summary);

                  const renderEmployeeRow = ([employeeId, employee]: [
                    string,
                    AttendanceSummary[string],
                  ]) => (
                    <tr
                      key={employeeId}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="p-1 text-[11px] font-medium text-gray-900 sticky left-0 bg-white w-[70px] min-w-[70px] max-w-[70px]">
                        <div className="truncate" title={employee.employeeName}>
                          {employee.employeeName}
                        </div>
                      </td>
                      {calendarDays.map((day, index) => {
                        const dateStr = formatDateISOEST(day);
                        const sessions = employee.dates[dateStr];
                        const dailyHoursSummary = employee.dailyHours[dateStr];
                        const isToday =
                          formatDateISOEST(day) ===
                          formatDateISOEST(new Date());

                        return (
                          <td
                            key={index}
                            className={`p-0.5 text-center align-top w-[48px] min-w-[48px] max-w-[48px] ${
                              isToday ? "bg-blue-50" : ""
                            }`}
                          >
                            {sessions && sessions.length > 0 ? (
                              <div className="space-y-0.5">
                                {sessions.map((record, sessionIdx) => {
                                  const isClickable = isRestrictedRole
                                    ? employeeId === session?.employee_id
                                    : true;

                                  return (
                                    <div
                                      key={sessionIdx}
                                      onClick={() =>
                                        isClickable &&
                                        handleShiftClick(
                                          record,
                                          employeeId,
                                          employee.employeeName,
                                          dateStr,
                                          employee.payType,
                                        )
                                      }
                                      className={`relative group rounded p-0.5 transition-opacity ${
                                        record.hasPendingProposal
                                          ? "bg-yellow-100 animate-pulse cursor-pointer hover:opacity-80"
                                          : record.status === "checked_in"
                                            ? "bg-green-500 animate-pulse"
                                            : "bg-gray-200"
                                      } ${isClickable ? "cursor-pointer hover:opacity-80" : ""}`}
                                    >
                                      <div className="leading-tight">
                                        {employee.isMultiStore && (
                                          <div
                                            className={`text-[7px] font-medium ${getStoreColor(record.storeCode)}`}
                                          >
                                            [
                                            {getStoreCodeAbbreviation(
                                              record.storeCode,
                                            )}
                                            ]
                                          </div>
                                        )}
                                        <div
                                          className={`text-[9px] ${
                                            record.status === "checked_in"
                                              ? "text-white"
                                              : record.hasPendingProposal
                                                ? "text-yellow-900"
                                                : "text-gray-700"
                                          }`}
                                        >
                                          {formatTimeEST(record.checkInTime, {
                                            hour: "numeric",
                                            minute: "2-digit",
                                            hour12: false,
                                          })}
                                        </div>
                                        {record.checkOutTime && (
                                          <div
                                            className={`text-[9px] ${
                                              record.status === "checked_in"
                                                ? "text-white"
                                                : record.hasPendingProposal
                                                  ? "text-yellow-900"
                                                  : record.status ===
                                                      "auto_checked_out"
                                                    ? "text-orange-600"
                                                    : "text-gray-700"
                                            }`}
                                          >
                                            {formatTimeEST(
                                              record.checkOutTime,
                                              {
                                                hour: "numeric",
                                                minute: "2-digit",
                                                hour12: false,
                                              },
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                                {/* Daily hours summary for hourly employees */}
                                {dailyHoursSummary &&
                                  employee.payType === "hourly" && (
                                    <div className="text-[9px] font-semibold text-gray-900 border-t border-gray-300 pt-0.5 mt-0.5">
                                      {employee.countOt &&
                                      dailyHoursSummary.overtimeHours > 0 ? (
                                        <>
                                          <div>
                                            {dailyHoursSummary.regularHours.toFixed(
                                              2,
                                            )}
                                          </div>
                                          <div className="text-orange-600">
                                            +
                                            {dailyHoursSummary.overtimeHours.toFixed(
                                              2,
                                            )}{" "}
                                            OT
                                          </div>
                                        </>
                                      ) : (
                                        <span>
                                          {dailyHoursSummary.totalHours.toFixed(
                                            2,
                                          )}
                                        </span>
                                      )}
                                    </div>
                                  )}
                              </div>
                            ) : (
                              <div className="text-gray-300 text-[10px]">-</div>
                            )}
                          </td>
                        );
                      })}
                      <td className="p-1 text-right text-[11px] font-bold text-gray-900 sticky right-0 bg-white w-[55px] min-w-[55px] max-w-[55px]">
                        {employee.payType === "daily" ? (
                          // Daily employees - only show days present
                          <div>{employee.daysPresent}d</div>
                        ) : employee.payType === "hourly" ? (
                          // Hourly employees - show hours with OT breakdown if countOt is enabled
                          <div>
                            {employee.countOt ? (
                              <>
                                <div>
                                  {employee.totalRegularHours.toFixed(2)}
                                </div>
                                {employee.totalOvertimeHours > 0 && (
                                  <div className="text-orange-600 text-[10px]">
                                    +{employee.totalOvertimeHours.toFixed(2)} OT
                                  </div>
                                )}
                              </>
                            ) : (
                              <div>{employee.totalHours.toFixed(2)}</div>
                            )}
                          </div>
                        ) : (
                          // Commission employees - show days only
                          <div>{employee.daysPresent}d</div>
                        )}
                      </td>
                    </tr>
                  );

                  return (
                    <>
                      {/* Hourly Employees Section */}
                      {hourly.length > 0 && (
                        <>
                          <tr className="bg-gray-100">
                            <td
                              colSpan={calendarDays.length + 2}
                              className="p-1 text-xs font-bold text-gray-700"
                            >
                              {t("attendance.hourlyEmployees")}
                            </td>
                          </tr>
                          {hourly.map(renderEmployeeRow)}
                        </>
                      )}
                      {/* Daily Employees Section */}
                      {daily.length > 0 && (
                        <>
                          <tr className="bg-gray-100">
                            <td
                              colSpan={calendarDays.length + 2}
                              className="p-1 text-xs font-bold text-gray-700"
                            >
                              {t("attendance.dailyEmployees")}
                            </td>
                          </tr>
                          {daily.map(renderEmployeeRow)}
                        </>
                      )}
                      {/* Commission Employees Section */}
                      {commission.length > 0 && (
                        <>
                          <tr className="bg-gray-100">
                            <td
                              colSpan={calendarDays.length + 2}
                              className="p-1 text-xs font-bold text-gray-700"
                            >
                              {t("attendance.commissionEmployees")}
                            </td>
                          </tr>
                          {commission.map(renderEmployeeRow)}
                        </>
                      )}
                    </>
                  );
                })()}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-3">
        <h3 className="text-xs font-semibold text-gray-900 mb-2">
          {t("attendance.legend")}
        </h3>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-10 h-6 bg-green-500 animate-pulse rounded"></div>
            <span className="text-[10px] text-gray-600">
              {t("attendance.currentlyCheckedIn")}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-10 h-6 bg-yellow-100 animate-pulse rounded"></div>
            <span className="text-[10px] text-gray-600">
              {t("attendance.pendingChangeRequest")}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-10 h-6 bg-gray-200 rounded"></div>
            <span className="text-[10px] text-gray-600">
              {t("attendance.checkedOut")}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-10 h-6 bg-gray-200 rounded flex items-center justify-center">
              <span className="text-[9px] font-medium text-orange-600">
                12:00
              </span>
            </div>
            <span className="text-[10px] text-gray-600">
              {t("attendance.autoCheckOutTime")}
            </span>
          </div>
          {hasOvertimeEmployees && (
            <div className="flex items-center gap-1.5">
              <div className="w-14 h-8 bg-gray-100 rounded flex flex-col items-center justify-center border border-gray-300">
                <span className="text-[7px] font-semibold">8.00</span>
                <span className="text-[7px] font-semibold text-orange-600">
                  +1.50 OT
                </span>
              </div>
              <span className="text-[10px] text-gray-600">
                {t("attendance.overtime")}
              </span>
            </div>
          )}
        </div>
      </div>

      <ShiftDetailModal
        isOpen={isShiftDetailModalOpen}
        onClose={() => setIsShiftDetailModalOpen(false)}
        attendance={selectedAttendance}
        onProposalSubmitted={handleProposalSubmitted}
      />
    </div>
  );
}
