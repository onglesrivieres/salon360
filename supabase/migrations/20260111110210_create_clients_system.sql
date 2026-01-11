-- Migration: Create Clients System
-- Description: Adds clients table, client_color_history table, and client_id to sale_tickets

-- 1. Create clients table
CREATE TABLE clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone_number text NOT NULL,
  notes text DEFAULT '',
  is_blacklisted boolean DEFAULT false,
  blacklist_reason text,
  blacklist_date timestamptz,
  blacklisted_by uuid REFERENCES employees(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(store_id, phone_number)
);

-- 2. Create client_color_history table
CREATE TABLE client_color_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  ticket_id uuid REFERENCES sale_tickets(id) ON DELETE SET NULL,
  color text NOT NULL,
  service_type text,
  applied_date timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- 3. Add client_id to sale_tickets
ALTER TABLE sale_tickets ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES clients(id);

-- 4. Create indexes for performance
CREATE INDEX idx_clients_store_id ON clients(store_id);
CREATE INDEX idx_clients_phone_number ON clients(phone_number);
CREATE INDEX idx_clients_is_blacklisted ON clients(is_blacklisted);
CREATE INDEX idx_clients_store_phone ON clients(store_id, phone_number);
CREATE INDEX idx_client_color_history_client_id ON client_color_history(client_id);
CREATE INDEX idx_client_color_history_applied_date ON client_color_history(applied_date DESC);
CREATE INDEX idx_sale_tickets_client_id ON sale_tickets(client_id);

-- 5. Enable RLS (open access pattern like other tables)
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to clients" ON clients FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE client_color_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to client_color_history" ON client_color_history FOR ALL USING (true) WITH CHECK (true);

-- 6. Updated_at trigger for clients table
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 7. Add comments for documentation
COMMENT ON TABLE clients IS 'Stores client information per store with blacklist tracking';
COMMENT ON TABLE client_color_history IS 'Tracks color history for clients from ticket services';
COMMENT ON COLUMN clients.phone_number IS 'Normalized phone number (digits only) for consistent lookup';
COMMENT ON COLUMN clients.blacklisted_by IS 'Employee who blacklisted the client';
COMMENT ON COLUMN sale_tickets.client_id IS 'Links ticket to a client for tracking visits and history';
