import React from 'react';
import { Award, Lock, Clock } from 'lucide-react';
import { TechnicianWithQueue } from '../lib/supabase';

interface TechnicianQueueProps {
  sortedTechnicians: TechnicianWithQueue[];
  selectedTechnicianId?: string;
  onTechnicianSelect?: (technicianId: string, currentTicketId?: string) => void;
  isReadOnly?: boolean;
  showLegend?: boolean;
  currentTime?: Date;
}

export function TechnicianQueue({
  sortedTechnicians,
  selectedTechnicianId,
  onTechnicianSelect,
  isReadOnly = false,
  showLegend = true,
  currentTime = new Date(),
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

  const readyTechnicians = sortedTechnicians.filter(t => t.queue_status === 'ready');
  const neutralTechnicians = sortedTechnicians.filter(t => t.queue_status === 'neutral');
  const busyTechnicians = sortedTechnicians.filter(t => t.queue_status === 'busy');

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
        </div>
      )}

      {sortedTechnicians.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p className="text-sm">No technicians available</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {readyTechnicians.map((tech) => (
          <button
            key={tech.employee_id}
            type="button"
            onClick={() => !isReadOnly && onTechnicianSelect?.(tech.employee_id)}
            className={`relative py-2 px-3 text-sm rounded-lg font-medium transition-colors ${
              selectedTechnicianId === tech.employee_id
                ? 'bg-green-600 text-white ring-2 ring-green-400'
                : 'bg-green-100 text-green-800 hover:bg-green-200'
            } ${isReadOnly ? 'cursor-default' : 'cursor-pointer'}`}
            disabled={isReadOnly}
          >
            <div className="flex items-center gap-2">
              {tech.queue_position > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold bg-white text-green-600 rounded-full">
                  {tech.queue_position}
                </span>
              )}
              <span>{tech.display_name}</span>
            </div>
          </button>
        ))}

        {neutralTechnicians.map((tech) => (
          <button
            key={tech.employee_id}
            type="button"
            onClick={() => !isReadOnly && onTechnicianSelect?.(tech.employee_id)}
            className={`py-2 px-3 text-sm rounded-lg font-medium transition-colors ${
              selectedTechnicianId === tech.employee_id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-600'
            } ${isReadOnly ? 'cursor-default' : 'cursor-pointer'}`}
            disabled={isReadOnly}
          >
            {tech.display_name}
          </button>
        ))}

        {busyTechnicians.map((tech) => {
          const timeRemaining = calculateTimeRemaining(tech);
          return (
            <button
              key={tech.employee_id}
              type="button"
              onClick={() => !isReadOnly && onTechnicianSelect?.(tech.employee_id, tech.current_open_ticket_id)}
              className={`py-2 px-3 text-sm rounded-lg font-medium transition-colors ${
                selectedTechnicianId === tech.employee_id
                  ? 'bg-red-600 text-white ring-2 ring-red-400'
                  : 'bg-red-100 text-red-800 hover:bg-red-200'
              } ${isReadOnly ? 'cursor-default' : 'cursor-pointer'}`}
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
    </div>
  );
}
