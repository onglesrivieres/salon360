-- Add invoice-level photos for inventory transactions (proof of supplier invoice)

CREATE TABLE IF NOT EXISTS inventory_transaction_invoice_photos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES stores(id),
  transaction_id uuid NOT NULL REFERENCES inventory_transactions(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  filename text,
  file_size integer,
  mime_type text DEFAULT 'image/jpeg',
  display_order integer DEFAULT 0,
  uploaded_by uuid REFERENCES employees(id),
  caption text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_tx_invoice_photos_tx_id ON inventory_transaction_invoice_photos(transaction_id);

ALTER TABLE inventory_transaction_invoice_photos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'inventory_transaction_invoice_photos' AND policyname = 'Allow all access to invoice photos'
  ) THEN
    CREATE POLICY "Allow all access to invoice photos" ON inventory_transaction_invoice_photos FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
