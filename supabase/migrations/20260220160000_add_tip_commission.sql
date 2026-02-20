-- Add tip_commission column to ticket_items
-- Commission field tracks commission amounts alongside tips
ALTER TABLE ticket_items ADD COLUMN IF NOT EXISTS tip_commission numeric(10,2) DEFAULT 0.00;

-- Notify PostgREST to reload schema after DDL change
NOTIFY pgrst, 'reload schema';
