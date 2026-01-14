/**
 * Timer utility functions for calculating service durations
 * Used across TicketEditor, TicketsDetailView, and TipReportPage
 */

export interface TimerServiceItem {
  started_at?: string | null;
  timer_stopped_at?: string | null;
  completed_at?: string | null;
  // Optional ticket-level fallbacks for when item-level timestamps are not set
  ticket_completed_at?: string | null;
  ticket_closed_at?: string | null;
}

/**
 * Calculate the duration of a single service timer in minutes
 * Priority: timer_stopped_at > item.completed_at > ticket.completed_at > ticket.closed_at > current time
 */
export function calculateServiceDuration(item: TimerServiceItem, currentTime: Date = new Date()): number {
  if (!item.started_at) return 0;

  const startTime = new Date(item.started_at);
  let endTime: Date;

  // Priority: timer_stopped_at > item.completed_at > ticket.completed_at > ticket.closed_at > currentTime
  if (item.timer_stopped_at) {
    endTime = new Date(item.timer_stopped_at);
  } else if (item.completed_at) {
    endTime = new Date(item.completed_at);
  } else if (item.ticket_completed_at) {
    endTime = new Date(item.ticket_completed_at);
  } else if (item.ticket_closed_at) {
    endTime = new Date(item.ticket_closed_at);
  } else {
    endTime = currentTime; // Active timer uses current time
  }

  const durationMs = endTime.getTime() - startTime.getTime();
  return Math.max(0, Math.floor(durationMs / (1000 * 60))); // Minutes, minimum 0
}

/**
 * Calculate total timer duration for multiple services
 */
export function calculateTotalTimerDuration(items: TimerServiceItem[], currentTime: Date = new Date()): number {
  return items.reduce((sum, item) => sum + calculateServiceDuration(item, currentTime), 0);
}

/**
 * Format timer duration for display
 * Examples: "23m", "1h 15m", "2h"
 */
export function formatTimerDisplay(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Check if a service has an active (running) timer
 * Timer is NOT active if ticket is closed/completed (even if item-level timestamps are not set)
 */
export function hasActiveTimer(item: TimerServiceItem): boolean {
  return !!(
    item.started_at &&
    !item.timer_stopped_at &&
    !item.completed_at &&
    !item.ticket_completed_at &&
    !item.ticket_closed_at
  );
}

/**
 * Check if a service has a stopped/completed timer
 */
export function hasStoppedTimer(item: TimerServiceItem): boolean {
  return !!(item.started_at && (item.timer_stopped_at || item.completed_at));
}

/**
 * Get timer status for styling purposes
 */
export type TimerStatus = 'active' | 'stopped' | 'none';

export function getTimerStatus(item: TimerServiceItem): TimerStatus {
  if (!item.started_at) return 'none';
  if (item.timer_stopped_at || item.completed_at || item.ticket_completed_at || item.ticket_closed_at) return 'stopped';
  return 'active';
}
