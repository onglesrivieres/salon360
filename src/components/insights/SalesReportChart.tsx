import { formatCurrency } from '../../lib/formatters';

interface SalesReportChartProps {
  hourlyData: number[];
  showNowIndicator?: boolean;
}

export function SalesReportChart({ hourlyData, showNowIndicator = false }: SalesReportChartProps) {
  const chartHeight = 320;
  const chartPadding = { top: 20, right: 40, bottom: 40, left: 60 };
  const chartWidth = 900;

  const maxValue = Math.max(...hourlyData, 100);
  const yAxisMax = Math.ceil(maxValue / 100) * 100;
  const yAxisSteps = 4;
  const yAxisStep = yAxisMax / yAxisSteps;

  const plotHeight = chartHeight - chartPadding.top - chartPadding.bottom;
  const plotWidth = chartWidth - chartPadding.left - chartPadding.right;

  const points = hourlyData.map((value, index) => {
    const x = (index / 23) * plotWidth;
    const y = plotHeight - (value / yAxisMax) * plotHeight;
    return { x, y, value };
  });

  const pathData = points.reduce((path, point, index) => {
    if (index === 0) {
      return `M ${point.x} ${point.y}`;
    }
    const prevPoint = points[index - 1];
    const cpx1 = prevPoint.x + (point.x - prevPoint.x) / 3;
    const cpy1 = prevPoint.y;
    const cpx2 = prevPoint.x + ((point.x - prevPoint.x) * 2) / 3;
    const cpy2 = point.y;
    return `${path} C ${cpx1} ${cpy1}, ${cpx2} ${cpy2}, ${point.x} ${point.y}`;
  }, '');

  const areaPath = `${pathData} L ${plotWidth} ${plotHeight} L 0 ${plotHeight} Z`;

  const currentHour = new Date().getHours();
  const nowX = (currentHour / 23) * plotWidth;

  const xAxisLabels = [
    { hour: 0, label: '12a.m.' },
    { hour: 3, label: '3' },
    { hour: 6, label: '6' },
    { hour: 9, label: '9' },
    { hour: 12, label: '12p.m.' },
    { hour: 15, label: '3' },
    { hour: 18, label: '6' },
    { hour: 21, label: '9' },
  ];

  return (
    <div className="overflow-x-auto">
      <svg width={chartWidth} height={chartHeight} className="mx-auto">
        <defs>
          <linearGradient id="areaGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        <g transform={`translate(${chartPadding.left}, ${chartPadding.top})`}>
          {Array.from({ length: yAxisSteps + 1 }).map((_, i) => {
            const y = (plotHeight / yAxisSteps) * i;
            const value = yAxisMax - i * yAxisStep;
            return (
              <g key={i}>
                <line x1={0} y1={y} x2={plotWidth} y2={y} stroke="#e5e7eb" strokeWidth={1} />
                <text x={-10} y={y + 4} textAnchor="end" className="text-xs fill-gray-600">
                  ${value}
                </text>
              </g>
            );
          })}

          <path d={areaPath} fill="url(#areaGradient)" />

          <path d={pathData} fill="none" stroke="#3b82f6" strokeWidth={2.5} />

          {points.map((point, index) => (
            <circle key={index} cx={point.x} cy={point.y} r={3} fill="#3b82f6" className="hover:r-5">
              <title>{formatCurrency(point.value)}</title>
            </circle>
          ))}

          {showNowIndicator && (
            <g>
              <line
                x1={nowX}
                y1={0}
                x2={nowX}
                y2={plotHeight}
                stroke="#6b7280"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <text
                x={nowX}
                y={-5}
                textAnchor="middle"
                className="text-xs font-medium fill-gray-600"
              >
                Now
              </text>
            </g>
          )}

          {xAxisLabels.map(({ hour, label }) => {
            const x = (hour / 23) * plotWidth;
            return (
              <text
                key={hour}
                x={x}
                y={plotHeight + 25}
                textAnchor="middle"
                className="text-sm fill-gray-600"
              >
                {label}
              </text>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
