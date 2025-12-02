import { formatCurrency } from '../../lib/formatters';

interface TenderTypesChartProps {
  creditCard: number;
  debitCard: number;
  isLoading?: boolean;
}

export function TenderTypesChart({ creditCard, debitCard, isLoading = false }: TenderTypesChartProps) {
  const chartHeight = 320;
  const chartPadding = { top: 20, right: 20, bottom: 50, left: 60 };
  const chartWidth = 720;

  const maxValue = Math.max(creditCard, debitCard, 100);
  const yAxisMax = Math.ceil(maxValue / 500) * 500;
  const yAxisSteps = 4;
  const yAxisStep = yAxisMax / yAxisSteps;

  const plotHeight = chartHeight - chartPadding.top - chartPadding.bottom;
  const plotWidth = chartWidth - chartPadding.left - chartPadding.right;

  const barWidth = 100;
  const barSpacing = 150;

  const debitBarHeight = (debitCard / yAxisMax) * plotHeight;
  const creditBarHeight = (creditCard / yAxisMax) * plotHeight;

  const debitBarX = plotWidth / 2 - barSpacing - barWidth / 2;
  const creditBarX = plotWidth / 2 + barSpacing - barWidth / 2;

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
          <div className="h-80 bg-gray-100 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 md:p-6">
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-600"></div>
          <span className="text-sm font-medium text-gray-700">Amount Collected</span>
        </div>
      </div>

      <div className="overflow-x-auto scroll-smooth">
        <svg width={chartWidth} height={chartHeight} className="mx-auto">
          <g transform={`translate(${chartPadding.left}, ${chartPadding.top})`}>
            {Array.from({ length: yAxisSteps + 1 }).map((_, i) => {
              const y = (plotHeight / yAxisSteps) * i;
              const value = yAxisMax - i * yAxisStep;
              return (
                <g key={i}>
                  <line x1={0} y1={y} x2={plotWidth} y2={y} stroke="#e5e7eb" strokeWidth={1} />
                  <text x={-8} y={y + 4} textAnchor="end" className="text-xs fill-gray-600">
                    {value === 0 ? '$0' : `$${(value / 1000).toFixed(value >= 1000 ? 0 : 1)}K`}
                  </text>
                </g>
              );
            })}

            <rect
              x={debitBarX}
              y={plotHeight - debitBarHeight}
              width={barWidth}
              height={debitBarHeight}
              fill="#4472C4"
              className="hover:opacity-80 transition-opacity cursor-pointer"
            >
              <title>{formatCurrency(debitCard)}</title>
            </rect>

            <rect
              x={creditBarX}
              y={plotHeight - creditBarHeight}
              width={barWidth}
              height={creditBarHeight}
              fill="#4472C4"
              className="hover:opacity-80 transition-opacity cursor-pointer"
            >
              <title>{formatCurrency(creditCard)}</title>
            </rect>

            <text
              x={debitBarX + barWidth / 2}
              y={plotHeight + 30}
              textAnchor="middle"
              className="text-sm fill-gray-700 font-medium"
            >
              Debit Card
            </text>

            <text
              x={creditBarX + barWidth / 2}
              y={plotHeight + 30}
              textAnchor="middle"
              className="text-sm fill-gray-700 font-medium"
            >
              Credit Card
            </text>
          </g>
        </svg>
      </div>
    </div>
  );
}
