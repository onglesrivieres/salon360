import React from 'react';
import { Award, Lock, Clock, XCircle } from 'lucide-react';
import { TechnicianWithQueue } from '../lib/supabase';

interface TechnicianQueueProps {
  sortedTechnicians: TechnicianWithQueue[];
  selectedTechnicianId?: string;
  onTechnicianSelect?: (technicianId: string, currentTicketId?: string) => void;
  isReadOnly?: boolean;
  showLegend?: boolean;
  currentTime?: Date;
  currentEmployeeId?: string;
  allowLeaveQueue?: boolean;
  onLeaveQueue?: (employeeId: string) => void;
  leavingQueueEmployeeId?: string;
  canRemoveTechnicians?: boolean;
  onRemoveTechnician?: (employeeId: string, employeeName: string) => void;
  removingTechnicianId?: string;
}

export function TechnicianQueue({
  sortedTechnicians,
  selectedTechnicianId,
  onTechnicianSelect,
  isReadOnly = false,
  showLegend = true,
  currentTime = new Date(),
  currentEmployeeId,
  allowLeaveQueue = false,
  onLeaveQueue,
  leavingQueueEmployeeId,
  canRemoveTechnicians = false,
  onRemoveTechnician,
  removingTechnicianId,
}: TechnicianQueueProps) {

  const calculateTimeRemaining = (tech: TechnicianWithQueue): string => {
    if (!tech.ticket_start_time || !tech.estimated_duration_min) {
      return '';
    }

    const startTime = new Date(tech.ticket_start_time);
    const elapsedMinutes = Math.floor((currentTime.getTime() - startTime.getTime()) / (1000 * 60));
    const remainingMinutes = Math.max(0, tech.estimated_duration_min - elapsedMinutes);

    if (remainingMinutes === 0) {
      return 'Finishing soon';
    }

    if (remainingMinutes < 60) {
      return `~${remainingMinutes}min`;
    }

    const hours = Math.floor(remainingMinutes / 60);
    const mins = remainingMinutes % 60;
    return mins > 0 ? `~${hours}h ${mins}min` : `~${hours}h`;
  };

  // Combine ready and small_service technicians, sorted by position to maintain queue order
  const availableTechnicians = sortedTechnicians
    .filter(t => t.queue_status === 'ready' || t.queue_status === 'small_service')
    .sort((a, b) => (a.queue_position || 999) - (b.queue_position || 999));

  const readyTechnicians = availableTechnicians.filter(t => t.queue_status === 'ready');
  const smallServiceTechnicians = availableTechnicians.filter(t => t.queue_status === 'small_service');
  const neutralTechnicians = sortedTechnicians.filter(t => t.queue_status === 'neutral');
  const busyTechnicians = sortedTechnicians.filter(t => t.queue_status === 'busy');

  const currentEmployeeInQueue = allowLeaveQueue && currentEmployeeId
    ? availableTechnicians.find(tech => tech.employee_id === currentEmployeeId && tech.queue_status === 'ready')
    : null;
  const isLeaving = currentEmployeeInQueue && leavingQueueEmployeeId === currentEmployeeId;

  return (
    <div className="space-y-4">
      {showLegend && (
        <div className="flex items-start gap-3 flex-wrap">
          {readyTechnicians.length > 0 && (
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-green-600" />
              <span className="text-sm font-semibold text-green-700 uppercase">Available</span>
            </div>
          )}
          {neutralTechnicians.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-600 uppercase">Not Ready</span>
            </div>
          )}
          {busyTechnicians.length > 0 && (
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-red-600" />
              <span className="text-sm font-semibold text-red-700 uppercase">Busy</span>
            </div>
          )}
          {smallServiceTechnicians.length > 0 && (
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-600" />
              <span className="text-sm font-semibold text-yellow-700 uppercase">Small Service</span>
            </div>
          )}
        </div>
      )}

      {sortedTechnicians.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p className="text-sm">No technicians available</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {/* Render ready and small_service together, sorted by position */}
        {availableTechnicians.map((tech) => {
          const isCurrentEmployee = currentEmployeeId === tech.employee_id;
          const isSmallService = tech.queue_status === 'small_service';
          const showRemoveButton = canRemoveTechnicians && !isCurrentEmployee && onRemoveTechnician && !isSmallService;
          const isBeingRemoved = removingTechnicianId === tech.employee_id;

          // Color classes based on status
          const colorClasses = isSmallService
            ? selectedTechnicianId === tech.employee_id
              ? 'bg-yellow-600 text-white ring-2 ring-yellow-400'
              : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
            : selectedTechnicianId === tech.employee_id
              ? 'bg-green-600 text-white ring-2 ring-green-400'
              : 'bg-green-100 text-green-800 hover:bg-green-200';

          const badgeColorClass = isSmallService ? 'text-yellow-600' : 'text-green-600';
          const spinnerBorderColor = isSmallService ? 'border-yellow-600' : 'border-green-600';

          return (
            <div key={tech.employee_id} className="relative inline-block group">
              <button
                type="button"
                onClick={() => !isReadOnly && onTechnicianSelect?.(tech.employee_id, isSmallService ? tech.current_open_ticket_id : undefined)}
                className={`py-2 px-3 text-sm rounded-lg font-medium transition-colors ${colorClasses} ${isReadOnly ? 'cursor-default' : 'cursor-pointer'} ${isCurrentEmployee ? 'animate-pulse' : ''} ${isBeingRemoved ? 'opacity-50' : ''}`}
                disabled={isReadOnly || isBeingRemoved}
                title={isSmallService ? 'Working on small service - keeping queue position' : undefined}
              >
                <div className="flex items-center gap-2">
                  {tech.queue_position > 0 && (
                    <span className={`inline-flex items-center justify-center w-5 h-5 text-xs font-bold bg-white ${badgeColorClass} rounded-full`}>
                      {tech.queue_position}
                    </span>
                  )}
                  {isSmallService && <Clock className="w-3 h-3" />}
                  <span>{tech.display_name}</span>
                  {isBeingRemoved && (
                    <div className={`w-3 h-3 border-2 ${spinnerBorderColor} border-t-transparent rounded-full animate-spin ml-1`} />
                  )}
                </div>
              </button>
              {showRemoveButton && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveTechnician(tech.employee_id, tech.display_name);
                  }}
                  disabled={isBeingRemoved || !!removingTechnicianId}
                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 transition-colors shadow-sm opacity-0 group-hover:opacity-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Remove from queue"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}

        {neutralTechnicians.map((tech) => {
          const isCurrentEmployee = currentEmployeeId === tech.employee_id;
          return (
            <button
              key={tech.employee_id}
              type="button"
              onClick={() => !isReadOnly && onTechnicianSelect?.(tech.employee_id)}
              className={`py-2 px-3 text-sm rounded-lg font-medium transition-colors ${
                selectedTechnicianId === tech.employee_id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-600'
              } ${isReadOnly ? 'cursor-default' : 'cursor-pointer'} ${isCurrentEmployee ? 'animate-pulse' : ''}`}
              disabled={isReadOnly}
            >
              {tech.display_name}
            </button>
          );
        })}

        {busyTechnicians.map((tech) => {
          const timeRemaining = calculateTimeRemaining(tech);
          const isCurrentEmployee = currentEmployeeId === tech.employee_id;
          return (
            <button
              key={tech.employee_id}
              type="button"
              onClick={() => !isReadOnly && onTechnicianSelect?.(tech.employee_id, tech.current_open_ticket_id)}
              className={`py-2 px-3 text-sm rounded-lg font-medium transition-colors ${
                selectedTechnicianId === tech.employee_id
                  ? 'bg-red-600 text-white ring-2 ring-red-400'
                  : 'bg-red-100 text-red-800 hover:bg-red-200'
              } ${isReadOnly ? 'cursor-default' : 'cursor-pointer'} ${isCurrentEmployee ? 'animate-pulse' : ''}`}
              title={!isReadOnly ? `${tech.display_name} is currently working on ${tech.open_ticket_count} ticket(s)${timeRemaining ? ` - ${timeRemaining} remaining` : ''}` : undefined}
              disabled={isReadOnly}
            >
              <div className="flex items-center gap-2">
                <Lock className="w-3 h-3" />
                <span>{tech.display_name}</span>
                {timeRemaining && (
                  <span className="inline-flex items-center text-xs font-medium">
                    ({timeRemaining})
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {currentEmployeeInQueue && (
        <div className="pt-4 border-t border-gray-200">
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => onLeaveQueue?.(currentEmployeeId!)}
              disabled={!!isLeaving}
              className="px-6 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {isLeaving ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Leaving Queue...
                </span>
              ) : (
                'Leave Queue'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
