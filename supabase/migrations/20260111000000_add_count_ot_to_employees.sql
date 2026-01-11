-- Add count_ot column to employees table
ALTER TABLE employees ADD COLUMN IF NOT EXISTS count_ot BOOLEAN DEFAULT true;

-- Add comment
COMMENT ON COLUMN employees.count_ot IS 'When true, separate regular and overtime hours in Attendance; when false, combine all hours together';
