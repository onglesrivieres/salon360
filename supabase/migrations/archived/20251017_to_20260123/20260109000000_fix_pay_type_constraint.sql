-- Fix pay_type constraint to include 'commission' option
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_pay_type_valid;

ALTER TABLE public.employees ADD CONSTRAINT employees_pay_type_valid
  CHECK (pay_type = ANY (ARRAY['hourly'::text, 'daily'::text, 'commission'::text]));
