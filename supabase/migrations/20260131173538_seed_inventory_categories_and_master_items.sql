/*
  # Seed Inventory Categories and Master Items

  ## Overview
  Replaces old test inventory data with 91 salon-specific master items
  grouped into 8 new categories. Handles Salon365 schema compatibility
  by adding missing columns before inserting.

  ## Changes
  1. Deletes all existing inventory data (respecting FK order)
  2. Adds missing hierarchy columns for Salon365 compatibility
  3. Inserts 91 master items across 8 categories
  4. Trigger auto_create_store_inventory_levels fires on each INSERT
*/

-- ============================================================================
-- STEP 1: Delete all existing inventory data (FK order)
-- ============================================================================
DELETE FROM public.employee_inventory_lots;
DELETE FROM public.employee_inventory;
DELETE FROM public.inventory_distributions;
DELETE FROM public.inventory_purchase_lots;
DELETE FROM public.inventory_transaction_items;
DELETE FROM public.store_product_purchase_units;
-- inventory_items CASCADE will clean store_inventory_levels and store_product_preferences
DELETE FROM public.inventory_items;


-- ============================================================================
-- STEP 2: Salon365 compatibility - add missing columns if they don't exist
-- ============================================================================
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.inventory_items(id) ON DELETE CASCADE;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS is_master_item boolean NOT NULL DEFAULT false;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS size text;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS color_code text;

