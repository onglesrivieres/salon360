/*
  # Fix Incorrectly Routed Approval Tickets

  ## Problem
  Due to the bug in the previous approval logic:
  1. Tickets where a Supervisor performed but someone ELSE closed were incorrectly
     routed to Manager level instead of Technician level (performer should approve)
  2. Tickets where a solo Technician (only) performed AND closed were incorrectly
     left at Technician level instead of escalating to Supervisor

  ## Changes
  1. Fix tickets where Supervisor performed + different person closed → set to technician level
  2. Fix tickets where solo Tech performed AND closed → set to supervisor level
  
  ## Notes
  - Only affects tickets still in 'pending_approval' status
  - Updates approval_required_level, approval_reason, requires_higher_approval, and approval_performer_id
  - Does not change approval_deadline (keeps original timing)
*/

-- Fix Case 1: Supervisor performed but DIFFERENT person closed
-- These should be technician level (performer approves)
UPDATE public.sale_tickets st
SET 
  approval_required_level = 'technician',
  approval_reason = 'Standard ticket with separation of duties - performer can approve (corrected from manager)',
  requires_higher_approval = false,
  approval_performer_id = (
    SELECT ti.employee_id 
    FROM public.ticket_items ti 
    WHERE ti.sale_ticket_id = st.id 
    LIMIT 1
  )
WHERE 
  st.approval_status = 'pending_approval'
  AND st.approval_required_level = 'manager'
  AND st.approval_reason LIKE '%Supervisor performed service on ticket%'
  AND st.closed_by IS DISTINCT FROM (
    SELECT ti.employee_id 
    FROM public.ticket_items ti 
    WHERE ti.sale_ticket_id = st.id 
    LIMIT 1
  );

-- Fix Case 2: Solo Technician (only Tech role, no other roles) performed AND closed
-- These should be supervisor level
UPDATE public.sale_tickets st
SET 
  approval_required_level = 'supervisor',
  approval_reason = 'Technician performed and closed ticket themselves - requires Supervisor approval (corrected)',
  requires_higher_approval = true,
  approval_performer_id = NULL
WHERE 
  st.approval_status = 'pending_approval'
  AND st.approval_required_level = 'technician'
  AND EXISTS (
    SELECT 1 
    FROM public.ticket_items ti 
    WHERE ti.sale_ticket_id = st.id 
    GROUP BY ti.sale_ticket_id
    HAVING COUNT(DISTINCT ti.employee_id) = 1
  )
  AND st.closed_by = (
    SELECT ti.employee_id 
    FROM public.ticket_items ti 
    WHERE ti.sale_ticket_id = st.id 
    LIMIT 1
  )
  AND EXISTS (
    SELECT 1 
    FROM public.employees e 
    WHERE e.id = st.closed_by 
      AND 'Technician' = ANY(e.role)
      AND NOT 'Receptionist' = ANY(e.role)
      AND NOT 'Supervisor' = ANY(e.role)
      AND NOT 'Spa Expert' = ANY(e.role)
  );

-- Fix Case 3: Solo Spa Expert (only Spa Expert role, no other roles) performed AND closed
-- These should also be supervisor level
UPDATE public.sale_tickets st
SET 
  approval_required_level = 'supervisor',
  approval_reason = 'Spa Expert performed and closed ticket themselves - requires Supervisor approval (corrected)',
  requires_higher_approval = true,
  approval_performer_id = NULL
WHERE 
  st.approval_status = 'pending_approval'
  AND st.approval_required_level = 'technician'
  AND EXISTS (
    SELECT 1 
    FROM public.ticket_items ti 
    WHERE ti.sale_ticket_id = st.id 
    GROUP BY ti.sale_ticket_id
    HAVING COUNT(DISTINCT ti.employee_id) = 1
  )
  AND st.closed_by = (
    SELECT ti.employee_id 
    FROM public.ticket_items ti 
    WHERE ti.sale_ticket_id = st.id 
    LIMIT 1
  )
  AND EXISTS (
    SELECT 1 
    FROM public.employees e 
    WHERE e.id = st.closed_by 
      AND 'Spa Expert' = ANY(e.role)
      AND NOT 'Receptionist' = ANY(e.role)
      AND NOT 'Supervisor' = ANY(e.role)
      AND NOT 'Technician' = ANY(e.role)
  );
