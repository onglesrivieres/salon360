import React from 'react';

interface WeeklyCalendarViewProps {
  selectedDate: string;
  weeklyData: Map<string, Map<string, { tips_cash: number; tips_card: number; tips_total: number }>>;
  summaries: Array<{
    technician_id: string;
    technician_name: string;
    tips_cash: number;
    tips_card: number;
    tips_total: number;
  }>;
}

function getWeekStartDate(date: string): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

function getWeekDates(startDate: string): string[] {
  const dates: string[] = [];
  const d = new Date(startDate);
  for (let i = 0; i < 7; i++) {
    dates.push(d.toISOString().split('T')[0]);
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

function formatDateHeader(dateStr: string): { day: string; date: string } {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const day = days[d.getDay()];
  const date = `${d.getMonth() + 1}/${d.getDate()}`;
  return { day, date };
}

export function WeeklyCalendarView({ selectedDate, weeklyData, summaries }: WeeklyCalendarViewProps) {
  const weekStart = getWeekStartDate(selectedDate);
  const weekDates = getWeekDates(weekStart);

  console.log('WeeklyCalendarView render:', {
    selectedDate,
    weekStart,
    weekDates,
    weeklyDataSize: weeklyData.size,
    summariesCount: summaries.length,
    weeklyDataKeys: Array.from(weeklyData.keys())
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse min-w-[800px]">
        <thead>
          <tr>
            <th className="border border-gray-300 bg-gray-100 p-2 text-left font-semibold text-sm sticky left-0 z-10">
              Technician
            </th>
            {weekDates.map((date) => {
              const { day, date: dateStr } = formatDateHeader(date);
              return (
                <th
                  key={date}
                  className="border border-gray-300 bg-gray-100 p-2 text-center font-semibold text-sm min-w-[120px]"
                >
                  <div className="font-bold">{day}</div>
                  <div className="text-xs text-gray-600">{dateStr}</div>
                </th>
              );
            })}
            <th className="border border-gray-300 bg-blue-100 p-2 text-center font-semibold text-sm min-w-[120px]">
              <div className="font-bold">Week Total</div>
            </th>
          </tr>
        </thead>
        <tbody>
          {summaries.map((summary) => {
            const techData = weeklyData.get(summary.technician_id);

            return (
              <tr key={summary.technician_id}>
                <td className="border border-gray-300 bg-gray-50 p-2 font-medium text-sm sticky left-0 z-10">
                  {summary.technician_name}
                </td>
                {weekDates.map((date) => {
                  const dayData = techData?.get(date);
                  const hasTips = dayData && dayData.tips_total > 0;

                  return (
                    <td
                      key={date}
                      className={`border border-gray-300 p-2 text-center text-xs ${
                        hasTips ? 'bg-white' : 'bg-gray-50'
                      }`}
                    >
                      {hasTips ? (
                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Cash:</span>
                            <span className="font-semibold text-green-600">
                              ${dayData.tips_cash.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Card:</span>
                            <span className="font-semibold text-blue-600">
                              ${dayData.tips_card.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center pt-1 border-t border-gray-200">
                            <span className="text-gray-900 font-medium">Total:</span>
                            <span className="font-bold text-gray-900">
                              ${dayData.tips_total.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  );
                })}
                <td className="border border-gray-300 bg-blue-50 p-2 text-center text-xs">
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Cash:</span>
                      <span className="font-semibold text-green-600">
                        ${summary.tips_cash.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Card:</span>
                      <span className="font-semibold text-blue-600">
                        ${summary.tips_card.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-gray-900">
                      <span className="text-gray-900 font-medium">Total:</span>
                      <span className="font-bold text-gray-900">
                        ${summary.tips_total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
