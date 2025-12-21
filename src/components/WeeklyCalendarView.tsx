import React, { useState } from 'react';
import { Info } from 'lucide-react';

interface WeeklyCalendarViewProps {
  selectedDate: string;
  weeklyData: Map<string, Map<string, Array<{ store_id: string; store_code: string; tips_cash: number; tips_card: number; tips_total: number }>>>;
  summaries: Array<{
    technician_id: string;
    technician_name: string;
    tips_cash: number;
    tips_card: number;
    tips_total: number;
  }>;
}

function abbreviateStoreName(storeCode: string): string {
  const codeMap: Record<string, string> = {
    'OM': 'M',
    'OC': 'C',
    'OR': 'R',
  };
  return codeMap[storeCode.toUpperCase()] || storeCode.substring(0, 1).toUpperCase();
}

function getWeekStartDate(date: string): string {
  const d = new Date(date + 'T00:00:00');
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

function getWeekDates(startDate: string): string[] {
  const dates: string[] = [];
  const d = new Date(startDate + 'T00:00:00');
  for (let i = 0; i < 7; i++) {
    dates.push(d.toISOString().split('T')[0]);
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

function formatDateHeader(dateStr: string): { day: string; date: string } {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const day = days[d.getDay()];
  const date = `${d.getMonth() + 1}/${d.getDate()}`;
  return { day, date };
}

export function WeeklyCalendarView({ selectedDate, weeklyData, summaries }: WeeklyCalendarViewProps) {
  const weekStart = getWeekStartDate(selectedDate);
  const weekDates = getWeekDates(weekStart);
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <div className="inline-block min-w-full align-middle px-4 sm:px-0">
        <table className="min-w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="border border-gray-300 bg-gray-100 px-1.5 py-1 text-left font-semibold sticky left-0 z-10 w-20 sm:w-24">
                <div className="truncate">Tech</div>
              </th>
              {weekDates.map((date) => {
                const { day, date: dateStr } = formatDateHeader(date);
                return (
                  <th
                    key={date}
                    className="border border-gray-300 bg-gray-100 px-1 py-1 text-center font-semibold w-[72px] sm:w-20"
                  >
                    <div className="font-bold text-[10px] sm:text-xs">{day}</div>
                    <div className="text-[9px] sm:text-[10px] text-gray-600">{dateStr}</div>
                  </th>
                );
              })}
              <th className="border border-gray-300 bg-blue-100 px-1 py-1 text-center font-semibold w-[72px] sm:w-20 relative">
                <div className="flex items-center justify-center gap-1">
                  <div className="font-bold text-[10px] sm:text-xs">Weekly Total</div>
                  <div
                    className="relative"
                    onMouseEnter={() => setShowTooltip(true)}
                    onMouseLeave={() => setShowTooltip(false)}
                  >
                    <Info className="w-3 h-3 text-blue-600 cursor-help" />
                    {showTooltip && (
                      <div className="absolute top-full right-0 mt-1 w-48 p-2 bg-gray-900 text-white text-[10px] rounded shadow-lg z-20">
                        Sum of all 7 days (Mon-Sun) in this week
                      </div>
                    )}
                  </div>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {summaries.map((summary) => {
              const techData = weeklyData.get(summary.technician_id);

              return (
                <tr key={summary.technician_id}>
                  <td className="border border-gray-300 bg-gray-50 px-1.5 py-1 font-medium sticky left-0 z-10">
                    <div className="truncate text-[10px] sm:text-xs">{summary.technician_name}</div>
                  </td>
                  {weekDates.map((date) => {
                    const storesArray = techData?.get(date) || [];

                    // Calculate daily total by summing all stores for this day
                    let dailyCash = 0;
                    let dailyCard = 0;
                    let dailyTotal = 0;

                    for (const storeData of storesArray) {
                      dailyCash += storeData.tips_cash;
                      dailyCard += storeData.tips_card;
                      dailyTotal += storeData.tips_total;
                    }

                    const hasTips = dailyTotal > 0;
                    const hasMultipleStores = storesArray.length > 1;

                    return (
                      <td
                        key={date}
                        className={`border border-gray-300 px-1 py-0.5 text-center ${
                          hasTips ? 'bg-white' : 'bg-gray-50'
                        }`}
                      >
                        {hasTips ? (
                          hasMultipleStores ? (
                            <div className="space-y-0">
                              {storesArray.map((storeData, idx) => (
                                <div
                                  key={`${storeData.store_id}-${idx}`}
                                  className={idx > 0 ? 'pt-1 mt-1 border-t border-gray-400' : ''}
                                >
                                  <div className="space-y-0.5">
                                    <div className="text-center">
                                      <span className="text-[9px] text-gray-500">Cash: </span>
                                      <span className={`text-[9px] ${storeData.tips_cash === 0 ? 'text-gray-900' : 'font-semibold text-green-600'}`}>
                                        ${storeData.tips_cash.toFixed(2)}
                                      </span>
                                    </div>
                                    <div className="text-center">
                                      <span className="text-[9px] text-gray-500">Card: </span>
                                      <span className={`text-[9px] ${storeData.tips_card === 0 ? 'text-gray-900' : 'font-semibold text-blue-600'}`}>
                                        ${storeData.tips_card.toFixed(2)}
                                      </span>
                                    </div>
                                    <div className="text-center pt-0.5 border-t border-gray-900 flex items-center justify-center gap-1">
                                      <span className="font-bold text-gray-900 text-[11px]">
                                        ${storeData.tips_total.toFixed(2)}
                                      </span>
                                      {storeData.store_code && (
                                        <span className="text-[8px] text-gray-600 font-medium">
                                          [{abbreviateStoreName(storeData.store_code)}]
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="space-y-0.5">
                              <div className="text-center">
                                <span className="text-[9px] text-gray-500">Cash: </span>
                                <span className={`text-[9px] ${dailyCash === 0 ? 'text-gray-900' : 'font-semibold text-green-600'}`}>
                                  ${dailyCash.toFixed(2)}
                                </span>
                              </div>
                              <div className="text-center">
                                <span className="text-[9px] text-gray-500">Card: </span>
                                <span className={`text-[9px] ${dailyCard === 0 ? 'text-gray-900' : 'font-semibold text-blue-600'}`}>
                                  ${dailyCard.toFixed(2)}
                                </span>
                              </div>
                              <div className="text-center pt-0.5 border-t border-gray-200">
                                <span className="font-bold text-gray-900 text-[11px]">
                                  ${dailyTotal.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          )
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="border border-gray-300 bg-blue-50 px-1 py-0.5 text-center">
                    {(() => {
                      // Aggregate tips by store across all days - ALWAYS use techData for consistency
                      const storeAggregates = new Map<string, { store_code: string; tips_cash: number; tips_card: number; tips_total: number }>();

                      for (const storesArray of techData?.values() || []) {
                        for (const storeData of storesArray) {
                          if (!storeAggregates.has(storeData.store_id)) {
                            storeAggregates.set(storeData.store_id, {
                              store_code: storeData.store_code,
                              tips_cash: 0,
                              tips_card: 0,
                              tips_total: 0,
                            });
                          }
                          const agg = storeAggregates.get(storeData.store_id)!;
                          agg.tips_cash += storeData.tips_cash;
                          agg.tips_card += storeData.tips_card;
                          agg.tips_total += storeData.tips_total;
                        }
                      }

                      const storesList = Array.from(storeAggregates.values());
                      const hasMultipleStores = storesList.length > 1;

                      return hasMultipleStores ? (
                        <div className="space-y-0">
                          {storesList.map((storeAgg, idx) => (
                            <div
                              key={`${storeAgg.store_code}-${idx}`}
                              className={idx > 0 ? 'pt-1 mt-1 border-t border-gray-400' : ''}
                            >
                              <div className="space-y-0.5">
                                <div className="text-center">
                                  <span className="text-[9px] text-gray-500">Cash: </span>
                                  <span className={`text-[9px] ${storeAgg.tips_cash === 0 ? 'text-gray-900' : 'font-semibold text-green-600'}`}>
                                    ${storeAgg.tips_cash.toFixed(2)}
                                  </span>
                                </div>
                                <div className="text-center">
                                  <span className="text-[9px] text-gray-500">Card: </span>
                                  <span className={`text-[9px] ${storeAgg.tips_card === 0 ? 'text-gray-900' : 'font-semibold text-blue-600'}`}>
                                    ${storeAgg.tips_card.toFixed(2)}
                                  </span>
                                </div>
                                <div className="text-center pt-0.5 border-t border-gray-900 flex items-center justify-center gap-1">
                                  <span className="font-bold text-gray-900 text-[11px]">
                                    ${storeAgg.tips_total.toFixed(2)}
                                  </span>
                                  {storeAgg.store_code && (
                                    <span className="text-[8px] text-gray-600 font-medium">
                                      [{abbreviateStoreName(storeAgg.store_code)}]
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          <div className="text-center">
                            <span className="text-[9px] text-gray-500">Cash: </span>
                            <span className={`text-[9px] ${storesList[0]?.tips_cash === 0 ? 'text-gray-900' : 'font-semibold text-green-600'}`}>
                              ${(storesList[0]?.tips_cash || 0).toFixed(2)}
                            </span>
                          </div>
                          <div className="text-center">
                            <span className="text-[9px] text-gray-500">Card: </span>
                            <span className={`text-[9px] ${storesList[0]?.tips_card === 0 ? 'text-gray-900' : 'font-semibold text-blue-600'}`}>
                              ${(storesList[0]?.tips_card || 0).toFixed(2)}
                            </span>
                          </div>
                          <div className="text-center pt-0.5 border-t border-gray-900">
                            <span className="font-bold text-gray-900 text-[11px]">
                              ${(storesList[0]?.tips_total || 0).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
