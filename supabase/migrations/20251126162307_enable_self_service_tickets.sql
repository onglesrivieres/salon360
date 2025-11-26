/*
  # Enable Self-Service Tickets for Technicians, Spa Experts, and Supervisors
  
  1. Changes
    - Add `opened_by_role` column to `sale_tickets` - tracks who created the ticket
    - Add `reviewed_by_receptionist` column to `sale_tickets` - tracks if receptionist/manager reviewed
    - Backfill existing tickets (all marked as reviewed)
    - Create index for efficient filtering of self-service tickets
  
  2. Self-Service Rules
    - Technician, Spa Expert, AND Supervisor roles trigger self-service mode
    - Self-service users must be checked in to create tickets
    - Self-service users cannot edit after saving
    - Only Receptionist/Manager/Owner can review self-service tickets
    - Green background in UI until authorized reviewer saves
  
  3. Security
    - All changes maintain existing RLS policies
    - No new permissions or access patterns introduced
*/

-- Add columns to sale_tickets
ALTER TABLE public.sale_tickets 
ADD COLUMN IF NOT EXISTS opened_by_role text;

ALTER TABLE public.sale_tickets 
ADD COLUMN IF NOT EXISTS reviewed_by_receptionist boolean DEFAULT false;

-- Backfill opened_by_role for existing tickets
UPDATE public.sale_tickets st
SET opened_by_role = (
  SELECT 
    CASE 
      WHEN 'Technician' = ANY(e.role) THEN 'Technician'
      WHEN 'Spa Expert' = ANY(e.role) THEN 'Spa Expert'
      WHEN 'Supervisor' = ANY(e.role) THEN 'Supervisor'
      WHEN 'Manager' = ANY(e.role) THEN 'Manager'
      WHEN 'Owner' = ANY(e.role) THEN 'Owner'
      WHEN 'Receptionist' = ANY(e.role) THEN 'Receptionist'
      ELSE 'Receptionist'
    END
  FROM public.employees e
  WHERE e.id = st.created_by
)
WHERE st.opened_by_role IS NULL AND st.created_by IS NOT NULL;

-- Set all existing tickets as reviewed (no green background for old tickets)
UPDATE public.sale_tickets
SET reviewed_by_receptionist = true
WHERE reviewed_by_receptionist IS NULL OR reviewed_by_receptionist = false;

-- Create index for filtering self-service tickets needing review
CREATE INDEX IF NOT EXISTS idx_sale_tickets_self_service 
  ON public.sale_tickets(opened_by_role, reviewed_by_receptionist)
  WHERE opened_by_role IN ('Technician', 'Spa Expert', 'Supervisor')
    AND reviewed_by_receptionist = false;

-- Add helpful comments
COMMENT ON COLUMN public.sale_tickets.opened_by_role IS
  'Role of employee who created the ticket. Used to identify self-service tickets created by Technicians, Spa Experts, or Supervisors.';

COMMENT ON COLUMN public.sale_tickets.reviewed_by_receptionist IS
  'False for self-service tickets (Tech/Spa Expert/Supervisor) until receptionist/manager/owner saves. Controls green background visibility. Always true for tickets created by Receptionist/Manager/Owner.';

-- Force PostgREST to reload schema
NOTIFY pgrst, 'reload schema';