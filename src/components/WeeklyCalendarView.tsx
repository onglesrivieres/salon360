import { useState } from "react";
import { Info } from "lucide-react";

type WeeklyDataTips = Map<
  string,
  Map<
    string,
    Array<{
      store_id: string;
      store_code: string;
      tips_customer: number;
      tips_receptionist: number;
      tips_commission: number;
    }>
  >
>;
type WeeklyDataRevenue = Map<
  string,
  Map<string, Array<{ store_id: string; store_code: string; revenue: number }>>
>;

interface WeeklyCalendarViewProps {
  selectedDate: string;
  weeklyData: WeeklyDataTips | WeeklyDataRevenue;
  summaries: Array<{
    technician_id: string;
    technician_name: string;
    tips_total?: number;
    revenue?: number;
  }>;
  periodDates: string[];
  mode?: "tips" | "revenue";
  multiStoreEmployeeIds?: Set<string>;
}

function abbreviateStoreName(storeCode: string): string {
  const codeMap: Record<string, string> = {
    OM: "M",
    OC: "C",
    OR: "R",
  };
  return (
    codeMap[storeCode.toUpperCase()] || storeCode.substring(0, 1).toUpperCase()
  );
}

function getStoreColor(storeCode: string): string {
  const abbrev = abbreviateStoreName(storeCode);
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

function formatDateHeader(dateStr: string): { day: string; date: string } {
  const d = new Date(dateStr + "T00:00:00");
  const days = ["S", "M", "T", "W", "T", "F", "S"];
  const day = days[d.getDay()];
  const date = `${d.getMonth() + 1}/${d.getDate()}`;
  return { day, date };
}

export function WeeklyCalendarView({
  selectedDate: _selectedDate,
  weeklyData,
  summaries,
  periodDates,
  mode = "tips",
  multiStoreEmployeeIds = new Set(),
}: WeeklyCalendarViewProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div
      className="overflow-x-auto -mx-4 sm:mx-0 scrollbar-hide"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      <div className="inline-block min-w-full align-middle px-4 sm:px-0">
        <table className="min-w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="border border-gray-300 bg-gray-100 px-1.5 py-1 text-left font-semibold sticky left-0 z-10 w-20 sm:w-24">
                <div className="truncate">Tech</div>
              </th>
              {periodDates.map((date) => {
                const { day, date: dateStr } = formatDateHeader(date);
                return (
                  <th
                    key={date}
                    className="border border-gray-300 bg-gray-100 px-1 py-1 text-center font-semibold w-[60px] sm:w-20"
                  >
                    <div className="font-bold text-[10px] sm:text-xs">
                      {day}
                    </div>
                    <div className="text-[9px] sm:text-[10px] text-gray-600">
                      {dateStr}
                    </div>
                  </th>
                );
              })}
              <th className="border border-gray-300 bg-blue-100 px-1 py-1 text-center font-semibold w-[60px] sm:w-20 relative">
                <div className="flex items-center justify-center gap-1">
                  <div className="font-bold text-[10px] sm:text-xs">
                    Period Total
                  </div>
                  <div
                    className="relative"
                    onMouseEnter={() => setShowTooltip(true)}
                    onMouseLeave={() => setShowTooltip(false)}
                  >
                    <Info className="w-3 h-3 text-blue-600 cursor-help" />
                    {showTooltip && (
                      <div className="absolute top-full right-0 mt-1 w-48 p-2 bg-gray-900 text-white text-[10px] rounded shadow-lg z-20">
                        Sum of all days in this bi-weekly period
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
              const isMultiStoreEmployee = multiStoreEmployeeIds.has(
                summary.technician_id,
              );

              return (
                <tr key={summary.technician_id}>
                  <td className="border border-gray-300 bg-gray-50 px-1.5 py-1 font-bold sticky left-0 z-10">
                    <div className="truncate text-[10px] sm:text-xs">
                      {summary.technician_name}
                    </div>
                  </td>
                  {periodDates.map((date) => {
                    const storesArray = techData?.get(date) || [];

                    if (mode === "revenue") {
                      // Revenue mode: simple display
                      const dailyTotal = storesArray.reduce(
                        (sum, store: any) => sum + (store.revenue || 0),
                        0,
                      );
                      const hasRevenue = dailyTotal > 0;

                      return (
                        <td
                          key={date}
                          className={`border border-gray-300 px-1 py-0.5 text-center ${
                            hasRevenue ? "bg-white" : "bg-gray-50"
                          }`}
                        >
                          {hasRevenue ? (
                            <div className="flex items-center justify-center">
                              <span className="text-gray-900 text-[10px] font-bold">
                                ${dailyTotal.toFixed(0)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                      );
                    }

                    // Tips mode: detailed breakdown
                    let dailyCustomer = 0;
                    let dailyReceptionist = 0;
                    let dailyCommission = 0;

                    for (const storeData of storesArray) {
                      dailyCustomer += (storeData as any).tips_customer || 0;
                      dailyReceptionist +=
                        (storeData as any).tips_receptionist || 0;
                      dailyCommission +=
                        (storeData as any).tips_commission || 0;
                    }

                    const hasRevenue =
                      dailyCustomer + dailyReceptionist + dailyCommission > 0;
                    const hasMultipleStores = storesArray.length > 1;

                    return (
                      <td
                        key={date}
                        className={`border border-gray-300 px-1 py-0.5 text-center ${
                          hasRevenue ? "bg-white" : "bg-gray-50"
                        }`}
                      >
                        {hasRevenue ? (
                          hasMultipleStores ? (
                            <div className="space-y-0">
                              {storesArray.map((storeData: any, idx) => (
                                <div
                                  key={`${storeData.store_id}-${idx}`}
                                  className={
                                    idx > 0
                                      ? "pt-1 mt-1 border-t border-gray-400"
                                      : ""
                                  }
                                >
                                  <div className="text-center space-y-0.5">
                                    {isMultiStoreEmployee &&
                                      storeData.store_code && (
                                        <div className="flex items-center justify-center">
                                          <span
                                            className={`text-[7px] font-medium ${getStoreColor(storeData.store_code)}`}
                                          >
                                            [
                                            {abbreviateStoreName(
                                              storeData.store_code,
                                            )}
                                            ]
                                          </span>
                                        </div>
                                      )}
                                    <div className="flex items-center justify-center">
                                      <span className="text-green-700 text-[10px] font-medium">
                                        {storeData.tips_customer.toFixed(0)}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-center">
                                      <span className="text-blue-700 text-[10px] font-medium">
                                        {storeData.tips_receptionist.toFixed(0)}
                                      </span>
                                    </div>
                                    {(storeData.tips_commission || 0) > 0 && (
                                      <div className="flex items-center justify-center">
                                        <span className="text-purple-700 text-[10px] font-medium">
                                          {storeData.tips_commission.toFixed(0)}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                              <div className="pt-0.5 mt-0.5 border-t border-gray-300">
                                <div className="flex items-center justify-center gap-0.5">
                                  <span className="text-gray-900 text-[10px] font-bold">
                                    {(
                                      dailyCustomer +
                                      dailyReceptionist +
                                      dailyCommission
                                    ).toFixed(0)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="text-center space-y-0.5">
                              {isMultiStoreEmployee &&
                                storesArray[0]?.store_code && (
                                  <div className="flex items-center justify-center">
                                    <span
                                      className={`text-[7px] font-medium ${getStoreColor(storesArray[0].store_code)}`}
                                    >
                                      [
                                      {abbreviateStoreName(
                                        storesArray[0].store_code,
                                      )}
                                      ]
                                    </span>
                                  </div>
                                )}
                              <div className="flex items-center justify-center">
                                <span className="text-green-700 text-[10px] font-medium">
                                  {dailyCustomer.toFixed(0)}
                                </span>
                              </div>
                              <div className="flex items-center justify-center">
                                <span className="text-blue-700 text-[10px] font-medium">
                                  {dailyReceptionist.toFixed(0)}
                                </span>
                              </div>
                              {dailyCommission > 0 && (
                                <div className="flex items-center justify-center">
                                  <span className="text-purple-700 text-[10px] font-medium">
                                    {dailyCommission.toFixed(0)}
                                  </span>
                                </div>
                              )}
                              <div className="pt-0.5 mt-0.5 border-t border-gray-300">
                                <div className="flex items-center justify-center">
                                  <span className="text-gray-900 text-[10px] font-bold">
                                    {(
                                      dailyCustomer +
                                      dailyReceptionist +
                                      dailyCommission
                                    ).toFixed(0)}
                                  </span>
                                </div>
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
                      if (mode === "revenue") {
                        // Revenue mode: simple period total
                        let periodTotal = 0;
                        for (const storesArray of techData?.values() || []) {
                          for (const storeData of storesArray) {
                            periodTotal += (storeData as any).revenue || 0;
                          }
                        }

                        return (
                          <div className="flex items-center justify-center">
                            <span className="text-gray-900 text-[10px] font-bold">
                              ${periodTotal.toFixed(0)}
                            </span>
                          </div>
                        );
                      }

                      // Tips mode: detailed breakdown
                      const storeAggregates = new Map<
                        string,
                        {
                          store_code: string;
                          tips_customer: number;
                          tips_receptionist: number;
                          tips_commission: number;
                        }
                      >();

                      for (const storesArray of techData?.values() || []) {
                        for (const storeData of storesArray) {
                          const data = storeData as any;
                          if (!storeAggregates.has(data.store_id)) {
                            storeAggregates.set(data.store_id, {
                              store_code: data.store_code,
                              tips_customer: 0,
                              tips_receptionist: 0,
                              tips_commission: 0,
                            });
                          }
                          const agg = storeAggregates.get(data.store_id)!;
                          agg.tips_customer += data.tips_customer || 0;
                          agg.tips_receptionist += data.tips_receptionist || 0;
                          agg.tips_commission += data.tips_commission || 0;
                        }
                      }

                      const storesList = Array.from(storeAggregates.values());
                      const hasMultipleStores = storesList.length > 1;

                      // Calculate period total across all stores
                      const periodTotalCustomer = storesList.reduce(
                        (sum, store) => sum + store.tips_customer,
                        0,
                      );
                      const periodTotalReceptionist = storesList.reduce(
                        (sum, store) => sum + store.tips_receptionist,
                        0,
                      );
                      const periodTotalCommission = storesList.reduce(
                        (sum, store) => sum + store.tips_commission,
                        0,
                      );
                      const periodTotal =
                        periodTotalCustomer +
                        periodTotalReceptionist +
                        periodTotalCommission;

                      return hasMultipleStores ? (
                        <div className="space-y-0">
                          {storesList.map((storeAgg, idx) => (
                            <div
                              key={`${storeAgg.store_code}-${idx}`}
                              className={
                                idx > 0
                                  ? "pt-1 mt-1 border-t border-gray-400"
                                  : ""
                              }
                            >
                              <div className="text-center space-y-0.5">
                                {isMultiStoreEmployee &&
                                  storeAgg.store_code && (
                                    <div className="flex items-center justify-center">
                                      <span
                                        className={`text-[7px] font-medium ${getStoreColor(storeAgg.store_code)}`}
                                      >
                                        [
                                        {abbreviateStoreName(
                                          storeAgg.store_code,
                                        )}
                                        ]
                                      </span>
                                    </div>
                                  )}
                                <div className="flex items-center justify-center">
                                  <span className="font-bold text-green-700 text-[10px]">
                                    {storeAgg.tips_customer.toFixed(0)}
                                  </span>
                                </div>
                                <div className="flex items-center justify-center">
                                  <span className="font-bold text-blue-700 text-[10px]">
                                    {storeAgg.tips_receptionist.toFixed(0)}
                                  </span>
                                </div>
                                {(storeAgg.tips_commission || 0) > 0 && (
                                  <div className="flex items-center justify-center">
                                    <span className="font-bold text-purple-700 text-[10px]">
                                      {storeAgg.tips_commission.toFixed(0)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                          <div className="pt-0.5 mt-0.5 border-t border-gray-300">
                            <div className="flex items-center justify-center gap-0.5">
                              <span className="text-gray-900 text-[10px] font-bold">
                                {periodTotal.toFixed(0)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center space-y-0.5">
                          {isMultiStoreEmployee &&
                            storesList[0]?.store_code && (
                              <div className="flex items-center justify-center">
                                <span
                                  className={`text-[7px] font-medium ${getStoreColor(storesList[0].store_code)}`}
                                >
                                  [
                                  {abbreviateStoreName(
                                    storesList[0].store_code,
                                  )}
                                  ]
                                </span>
                              </div>
                            )}
                          <div className="flex items-center justify-center">
                            <span className="font-bold text-green-700 text-[10px]">
                              {(storesList[0]?.tips_customer || 0).toFixed(0)}
                            </span>
                          </div>
                          <div className="flex items-center justify-center">
                            <span className="font-bold text-blue-700 text-[10px]">
                              {(storesList[0]?.tips_receptionist || 0).toFixed(
                                0,
                              )}
                            </span>
                          </div>
                          {periodTotalCommission > 0 && (
                            <div className="flex items-center justify-center">
                              <span className="font-bold text-purple-700 text-[10px]">
                                {periodTotalCommission.toFixed(0)}
                              </span>
                            </div>
                          )}
                          <div className="pt-0.5 mt-0.5 border-t border-gray-300">
                            <div className="flex items-center justify-center">
                              <span className="text-gray-900 text-[10px] font-bold">
                                {periodTotal.toFixed(0)}
                              </span>
                            </div>
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
