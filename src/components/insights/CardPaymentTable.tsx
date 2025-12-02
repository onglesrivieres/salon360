import { useState } from 'react';
import { ChevronDown, ChevronRight, Info } from 'lucide-react';
import { CardPaymentAnalysis } from '../../hooks/useSalesData';
import { formatCurrency, formatNumber } from '../../lib/formatters';

interface CardPaymentTableProps {
  data: CardPaymentAnalysis;
  showTips: boolean;
}

export function CardPaymentTable({ data, showTips }: CardPaymentTableProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['root', 'credit', 'debit'])
  );

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  if (data.isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-4"></div>
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (data.error) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <p className="text-red-600">{data.error}</p>
      </div>
    );
  }

  const InfoTooltip = ({ text }: { text: string }) => (
    <Info className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" title={text} />
  );

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="overflow-x-auto scroll-smooth">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left py-2 px-3 text-xs md:text-sm font-semibold text-gray-900 sticky left-0 bg-gray-50 z-10">
                Tender Types
              </th>
              <th className="text-center py-2 px-3 text-xs md:text-sm font-semibold text-gray-900">
                <div className="flex items-center justify-center gap-1">
                  Transactions
                  <InfoTooltip text="Number of completed transactions" />
                </div>
              </th>
              <th className="text-center py-2 px-3 text-xs md:text-sm font-semibold text-gray-900">
                <div className="flex items-center justify-center gap-1">
                  Sales Total
                  <InfoTooltip text="Total sales before refunds" />
                </div>
              </th>
              <th className="text-center py-2 px-3 text-xs md:text-sm font-semibold text-gray-900">
                <div className="flex items-center justify-center gap-1">
                  Transaction Refunds
                  <InfoTooltip text="Refunds processed" />
                </div>
              </th>
              <th className="text-center py-2 px-3 text-xs md:text-sm font-semibold text-gray-900">
                Manual Refunds
              </th>
              <th className="text-center py-2 px-3 text-xs md:text-sm font-semibold text-gray-900">
                <div className="flex items-center justify-center gap-1">
                  Amount Collected
                  <InfoTooltip text="Actual money collected" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              className="border-b border-gray-200 hover:bg-gray-50 cursor-pointer"
              onClick={() => toggleSection('root')}
            >
              <td className="py-2 px-3 text-xs md:text-sm font-bold text-gray-900 sticky left-0 bg-white z-10">
                <div className="flex items-center gap-2">
                  {expandedSections.has('root') ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                  Credit Cards + Debit Cards
                </div>
              </td>
              <td className="py-2 px-3 text-center text-xs md:text-sm text-gray-900">
                {formatNumber(data.grandTotal.transactions)}
              </td>
              <td className="py-2 px-3 text-center text-xs md:text-sm text-gray-900">
                {formatCurrency(data.grandTotal.salesTotal)}
              </td>
              <td className="py-2 px-3 text-center text-xs md:text-sm text-gray-900">
                {formatCurrency(data.grandTotal.refunds)}
              </td>
              <td className="py-2 px-3 text-center text-xs md:text-sm text-gray-900">
                {formatCurrency(data.grandTotal.manualRefunds)}
              </td>
              <td className="py-2 px-3 text-center text-xs md:text-sm text-gray-900">
                {formatCurrency(data.grandTotal.amountCollected)}
              </td>
            </tr>

            {expandedSections.has('root') && (
              <>
                <tr
                  className="border-b border-gray-200 hover:bg-gray-50 cursor-pointer"
                  onClick={() => toggleSection('credit')}
                >
                  <td className="py-2 px-3 text-xs md:text-sm font-semibold text-gray-900 sticky left-0 bg-white z-10">
                    <div className="flex items-center gap-2 pl-8">
                      {expandedSections.has('credit') ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                      Credit Card
                    </div>
                  </td>
                  <td className="py-2 px-3 text-center text-xs md:text-sm text-gray-900">
                    {formatNumber(data.creditCards.total.transactions)}
                  </td>
                  <td className="py-2 px-3 text-center text-xs md:text-sm text-gray-900">
                    {formatCurrency(data.creditCards.total.salesTotal)}
                  </td>
                  <td className="py-2 px-3 text-center text-xs md:text-sm text-gray-900">
                    {formatCurrency(data.creditCards.total.refunds)}
                  </td>
                  <td className="py-2 px-3 text-center text-xs md:text-sm text-gray-900">
                    {formatCurrency(data.creditCards.total.manualRefunds)}
                  </td>
                  <td className="py-2 px-3 text-center text-xs md:text-sm text-gray-900">
                    {formatCurrency(data.creditCards.total.amountCollected)}
                  </td>
                </tr>

                {expandedSections.has('credit') &&
                  data.creditCards.cards.map((card, index) => (
                    <tr key={`credit-${index}`} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="py-2 px-3 text-xs md:text-sm text-gray-900 pl-16 sticky left-0 bg-white z-10">{card.cardType}</td>
                      <td className="py-2 px-3 text-center text-xs md:text-sm text-gray-900">
                        {formatNumber(card.transactions)}
                      </td>
                      <td className="py-2 px-3 text-center text-xs md:text-sm text-gray-900">
                        {formatCurrency(card.salesTotal)}
                      </td>
                      <td className="py-2 px-3 text-center text-xs md:text-sm text-gray-900">
                        {formatCurrency(card.refunds)}
                      </td>
                      <td className="py-2 px-3 text-center text-xs md:text-sm text-gray-900">
                        {formatCurrency(card.manualRefunds)}
                      </td>
                      <td className="py-2 px-3 text-center text-xs md:text-sm text-gray-900">
                        {formatCurrency(card.amountCollected)}
                      </td>
                    </tr>
                  ))}

                {expandedSections.has('credit') && (
                  <tr className="border-b border-gray-200 hover:bg-gray-50 bg-gray-50">
                    <td className="py-2 px-3 text-xs md:text-sm font-semibold text-gray-900 pl-16 sticky left-0 bg-gray-50 z-10">
                      Total Credit Card
                    </td>
                    <td className="py-2 px-3 text-center text-xs md:text-sm font-semibold text-gray-900">
                      {formatNumber(data.creditCards.total.transactions)}
                    </td>
                    <td className="py-2 px-3 text-center text-xs md:text-sm font-semibold text-gray-900">
                      {formatCurrency(data.creditCards.total.salesTotal)}
                    </td>
                    <td className="py-2 px-3 text-center text-xs md:text-sm font-semibold text-gray-900">
                      {formatCurrency(data.creditCards.total.refunds)}
                    </td>
                    <td className="py-2 px-3 text-center text-xs md:text-sm font-semibold text-gray-900">
                      {formatCurrency(data.creditCards.total.manualRefunds)}
                    </td>
                    <td className="py-2 px-3 text-center text-xs md:text-sm font-semibold text-gray-900">
                      {formatCurrency(data.creditCards.total.amountCollected)}
                    </td>
                  </tr>
                )}

                <tr
                  className="border-b border-gray-200 hover:bg-gray-50 cursor-pointer"
                  onClick={() => toggleSection('debit')}
                >
                  <td className="py-2 px-3 text-xs md:text-sm font-semibold text-gray-900 sticky left-0 bg-white z-10">
                    <div className="flex items-center gap-2 pl-8">
                      {expandedSections.has('debit') ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                      Debit Card
                    </div>
                  </td>
                  <td className="py-2 px-3 text-center text-xs md:text-sm text-gray-900">
                    {formatNumber(data.debitCards.total.transactions)}
                  </td>
                  <td className="py-2 px-3 text-center text-xs md:text-sm text-gray-900">
                    {formatCurrency(data.debitCards.total.salesTotal)}
                  </td>
                  <td className="py-2 px-3 text-center text-xs md:text-sm text-gray-900">
                    {formatCurrency(data.debitCards.total.refunds)}
                  </td>
                  <td className="py-2 px-3 text-center text-xs md:text-sm text-gray-900">
                    {formatCurrency(data.debitCards.total.manualRefunds)}
                  </td>
                  <td className="py-2 px-3 text-center text-xs md:text-sm text-gray-900">
                    {formatCurrency(data.debitCards.total.amountCollected)}
                  </td>
                </tr>

                {expandedSections.has('debit') &&
                  data.debitCards.cards.map((card, index) => (
                    <tr key={`debit-${index}`} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="py-2 px-3 text-xs md:text-sm text-gray-900 pl-16 sticky left-0 bg-white z-10">{card.cardType}</td>
                      <td className="py-2 px-3 text-center text-xs md:text-sm text-gray-900">
                        {formatNumber(card.transactions)}
                      </td>
                      <td className="py-2 px-3 text-center text-xs md:text-sm text-gray-900">
                        {formatCurrency(card.salesTotal)}
                      </td>
                      <td className="py-2 px-3 text-center text-xs md:text-sm text-gray-900">
                        {formatCurrency(card.refunds)}
                      </td>
                      <td className="py-2 px-3 text-center text-xs md:text-sm text-gray-900">
                        {formatCurrency(card.manualRefunds)}
                      </td>
                      <td className="py-2 px-3 text-center text-xs md:text-sm text-gray-900">
                        {formatCurrency(card.amountCollected)}
                      </td>
                    </tr>
                  ))}

                {expandedSections.has('debit') && (
                  <tr className="border-b border-gray-200 hover:bg-gray-50 bg-gray-50">
                    <td className="py-2 px-3 text-xs md:text-sm font-semibold text-gray-900 pl-16 sticky left-0 bg-gray-50 z-10">
                      Total Debit Card
                    </td>
                    <td className="py-2 px-3 text-center text-xs md:text-sm font-semibold text-gray-900">
                      {formatNumber(data.debitCards.total.transactions)}
                    </td>
                    <td className="py-2 px-3 text-center text-xs md:text-sm font-semibold text-gray-900">
                      {formatCurrency(data.debitCards.total.salesTotal)}
                    </td>
                    <td className="py-2 px-3 text-center text-xs md:text-sm font-semibold text-gray-900">
                      {formatCurrency(data.debitCards.total.refunds)}
                    </td>
                    <td className="py-2 px-3 text-center text-xs md:text-sm font-semibold text-gray-900">
                      {formatCurrency(data.debitCards.total.manualRefunds)}
                    </td>
                    <td className="py-2 px-3 text-center text-xs md:text-sm font-semibold text-gray-900">
                      {formatCurrency(data.debitCards.total.amountCollected)}
                    </td>
                  </tr>
                )}

                <tr className="border-b border-gray-200 hover:bg-gray-50 bg-gray-100">
                  <td className="py-2 px-3 text-xs md:text-sm font-bold text-gray-900 pl-8 sticky left-0 bg-gray-100 z-10">
                    Total Credit Cards + Debit Cards
                  </td>
                  <td className="py-2 px-3 text-center text-xs md:text-sm font-bold text-gray-900">
                    {formatNumber(data.grandTotal.transactions)}
                  </td>
                  <td className="py-2 px-3 text-center text-xs md:text-sm font-bold text-gray-900">
                    {formatCurrency(data.grandTotal.salesTotal)}
                  </td>
                  <td className="py-2 px-3 text-center text-xs md:text-sm font-bold text-gray-900">
                    {formatCurrency(data.grandTotal.refunds)}
                  </td>
                  <td className="py-2 px-3 text-center text-xs md:text-sm font-bold text-gray-900">
                    {formatCurrency(data.grandTotal.manualRefunds)}
                  </td>
                  <td className="py-2 px-3 text-center text-xs md:text-sm font-bold text-gray-900">
                    {formatCurrency(data.grandTotal.amountCollected)}
                  </td>
                </tr>
              </>
            )}

            <tr className="bg-gray-50">
              <td className="py-2 px-3 text-xs md:text-sm font-bold text-gray-900 sticky left-0 bg-gray-50 z-10">Total</td>
              <td className="py-2 px-3 text-center text-xs md:text-sm font-bold text-gray-900">
                {formatNumber(data.grandTotal.transactions)}
              </td>
              <td className="py-2 px-3 text-center text-xs md:text-sm font-bold text-gray-900">
                {formatCurrency(data.grandTotal.salesTotal)}
              </td>
              <td className="py-2 px-3 text-center text-xs md:text-sm font-bold text-gray-900">
                {formatCurrency(data.grandTotal.refunds)}
              </td>
              <td className="py-2 px-3 text-center text-xs md:text-sm font-bold text-gray-900">
                {formatCurrency(data.grandTotal.manualRefunds)}
              </td>
              <td className="py-2 px-3 text-center text-xs md:text-sm font-bold text-gray-900">
                {formatCurrency(data.grandTotal.amountCollected)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
