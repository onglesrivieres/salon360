import { SalesChartData } from '../../hooks/useSalesData';
import { formatCurrency } from '../../lib/formatters';

interface SalesChartProps {
  data: SalesChartData;
}

export function SalesChart({ data }: SalesChartProps) {
  if (data.isLoading) {
    return (
      <div className="h-80 flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading chart...</div>
      </div>
    );
  }

  if (data.error) {
    return (
      <div className="h-80 flex items-center justify-center">
        <div className="text-red-600">{data.error}</div>
      </div>
    );
  }

  const maxValue = Math.max(...data.currentData, ...data.previousData);
  const chartHeight = 280;
  const chartPadding = { top: 20, right: 10, bottom: 32, left: 50 };
  const chartWidth = 720;
  const barWidth = Math.max(10, (chartWidth - chartPadding.left - chartPadding.right) / (data.labels.length * 2.2));
  const groupSpacing = Math.max(2, barWidth / 4);

  const yAxisSteps = 5;
  const yAxisMax = Math.ceil(maxValue / 100) * 100 || 100;
  const yAxisStep = yAxisMax / yAxisSteps;

  return (
    <div className="overflow-x-auto scroll-smooth">
      <svg
        width={Math.max(chartWidth, data.labels.length * (barWidth * 2 + groupSpacing) + chartPadding.left + chartPadding.right)}
        height={chartHeight}
        className="mx-auto"
      >
        <g transform={`translate(${chartPadding.left}, ${chartPadding.top})`}>
          {Array.from({ length: yAxisSteps + 1 }).map((_, i) => {
            const y = ((chartHeight - chartPadding.top - chartPadding.bottom) / yAxisSteps) * i;
            const value = yAxisMax - i * yAxisStep;
            return (
              <g key={i}>
                <line
                  x1={0}
                  y1={y}
                  x2={data.labels.length * (barWidth * 2 + groupSpacing)}
                  y2={y}
                  stroke="#e5e7eb"
                  strokeWidth={1}
                />
                <text x={-8} y={y + 4} textAnchor="end" className="text-xs fill-gray-600">
                  {value >= 1000 ? `$${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}K` : `$${value}`}
                </text>
              </g>
            );
          })}

          {data.labels.map((label, index) => {
            const x = index * (barWidth * 2 + groupSpacing);
            const currentHeight =
              ((chartHeight - chartPadding.top - chartPadding.bottom) * data.currentData[index]) / yAxisMax;
            const previousHeight =
              ((chartHeight - chartPadding.top - chartPadding.bottom) * data.previousData[index]) / yAxisMax;

            return (
              <g key={index}>
                <pattern
                  id={`stripe-${index}`}
                  patternUnits="userSpaceOnUse"
                  width="8"
                  height="8"
                  patternTransform="rotate(45)"
                >
                  <rect width="4" height="8" fill="#93c5fd" />
                  <rect x="4" width="4" height="8" fill="transparent" />
                </pattern>

                <rect
                  x={x}
                  y={chartHeight - chartPadding.top - chartPadding.bottom - previousHeight}
                  width={barWidth}
                  height={previousHeight}
                  fill={`url(#stripe-${index})`}
                  className="hover:opacity-80 cursor-pointer"
                >
                  <title>
                    Previous: {formatCurrency(data.previousData[index])}
                  </title>
                </rect>

                <rect
                  x={x + barWidth}
                  y={chartHeight - chartPadding.top - chartPadding.bottom - currentHeight}
                  width={barWidth}
                  height={currentHeight}
                  fill="#3b82f6"
                  className="hover:opacity-80 cursor-pointer"
                >
                  <title>
                    Current: {formatCurrency(data.currentData[index])}
                  </title>
                </rect>

                {(index % 2 === 0 || data.labels.length <= 12) && (
                  <text
                    x={x + barWidth}
                    y={chartHeight - chartPadding.top - chartPadding.bottom + 20}
                    textAnchor="middle"
                    className="text-xs fill-gray-600"
                  >
                    {label.replace('am', 'a').replace('pm', 'p')}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
