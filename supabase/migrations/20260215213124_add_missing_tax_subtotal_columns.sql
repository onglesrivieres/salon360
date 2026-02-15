-- Add missing columns to sale_tickets and ticket_items for schema consistency across tenants.
-- These columns exist in Salon360QC (from initial schema) but are missing in Salon365.

ALTER TABLE sale_tickets ADD COLUMN IF NOT EXISTS subtotal numeric(10,2) DEFAULT 0.00;
ALTER TABLE sale_tickets ADD COLUMN IF NOT EXISTS tax numeric(10,2) DEFAULT 0.00;
ALTER TABLE ticket_items ADD COLUMN IF NOT EXISTS line_subtotal numeric(10,2) DEFAULT 0.00;

NOTIFY pgrst, 'reload schema';
