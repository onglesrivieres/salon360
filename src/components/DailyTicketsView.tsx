import React from 'react';
import { SaleTicket } from '../lib/supabase';
import { formatTimeEST } from '../lib/timezone';
import { Badge } from './ui/Badge';
import { Clock, CheckCircle, AlertCircle } from 'lucide-react';

interface DailyTicketsViewProps {
  tickets: SaleTicket[];
  onTicketClick: (ticketId: string) => void;
}

export function DailyTicketsView({ tickets, onTicketClick }: DailyTicketsViewProps) {
  function getServiceSubtotal(ticket: SaleTicket): number {
    if (!ticket.ticket_items || ticket.ticket_items.length === 0) return 0;

    return ticket.ticket_items.reduce((total: number, item: any) => {
      const itemPrice = (item.qty || 1) * (item.price_each || 0);
      const addonPrice = item.addon_price || 0;
      return total + itemPrice + addonPrice;
    }, 0);
  }

  function getPaymentMethodBadge(paymentMethod: string | null) {
    if (!paymentMethod) return null;

    const colors: Record<string, string> = {
      'Cash': 'bg-green-100 text-green-800',
      'Card': 'bg-blue-100 text-blue-800',
      'Mixed': 'bg-purple-100 text-purple-800',
      'Other': 'bg-gray-100 text-gray-800',
    };

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[paymentMethod] || colors.Other}`}>
        {paymentMethod}
      </span>
    );
  }

  function getStatusBadge(ticket: SaleTicket) {
    if (ticket.closed_at) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          Closed
        </span>
      );
    }

    if (ticket.completed_at) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
          Completed
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
        Open
      </span>
    );
  }

  function getApprovalBadge(ticket: SaleTicket) {
    if (!ticket.approval_status) return null;

    switch (ticket.approval_status) {
      case 'pending_approval':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Approved
          </span>
        );
      case 'auto_approved':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <Clock className="w-3 h-3 mr-1" />
            Auto
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <AlertCircle className="w-3 h-3 mr-1" />
            Rejected
          </span>
        );
      default:
        return null;
    }
  }

  if (tickets.length === 0) {
    return (
      <div className="text-center py-8 bg-white rounded-lg shadow">
        <p className="text-sm text-gray-500">No tickets found for this date</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 rounded-lg shadow p-2 overflow-x-auto">
      <div className="flex gap-2 min-w-max pb-2">
        {tickets.map((ticket) => {
          const serviceSubtotal = getServiceSubtotal(ticket);
          const time = formatTimeEST(ticket.opened_at);

          return (
            <div
              key={ticket.id}
              onClick={() => onTicketClick(ticket.id)}
              className="flex-shrink-0 w-64 bg-white rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="p-3 border-b border-gray-100 bg-gray-50">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-gray-900">#{ticket.ticket_no}</span>
                  {getStatusBadge(ticket)}
                </div>
                <div className="text-xs text-gray-600">{time}</div>
              </div>

              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Customer</span>
                  <span className="text-xs font-medium text-gray-900">{ticket.customer_type || '-'}</span>
                </div>

                {ticket.payment_method && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Payment</span>
                    {getPaymentMethodBadge(ticket.payment_method)}
                  </div>
                )}

                {ticket.approval_status && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Approval</span>
                    {getApprovalBadge(ticket)}
                  </div>
                )}

                <div className="pt-2 border-t border-gray-100">
                  <div className="text-xs text-gray-500 mb-2">Services</div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {ticket.ticket_items && ticket.ticket_items.length > 0 ? (
                      ticket.ticket_items.map((item: any, index: number) => {
                        const itemSubtotal = ((item.qty || 1) * (item.price_each || 0)) + (item.addon_price || 0);
                        const serviceName = item.custom_service_name || item.service?.code || 'Custom';
                        const techName = item.employee?.display_name || '-';

                        return (
                          <div key={index} className="text-xs bg-gray-50 rounded p-1.5">
                            <div className="flex justify-between items-start mb-0.5">
                              <span className="font-medium text-gray-900">{serviceName}</span>
                              <span className="font-semibold text-gray-900">${itemSubtotal.toFixed(2)}</span>
                            </div>
                            <div className="text-gray-600">{techName}</div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-xs text-gray-400">No services</div>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-200 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-gray-600">Service Subtotal</span>
                    <span className="text-sm font-bold text-blue-600">${serviceSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-gray-900">Ticket Total</span>
                    <span className="text-base font-bold text-gray-900">${ticket.total.toFixed(2)}</span>
                  </div>
                  {Math.abs(serviceSubtotal - ticket.total) > 0.01 && (
                    <div className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1 mt-1">
                      Includes tips/adjustments
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
