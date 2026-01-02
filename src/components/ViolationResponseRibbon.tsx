import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from './ui/Button';
import { PendingViolationResponse } from '../lib/supabase';

interface ViolationResponseRibbonProps {
  pendingResponses: PendingViolationResponse[];
  onRespond: (
    reportId: string,
    response: boolean,
    notes?: string
  ) => Promise<void>;
}

export function ViolationResponseRibbon({
  pendingResponses,
  onRespond,
}: ViolationResponseRibbonProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [responseNotes, setResponseNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (pendingResponses.length === 0) {
    return null;
  }

  const currentReport = pendingResponses[currentIndex];

  const handleResponse = async (response: boolean) => {
    setIsSubmitting(true);
    try {
      await onRespond(
        currentReport.report_id,
        response,
        responseNotes.trim() || undefined
      );
      setResponseNotes('');
      if (currentIndex >= pendingResponses.length - 1) {
        setCurrentIndex(0);
      }
    } catch (error) {
      console.error('Error submitting response:', error);
      alert('Failed to submit response. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < pendingResponses.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setResponseNotes('');
      setIsExpanded(false);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setResponseNotes('');
      setIsExpanded(false);
    }
  };

  const timeRemaining = () => {
    const now = new Date();
    const expiresAt = new Date(currentReport.expires_at);
    const diffMs = expiresAt.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffMs < 0) return 'Expired';
    if (diffHours > 0) return `${diffHours}h ${diffMinutes}m remaining`;
    return `${diffMinutes}m remaining`;
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white shadow-lg">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold">Turn Violation Report - Vote Required</span>
                <span className="text-red-200 text-sm">
                  ({currentIndex + 1} of {pendingResponses.length})
                </span>
              </div>
              <p className="text-sm text-red-100 truncate">
                {currentReport.reported_employee_name} reported by{' '}
                {currentReport.reporter_employee_name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {pendingResponses.length > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={handlePrevious}
                  disabled={currentIndex === 0 || isSubmitting}
                  className="px-2 py-1 bg-red-700 hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors text-sm"
                >
                  Previous
                </button>
                <button
                  onClick={handleNext}
                  disabled={currentIndex >= pendingResponses.length - 1 || isSubmitting}
                  className="px-2 py-1 bg-red-700 hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors text-sm"
                >
                  Next
                </button>
              </div>
            )}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 hover:bg-red-700 rounded transition-colors"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-red-500">
            <div className="bg-red-700 rounded-lg p-4 space-y-3">
              <div>
                <p className="text-sm font-medium text-red-100 mb-1">
                  Reported Employee
                </p>
                <p className="text-white">{currentReport.reported_employee_name}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-red-100 mb-1">
                  Reported By
                </p>
                <p className="text-white">{currentReport.reporter_employee_name}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-red-100 mb-1">
                  Violation Description
                </p>
                <p className="text-white text-sm">{currentReport.violation_description}</p>
              </div>

              {currentReport.queue_position_claimed && (
                <div>
                  <p className="text-sm font-medium text-red-100 mb-1">
                    Queue Position Claimed
                  </p>
                  <p className="text-white">#{currentReport.queue_position_claimed}</p>
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-red-100 mb-1">
                  Date
                </p>
                <p className="text-white">
                  {new Date(currentReport.violation_date).toLocaleDateString()}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-red-100 mb-1">
                  Time Remaining
                </p>
                <p className="text-white">{timeRemaining()}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-red-100 mb-1">
                  Response Progress
                </p>
                <p className="text-white">
                  {currentReport.total_responses_received} of{' '}
                  {currentReport.total_responses_required} employees have responded
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-red-100 mb-1">
                  Optional Notes
                </label>
                <textarea
                  value={responseNotes}
                  onChange={(e) => setResponseNotes(e.target.value)}
                  placeholder="Add any additional context or explanation (optional)"
                  rows={2}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 bg-white text-gray-900 rounded-lg focus:ring-2 focus:ring-white resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => handleResponse(false)}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 bg-white text-red-600 rounded-lg font-semibold hover:bg-red-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <XCircle className="w-5 h-5" />
                      No Violation
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleResponse(true)}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 bg-white text-red-600 rounded-lg font-semibold hover:bg-red-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Violation Occurred
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {!isExpanded && (
          <div className="mt-2 flex items-center justify-center gap-3">
            <button
              onClick={() => handleResponse(false)}
              disabled={isSubmitting}
              className="px-4 py-2 bg-white text-red-600 rounded-lg font-semibold hover:bg-red-50 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <XCircle className="w-4 h-4" />
                  No Violation
                </>
              )}
            </button>
            <button
              onClick={() => handleResponse(true)}
              disabled={isSubmitting}
              className="px-4 py-2 bg-white text-red-600 rounded-lg font-semibold hover:bg-red-50 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Violation Occurred
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
