import React, { useState } from 'react';
import { AlertTriangle, User, MessageSquare, Hash } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Select } from './ui/Select';
import { TechnicianWithQueue } from '../lib/supabase';

interface ViolationReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableTechnicians: TechnicianWithQueue[];
  currentEmployeeId: string;
  currentEmployeeName: string;
  storeId: string;
  onSubmit: (data: {
    reportedEmployeeId: string;
    description: string;
    queuePosition: string;
  }) => Promise<void>;
}

export function ViolationReportModal({
  isOpen,
  onClose,
  availableTechnicians,
  currentEmployeeId,
  currentEmployeeName,
  storeId,
  onSubmit,
}: ViolationReportModalProps) {
  const [reportedEmployeeId, setReportedEmployeeId] = useState('');
  const [description, setDescription] = useState('');
  const [queuePosition, setQueuePosition] = useState('');
  const [confirmAccuracy, setConfirmAccuracy] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const eligibleTechnicians = availableTechnicians.filter(
    (tech) => tech.employee_id !== currentEmployeeId && tech.queue_status === 'ready'
  );

  const selectedTechnician = eligibleTechnicians.find(
    (tech) => tech.employee_id === reportedEmployeeId
  );

  const responderCount = availableTechnicians.filter(
    (tech) => tech.employee_id !== currentEmployeeId && tech.employee_id !== reportedEmployeeId
  ).length;

  const handleSubmit = async () => {
    if (!reportedEmployeeId || !description.trim() || !confirmAccuracy) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        reportedEmployeeId,
        description: description.trim(),
        queuePosition,
      });
      handleClose();
    } catch (error) {
      console.error('Error submitting violation report:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setReportedEmployeeId('');
    setDescription('');
    setQueuePosition('');
    setConfirmAccuracy(false);
    onClose();
  };

  const isValid = reportedEmployeeId && description.trim() && confirmAccuracy;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Report Turn Violation">
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-amber-800 font-medium">
                Report a Queue Turn Violation
              </p>
              <p className="text-xs text-amber-700 mt-1">
                All employees working today will be asked to vote on whether this violation
                occurred. A manager will make the final decision based on the votes.
              </p>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <User className="w-4 h-4 inline mr-1" />
            Employee Who Violated
          </label>
          <Select
            value={reportedEmployeeId}
            onChange={(e) => setReportedEmployeeId(e.target.value)}
            disabled={isSubmitting}
          >
            <option value="">Select an employee...</option>
            {eligibleTechnicians.map((tech) => (
              <option key={tech.employee_id} value={tech.employee_id}>
                {tech.display_name}
                {tech.queue_position > 0 ? ` (#${tech.queue_position})` : ''}
              </option>
            ))}
          </Select>
        </div>

        {selectedTechnician && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Hash className="w-4 h-4 inline mr-1" />
              Queue Position They Claimed (Optional)
            </label>
            <input
              type="number"
              min="1"
              value={queuePosition}
              onChange={(e) => setQueuePosition(e.target.value)}
              placeholder="Enter position number"
              disabled={isSubmitting}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Current queue position: #{selectedTechnician.queue_position || 'N/A'}
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <MessageSquare className="w-4 h-4 inline mr-1" />
            Description of Violation
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what happened. Include details like when it occurred, what position you were in, etc."
            rows={4}
            disabled={isSubmitting}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
          <p className="text-xs text-gray-500 mt-1">
            {description.length}/500 characters
          </p>
        </div>

        {reportedEmployeeId && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <strong>Voting Process:</strong> {responderCount} employee
              {responderCount !== 1 ? 's' : ''} will be asked to vote on whether this
              violation occurred. They will have 24 hours to respond before the report is sent to
              management for review.
            </p>
          </div>
        )}

        <div className="flex items-start gap-2">
          <input
            type="checkbox"
            id="confirmAccuracy"
            checked={confirmAccuracy}
            onChange={(e) => setConfirmAccuracy(e.target.checked)}
            disabled={isSubmitting}
            className="mt-1"
          />
          <label htmlFor="confirmAccuracy" className="text-sm text-gray-700">
            I confirm that this report is accurate to the best of my knowledge and I understand
            that false reports may result in disciplinary action.
          </label>
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={isSubmitting}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting}
            className="flex-1"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Submitting...
              </>
            ) : (
              'Submit Report'
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