-- Add indexes if missing
CREATE INDEX IF NOT EXISTS idx_inventory_items_parent_id ON public.inventory_items(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_items_is_master ON public.inventory_items(is_master_item) WHERE is_master_item = true;

-- Add constraint if missing (master items cannot have a parent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inventory_items_master_no_parent'
  ) THEN
    ALTER TABLE public.inventory_items
      ADD CONSTRAINT inventory_items_master_no_parent
      CHECK (NOT (is_master_item = true AND parent_id IS NOT NULL));
  END IF;
END $$;


-- ============================================================================
-- STEP 3: Insert 91 master items
-- ============================================================================

-- Category: Manicure & Pedicure Tools (17 items)
INSERT INTO public.inventory_items (name, category, unit, is_master_item) VALUES
  ('Nail clippers (Bấm móng)', 'Manicure & Pedicure Tools', 'piece', true),
  ('Cuticle nippers (Kìm cắt da)', 'Manicure & Pedicure Tools', 'piece', true),
  ('Nail file – coarse (Dũa thô)', 'Manicure & Pedicure Tools', 'piece', true),
  ('Nail file – fine (Dũa mịn)', 'Manicure & Pedicure Tools', 'piece', true),
  ('Buffer block (Khối đánh bóng)', 'Manicure & Pedicure Tools', 'piece', true),
  ('Cuticle pusher – metal (Đẩy da kim loại)', 'Manicure & Pedicure Tools', 'piece', true),
  ('Cuticle pusher – wooden (Que đẩy da gỗ)', 'Manicure & Pedicure Tools', 'pack', true),
  ('Foot file / callus remover (Dũa gót chân)', 'Manicure & Pedicure Tools', 'piece', true),
  ('Toe separators (Ngón tách chân)', 'Manicure & Pedicure Tools', 'pair', true),
  ('Nail brush (Bàn chải móng)', 'Manicure & Pedicure Tools', 'piece', true),
  ('Dotting tools set (Bộ chấm bi)', 'Manicure & Pedicure Tools', 'set', true),
  ('Tweezers (Nhíp)', 'Manicure & Pedicure Tools', 'piece', true),
  ('Scissors – cuticle (Kéo cắt da)', 'Manicure & Pedicure Tools', 'piece', true),
  ('Finger bowls (Chén ngâm tay)', 'Manicure & Pedicure Tools', 'piece', true),
  ('Pedicure basin liners (Túi lót bồn chân)', 'Manicure & Pedicure Tools', 'pack', true),
  ('Pumice stone (Đá bọt mài)', 'Manicure & Pedicure Tools', 'piece', true),
  ('Metal spatula / scraper (Thìa kim loại)', 'Manicure & Pedicure Tools', 'piece', true);

-- Category: Nail Polish & Products (12 items)
INSERT INTO public.inventory_items (name, category, unit, is_master_item) VALUES
  ('Regular nail polish (Sơn móng thường)', 'Nail Polish & Products', 'bottle', true),
  ('Base coat (Sơn lót)', 'Nail Polish & Products', 'bottle', true),
  ('Top coat (Sơn bóng)', 'Nail Polish & Products', 'bottle', true),
  ('Gel polish (Sơn gel)', 'Nail Polish & Products', 'bottle', true),
  ('Nail polish remover – acetone (Nước tẩy sơn acetone)', 'Nail Polish & Products', 'bottle', true),
  ('Nail polish remover – non-acetone (Nước tẩy không acetone)', 'Nail Polish & Products', 'bottle', true),
  ('Cuticle oil (Dầu dưỡng da)', 'Nail Polish & Products', 'bottle', true),
  ('Cuticle remover cream (Kem tẩy da)', 'Nail Polish & Products', 'bottle', true),
  ('Nail strengthener / hardener (Sơn cứng móng)', 'Nail Polish & Products', 'bottle', true),
  ('Quick-dry drops (Giọt khô nhanh)', 'Nail Polish & Products', 'bottle', true),
  ('Nail dehydrator / primer (Primer / chất làm khô)', 'Nail Polish & Products', 'bottle', true),
  ('Dipping powder (Bột nhúng)', 'Nail Polish & Products', 'bottle', true);

-- Category: Electric Equipment (10 items)
INSERT INTO public.inventory_items (name, category, unit, is_master_item) VALUES
  ('UV/LED nail lamp (Đèn UV/LED)', 'Electric Equipment', 'piece', true),
  ('Electric nail drill (Máy mài móng)', 'Electric Equipment', 'piece', true),
  ('Drill bits – assorted (Mũi mài các loại)', 'Electric Equipment', 'set', true),
  ('Nail dust collector / vacuum (Máy hút bụi móng)', 'Electric Equipment', 'piece', true),
  ('Pedicure spa / basin (Bồn ngâm chân)', 'Electric Equipment', 'piece', true),
  ('Wax warmer (Máy nung sáp)', 'Electric Equipment', 'piece', true),
  ('Paraffin wax bath (Bồn sáp paraffin)', 'Electric Equipment', 'piece', true),
  ('Hot towel warmer / sterilizer (Tủ hấp khăn)', 'Electric Equipment', 'piece', true),
  ('Sterilizer – UV cabinet (Tủ tiệt trùng UV)', 'Electric Equipment', 'piece', true),
  ('Fan / mini desk fan (Quạt mini)', 'Electric Equipment', 'piece', true);

-- Category: Gel & Acrylic Supplies (7 items)
INSERT INTO public.inventory_items (name, category, unit, is_master_item) VALUES
  ('Acrylic powder (Bột acrylic)', 'Gel & Acrylic Supplies', 'bottle', true),
  ('Acrylic liquid monomer (Dung dịch acrylic)', 'Gel & Acrylic Supplies', 'bottle', true),
  ('Builder gel / hard gel (Gel xây)', 'Gel & Acrylic Supplies', 'bottle', true),
  ('Nail tips – assorted (Móng giả các kích cỡ)', 'Gel & Acrylic Supplies', 'box', true),
  ('Nail forms (Khuôn đắp móng)', 'Gel & Acrylic Supplies', 'pack', true),
  ('Nail glue (Keo dán móng)', 'Gel & Acrylic Supplies', 'bottle', true),
  ('Dappen dish (Chén đựng dung dịch)', 'Gel & Acrylic Supplies', 'piece', true);

-- Category: Nail Art Supplies (13 items)
INSERT INTO public.inventory_items (name, category, unit, is_master_item) VALUES
  ('Nail art brushes – detail set (Bộ cọ vẽ chi tiết)', 'Nail Art Supplies', 'set', true),
  ('Striping tape (Băng kẻ sọc)', 'Nail Art Supplies', 'piece', true),
  ('Rhinestones / crystals (Đá đính móng)', 'Nail Art Supplies', 'pack', true),
  ('Glitter assorted (Kim tuyến các loại)', 'Nail Art Supplies', 'pack', true),
  ('Stamping plates (Khuôn dập)', 'Nail Art Supplies', 'piece', true),
  ('Stamping polish (Sơn dập khuôn)', 'Nail Art Supplies', 'bottle', true),
  ('Nail stickers / decals (Sticker móng)', 'Nail Art Supplies', 'pack', true),
  ('Foil transfer sheets (Giấy foil)', 'Nail Art Supplies', 'pack', true),
  ('Dried flowers for nails (Hoa khô trang trí)', 'Nail Art Supplies', 'pack', true),
  ('Chrome / mirror powder (Bột gương)', 'Nail Art Supplies', 'piece', true),
  ('Nail charms / 3D decorations (Charm 3D)', 'Nail Art Supplies', 'pack', true),
  ('Sponge for ombré / gradient (Mút pha màu)', 'Nail Art Supplies', 'pack', true),
  ('Silicone practice hand (Tay giả tập)', 'Nail Art Supplies', 'piece', true);

-- Category: Sanitation & Hygiene (12 items)
INSERT INTO public.inventory_items (name, category, unit, is_master_item) VALUES
  ('Barbicide / disinfectant concentrate (Dung dịch khử trùng)', 'Sanitation & Hygiene', 'bottle', true),
  ('Isopropyl alcohol 70 % (Cồn 70 %)', 'Sanitation & Hygiene', 'bottle', true),
  ('Disposable gloves – nitrile (Găng tay nitrile)', 'Sanitation & Hygiene', 'box', true),
  ('Disposable masks (Khẩu trang)', 'Sanitation & Hygiene', 'box', true),
  ('Hand sanitizer (Nước rửa tay)', 'Sanitation & Hygiene', 'bottle', true),
  ('Autoclave pouches / sterilization bags (Túi hấp tiệt trùng)', 'Sanitation & Hygiene', 'pack', true),
  ('Surface disinfectant spray (Xịt khử trùng bề mặt)', 'Sanitation & Hygiene', 'bottle', true),
  ('Disposable towels / paper towels (Khăn giấy)', 'Sanitation & Hygiene', 'pack', true),
  ('Lint-free wipes (Bông không xơ)', 'Sanitation & Hygiene', 'pack', true),
  ('Cotton balls (Bông gòn)', 'Sanitation & Hygiene', 'pack', true),
  ('Cotton pads (Bông tẩy trang)', 'Sanitation & Hygiene', 'pack', true),
  ('Trash bags – small (Túi rác nhỏ)', 'Sanitation & Hygiene', 'pack', true);

-- Category: Furniture & Fixtures (9 items)
INSERT INTO public.inventory_items (name, category, unit, is_master_item) VALUES
  ('Manicure table (Bàn làm móng)', 'Furniture & Fixtures', 'piece', true),
  ('Technician stool / chair (Ghế thợ)', 'Furniture & Fixtures', 'piece', true),
  ('Client chair – manicure (Ghế khách manicure)', 'Furniture & Fixtures', 'piece', true),
  ('Pedicure throne / chair (Ghế pedicure)', 'Furniture & Fixtures', 'piece', true),
  ('Nail polish display rack (Kệ trưng bày sơn)', 'Furniture & Fixtures', 'piece', true),
  ('Supply cart / trolley (Xe đẩy dụng cụ)', 'Furniture & Fixtures', 'piece', true),
  ('Table lamp – LED (Đèn bàn LED)', 'Furniture & Fixtures', 'piece', true),
  ('Arm rest cushion (Gối kê tay)', 'Furniture & Fixtures', 'piece', true),
  ('Foot rest (Kê chân)', 'Furniture & Fixtures', 'piece', true);

-- Category: Consumables & Misc (11 items)
INSERT INTO public.inventory_items (name, category, unit, is_master_item) VALUES
  ('Paraffin wax refill (Sáp paraffin)', 'Consumables & Misc', 'piece', true),
  ('Hand / foot lotion (Kem dưỡng tay chân)', 'Consumables & Misc', 'bottle', true),
  ('Exfoliating scrub (Kem tẩy tế bào)', 'Consumables & Misc', 'bottle', true),
  ('Massage oil (Dầu massage)', 'Consumables & Misc', 'bottle', true),
  ('Spa salt / bath soak (Muối ngâm)', 'Consumables & Misc', 'bottle', true),
  ('Disposable flip-flops (Dép xỏ ngón)', 'Consumables & Misc', 'pair', true),
  ('Disposable pedicure kit (Bộ pedicure dùng 1 lần)', 'Consumables & Misc', 'pack', true),
  ('Appointment cards (Thẻ hẹn)', 'Consumables & Misc', 'pack', true),
  ('Receipt paper roll (Giấy hóa đơn)', 'Consumables & Misc', 'piece', true),
  ('Gift cards / vouchers (Thẻ quà tặng)', 'Consumables & Misc', 'pack', true),
  ('Air freshener / diffuser refill (Tinh dầu khuếch tán)', 'Consumables & Misc', 'bottle', true);


-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
