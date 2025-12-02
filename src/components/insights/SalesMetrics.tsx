import { TrendingUp, TrendingDown, DollarSign, ShoppingCart } from 'lucide-react';
import { SalesMetrics as SalesMetricsData } from '../../hooks/useSalesData';
import { formatCurrency, formatNumber, formatPercentage, calculateTrend } from '../../lib/formatters';

interface SalesMetricsProps {
  data: SalesMetricsData;
}

export function SalesMetrics({ data }: SalesMetricsProps) {
  if (data.isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-lg shadow p-6 border border-gray-200 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-24 mb-4"></div>
            <div className="h-8 bg-gray-200 rounded w-32"></div>
          </div>
        ))}
      </div>
    );
  }

  const transactionsTrend = calculateTrend(data.current.transactions, data.previous.transactions);
  const grossSalesTrend = calculateTrend(data.current.grossSales, data.previous.grossSales);
  const netSalesTrend = calculateTrend(data.current.netSales, data.previous.netSales);
  const avgTicketTrend = calculateTrend(data.current.averageTicket, data.previous.averageTicket);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        label="Transactions"
        value={formatNumber(data.current.transactions)}
        trend={transactionsTrend}
        icon={ShoppingCart}
        iconBgColor="bg-green-100"
        iconColor="text-green-600"
      />
      <MetricCard
        label="Gross Sales"
        value={formatCurrency(data.current.grossSales)}
        trend={grossSalesTrend}
        icon={DollarSign}
        iconBgColor="bg-blue-100"
        iconColor="text-blue-600"
      />
      <MetricCard
        label="Net Sales"
        value={formatCurrency(data.current.netSales)}
        trend={netSalesTrend}
        icon={DollarSign}
        iconBgColor="bg-blue-100"
        iconColor="text-blue-600"
      />
      <MetricCard
        label="Average Net Sales / Txn"
        value={formatCurrency(data.current.averageTicket)}
        trend={avgTicketTrend}
        icon={TrendingUp}
        iconBgColor="bg-orange-100"
        iconColor="text-orange-600"
      />
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  trend: {
    change: number;
    changePercent: number;
    isPositive: boolean;
    isNegative: boolean;
  };
  icon: React.ComponentType<{ className?: string }>;
  iconBgColor: string;
  iconColor: string;
}

function MetricCard({ label, value, trend, icon: Icon, iconBgColor, iconColor }: MetricCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
        </div>
        <div className={`w-12 h-12 ${iconBgColor} rounded-lg flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-6 h-6 ${iconColor}`} />
        </div>
      </div>
      <div className="flex items-center gap-1 mt-3">
        {trend.isPositive && (
          <>
            <TrendingUp className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-600">
              {formatPercentage(trend.changePercent)}
            </span>
          </>
        )}
        {trend.isNegative && (
          <>
            <TrendingDown className="w-4 h-4 text-red-600" />
            <span className="text-sm font-medium text-red-600">
              {formatPercentage(Math.abs(trend.changePercent))}
            </span>
          </>
        )}
        {!trend.isPositive && !trend.isNegative && (
          <span className="text-sm font-medium text-gray-500">No change</span>
        )}
        <span className="text-sm text-gray-500">
          ({trend.isPositive ? '+' : ''}{formatNumber(Math.round(trend.change))})
        </span>
      </div>
    </div>
  );
}
