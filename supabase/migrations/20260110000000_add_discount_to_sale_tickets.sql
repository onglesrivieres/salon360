-- Add discount column to sale_tickets table
ALTER TABLE sale_tickets ADD COLUMN IF NOT EXISTS discount numeric(10,2) DEFAULT 0.00;
