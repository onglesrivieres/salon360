/*
  # Add Attendance Display Toggle to Employees

  1. Overview
     - Adds attendance_display column to employees table
     - Controls whether employee can use attendance system and appears on Attendance page
     - Default is true to maintain backward compatibility

  2. Changes
     - Add attendance_display boolean column to employees table
     - Default value: true (all existing employees remain visible/functional)
     - When false: employee cannot check in/out and is hidden from attendance reports

  3. Use Cases
     - Disable attendance tracking for owners, managers, or contractors
     - Hide specific employees from attendance page
     - Control access to attendance functionality per employee

  4. Notes
     - Existing employees will have NULL, which is treated as true
     - Must be explicitly set to false to disable attendance
     - Affects both current and historical attendance data visibility
*/

-- ============================================================================
-- ADD attendance_display COLUMN TO employees TABLE
-- ============================================================================

-- Add the attendance_display column with default true
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS attendance_display boolean DEFAULT true;

-- Add comment explaining the column
COMMENT ON COLUMN public.employees.attendance_display IS 'Controls attendance tracking: true = can check in/out and appears on attendance page, false = attendance disabled. NULL treated as true for backward compatibility.';
