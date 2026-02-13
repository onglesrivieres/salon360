import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, XCircle, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { PendingViolationResponse } from '../lib/supabase';
import { formatDateOnly, formatDateTimeEST } from '../lib/timezone';

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
  const [isExpanded, setIsExpanded] = useState(true);
  const [responseNotes, setResponseNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update countdown timer every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (pendingResponses.length === 0) {
    return null;
  }

  const currentReport = pendingResponses[currentIndex];

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const reportTime = new Date(timestamp);
    const diffMs = now.getTime() - reportTime.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;

    return formatDateTimeEST(reportTime);
  };

  const formatTime = (timestamp: string) => {
    const reportTime = new Date(timestamp);
    return reportTime.toLocaleTimeString('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

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
      setIsExpanded(true);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setResponseNotes('');
      setIsExpanded(true);
    }
  };

  const getTimeRemainingInfo = () => {
    const expiresAt = new Date(currentReport.expires_at);
    const diffMs = expiresAt.getTime() - currentTime.getTime();
    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const diffSeconds = Math.floor((diffMs % (1000 * 60)) / 1000);

    let text = 'Expired';
    let urgency: 'expired' | 'critical' | 'warning' | 'normal' = 'expired';

    if (diffMs > 0) {
      if (diffHours > 0) {
        text = `${diffHours}h ${diffMinutes}m remaining`;
      } else if (diffMinutes > 0) {
        text = `${diffMinutes}m ${diffSeconds}s remaining`;
      } else {
        text = `${diffSeconds}s remaining`;
      }

      // Determine urgency level for visual indicators
      if (totalMinutes <= 5) {
        urgency = 'critical';
      } else if (totalMinutes <= 15) {
        urgency = 'warning';
      } else if (totalMinutes <= 30) {
        urgency = 'normal';
      } else {
        urgency = 'normal';
      }
    }

    return { text, urgency, totalMinutes };
  };

  const timeInfo = getTimeRemainingInfo();

  // Determine ribbon background color based on urgency
  const getRibbonColor = () => {
    switch (timeInfo.urgency) {
      case 'expired':
        return 'bg-gray-700';
      case 'critical':
        return 'bg-red-900 animate-pulse';
      case 'warning':
        return 'bg-red-700';
      default:
        return 'bg-red-600';
    }
  };

  return (
    <>
      {/* Blocking Overlay */}
      <div className="fixed inset-0 bg-black bg-opacity-60 z-40 backdrop-blur-sm" />

      {/* Violation Response Ribbon */}
      <div className={`fixed top-0 left-0 right-0 z-50 text-white shadow-2xl transition-colors ${getRibbonColor()}`}>
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <AlertTriangle className="w-6 h-6 flex-shrink-0 animate-pulse" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="font-bold text-lg">VIOLATION REPORT - RESPONSE REQUIRED</span>
                  {pendingResponses.length > 1 && (
                    <span className="text-red-200 text-sm font-medium px-2 py-0.5 bg-red-700 rounded">
                      {currentIndex + 1} of {pendingResponses.length}
                    </span>
                  )}
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-red-100 text-sm font-medium">Reported Employee:</span>
                    <span className="text-white font-bold text-base">{currentReport.reported_employee_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-red-200" />
                    <span className="text-red-100 text-sm">
                      Reported {formatTimeAgo(currentReport.created_at)} at {formatTime(currentReport.created_at)}
                    </span>
                  </div>
                  {!isExpanded && (
                    <div className="mt-2">
                      <p className="text-white text-sm font-medium line-clamp-2">
                        Reason: {currentReport.violation_description}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {pendingResponses.length > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={handlePrevious}
                    disabled={currentIndex === 0 || isSubmitting}
                    className="px-3 py-1.5 bg-red-700 hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors text-sm font-medium"
                  >
                    Previous
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={currentIndex >= pendingResponses.length - 1 || isSubmitting}
                    className="px-3 py-1.5 bg-red-700 hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors text-sm font-medium"
                  >
                    Next
                  </button>
                </div>
              )}
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-2 hover:bg-red-700 rounded transition-colors"
                title={isExpanded ? 'Show Less' : 'Show More'}
              >
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {isExpanded && (
            <div className="mt-4 pt-4 border-t border-red-500">
              <div className="bg-red-700 rounded-lg p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-red-100 mb-1">
                      Violation Description
                    </p>
                    <p className="text-white">{currentReport.violation_description}</p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-red-100 mb-1">
                      Violation Date
                    </p>
                    <p className="text-white">
                      {formatDateOnly(currentReport.violation_date)}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-red-100 mb-1">
                      Time Remaining to Vote
                    </p>
                    <div className="flex items-center gap-2">
                      <p className={`font-bold text-lg ${
                        timeInfo.urgency === 'critical' ? 'text-yellow-300' :
                        timeInfo.urgency === 'warning' ? 'text-yellow-100' :
                        'text-white'
                      }`}>
                        {timeInfo.text}
                      </p>
                      {timeInfo.urgency === 'critical' && (
                        <Clock className="w-5 h-5 text-yellow-300 animate-pulse" />
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-red-100 mb-1">
                      Vote Progress
                    </p>
                    <p className="text-white font-medium">
                      {currentReport.votes_violation_confirmed} of {currentReport.min_votes_required} "YES" votes needed
                    </p>
                    <p className="text-xs text-red-100 mt-0.5">
                      ({currentReport.total_responses_received}/{currentReport.total_responses_required} total responses)
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-red-100 mb-2">
                    Optional Notes (Add context for your vote)
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
                    className="flex-1 px-6 py-4 bg-white text-red-600 rounded-lg font-bold text-lg hover:bg-red-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  >
                    {isSubmitting ? (
                      <div className="w-6 h-6 border-3 border-red-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <XCircle className="w-6 h-6" />
                        No Violation
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleResponse(true)}
                    disabled={isSubmitting}
                    className="flex-1 px-6 py-4 bg-white text-red-600 rounded-lg font-bold text-lg hover:bg-red-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  >
                    {isSubmitting ? (
                      <div className="w-6 h-6 border-3 border-red-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <CheckCircle className="w-6 h-6" />
                        Violation Occurred
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {!isExpanded && (
            <div className="mt-3 flex items-center justify-center gap-4">
              <button
                onClick={() => handleResponse(false)}
                disabled={isSubmitting}
                className="px-6 py-3 bg-white text-red-600 rounded-lg font-bold text-base hover:bg-red-50 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
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
                className="px-6 py-3 bg-white text-red-600 rounded-lg font-bold text-base hover:bg-red-50 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
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
          )}
        </div>
      </div>
    </>
  );
}
