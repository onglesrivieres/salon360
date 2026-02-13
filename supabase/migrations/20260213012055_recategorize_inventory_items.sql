-- Re-categorize 73 non-DND inventory items from "Nail Polish & Products" to correct categories.
-- All 362 DND items remain in "Nail Polish & Products" (unchanged).
-- Idempotent: safe to run multiple times.

UPDATE inventory_items
SET category = CASE name
  -- Manicure & Pedicure Tools (19 items)
  WHEN 'Buffer block (Khối đánh bóng)' THEN 'Manicure & Pedicure Tools'
  WHEN 'Cuticle nippers (Kìm cắt da)' THEN 'Manicure & Pedicure Tools'
  WHEN 'Cuticle pusher – metal (Đẩy da kim loại)' THEN 'Manicure & Pedicure Tools'
  WHEN 'Cuticle pusher – wooden (Que đẩy da gỗ)' THEN 'Manicure & Pedicure Tools'
  WHEN 'Finger bowls (Chén ngâm tay)' THEN 'Manicure & Pedicure Tools'
  WHEN 'Foot file / callus remover (Dũa gót chân)' THEN 'Manicure & Pedicure Tools'
  WHEN 'Metal spatula / scraper (Thìa kim loại)' THEN 'Manicure & Pedicure Tools'
  WHEN 'Nail brush (Bàn chải móng)' THEN 'Manicure & Pedicure Tools'
  WHEN 'Nail clippers (Bấm móng)' THEN 'Manicure & Pedicure Tools'
  WHEN 'Nail file – coarse (Dũa thô)' THEN 'Manicure & Pedicure Tools'
  WHEN 'Nail file – fine (Dũa mịn)' THEN 'Manicure & Pedicure Tools'
  WHEN 'Nail tips – assorted (Móng giả các kích cỡ)' THEN 'Manicure & Pedicure Tools'
  WHEN 'Pumice stone (Đá bọt mài)' THEN 'Manicure & Pedicure Tools'
  WHEN 'Scissors – cuticle (Kéo cắt da)' THEN 'Manicure & Pedicure Tools'
  WHEN 'Toe separators (Ngón tách chân)' THEN 'Manicure & Pedicure Tools'
  WHEN 'Tweezers (Nhíp)' THEN 'Manicure & Pedicure Tools'
  WHEN 'Disposable pedicure kit (Bộ pedicure dùng 1 lần)' THEN 'Manicure & Pedicure Tools'
  WHEN 'Silicone practice hand (Tay giả tập)' THEN 'Manicure & Pedicure Tools'
  WHEN 'Nail forms (Khuôn đắp móng)' THEN 'Manicure & Pedicure Tools'

  -- Electric Equipment (8 items)
  WHEN 'Drill bits – assorted (Mũi mài các loại)' THEN 'Electric Equipment'
  WHEN 'Electric nail drill (Máy mài móng)' THEN 'Electric Equipment'
  WHEN 'Fan / mini desk fan (Quạt mini)' THEN 'Electric Equipment'
  WHEN 'Hot towel warmer / sterilizer (Tủ hấp khăn)' THEN 'Electric Equipment'
  WHEN 'Nail dust collector / vacuum (Máy hút bụi móng)' THEN 'Electric Equipment'
  WHEN 'Sterilizer – UV cabinet (Tủ tiệt trùng UV)' THEN 'Electric Equipment'
  WHEN 'UV/LED nail lamp (Đèn UV/LED)' THEN 'Electric Equipment'
  WHEN 'Wax warmer (Máy nung sáp)' THEN 'Electric Equipment'

  -- Gel & Acrylic Supplies (2 items)
  WHEN 'Builder gel / hard gel (Gel xây)' THEN 'Gel & Acrylic Supplies'
  WHEN 'Dappen dish (Chén đựng dung dịch)' THEN 'Gel & Acrylic Supplies'

  -- Nail Art Supplies (10 items)
  WHEN 'Nail art brushes – detail set (Bộ cọ vẽ chi tiết)' THEN 'Nail Art Supplies'
  WHEN 'Dotting tools set (Bộ chấm bi)' THEN 'Nail Art Supplies'
  WHEN 'Dried flowers for nails (Hoa khô trang trí)' THEN 'Nail Art Supplies'
  WHEN 'Foil transfer sheets (Giấy foil)' THEN 'Nail Art Supplies'
  WHEN 'Glitter assorted (Kim tuyến các loại)' THEN 'Nail Art Supplies'
  WHEN 'Nail charms / 3D decorations (Charm 3D)' THEN 'Nail Art Supplies'
  WHEN 'Nail stickers / decals (Sticker móng)' THEN 'Nail Art Supplies'
  WHEN 'Rhinestones / crystals (Đá đính móng)' THEN 'Nail Art Supplies'
  WHEN 'Stamping plates (Khuôn dập)' THEN 'Nail Art Supplies'
  WHEN 'Striping tape (Băng kẻ sọc)' THEN 'Nail Art Supplies'

  -- Sanitation & Hygiene (13 items)
  WHEN 'Autoclave pouches / sterilization bags (Túi hấp tiệt trùng)' THEN 'Sanitation & Hygiene'
  WHEN 'Barbicide / disinfectant concentrate (Dung dịch khử trùng)' THEN 'Sanitation & Hygiene'
  WHEN 'Cotton balls (Bông gòn)' THEN 'Sanitation & Hygiene'
  WHEN 'Cotton pads (Bông tẩy trang)' THEN 'Sanitation & Hygiene'
  WHEN 'Disposable gloves – nitrile (Găng tay nitrile)' THEN 'Sanitation & Hygiene'
  WHEN 'Disposable masks (Khẩu trang)' THEN 'Sanitation & Hygiene'
  WHEN 'Disposable towels / paper towels (Khăn giấy)' THEN 'Sanitation & Hygiene'
  WHEN 'Hand sanitizer (Nước rửa tay)' THEN 'Sanitation & Hygiene'
  WHEN 'Isopropyl alcohol 70 % (Cồn 70 %)' THEN 'Sanitation & Hygiene'
  WHEN 'Lint-free wipes (Bông không xơ)' THEN 'Sanitation & Hygiene'
  WHEN 'Pedicure basin liners (Túi lót bồn chân)' THEN 'Sanitation & Hygiene'
  WHEN 'Surface disinfectant spray (Xịt khử trùng bề mặt)' THEN 'Sanitation & Hygiene'
  WHEN 'Trash bags – small (Túi rác nhỏ)' THEN 'Sanitation & Hygiene'

  -- Furniture & Fixtures (11 items)
  WHEN 'Arm rest cushion (Gối kê tay)' THEN 'Furniture & Fixtures'
  WHEN 'Client chair – manicure (Ghế khách manicure)' THEN 'Furniture & Fixtures'
  WHEN 'Foot rest (Kê chân)' THEN 'Furniture & Fixtures'
  WHEN 'Manicure table (Bàn làm móng)' THEN 'Furniture & Fixtures'
  WHEN 'Nail polish display rack (Kệ trưng bày sơn)' THEN 'Furniture & Fixtures'
  WHEN 'Pedicure spa / basin (Bồn ngâm chân)' THEN 'Furniture & Fixtures'
  WHEN 'Pedicure throne / chair (Ghế pedicure)' THEN 'Furniture & Fixtures'
  WHEN 'Supply cart / trolley (Xe đẩy dụng cụ)' THEN 'Furniture & Fixtures'
  WHEN 'Table lamp – LED (Đèn bàn LED)' THEN 'Furniture & Fixtures'
  WHEN 'Technician stool / chair (Ghế thợ)' THEN 'Furniture & Fixtures'
  WHEN 'Paraffin wax bath (Bồn sáp paraffin)' THEN 'Furniture & Fixtures'

  -- Consumables & Misc (10 items)
  WHEN 'Air freshener / diffuser refill (Tinh dầu khuếch tán)' THEN 'Consumables & Misc'
  WHEN 'Massage oil (Dầu massage)' THEN 'Consumables & Misc'
  WHEN 'Appointment cards (Thẻ hẹn)' THEN 'Consumables & Misc'
  WHEN 'Disposable flip-flops (Dép xỏ ngón)' THEN 'Consumables & Misc'
  WHEN 'Exfoliating scrub (Kem tẩy tế bào)' THEN 'Consumables & Misc'
  WHEN 'Gift cards / vouchers (Thẻ quà tặng)' THEN 'Consumables & Misc'
  WHEN 'Hand / foot lotion (Kem dưỡng tay chân)' THEN 'Consumables & Misc'
  WHEN 'Paraffin wax refill (Sáp paraffin)' THEN 'Consumables & Misc'
  WHEN 'Receipt paper roll (Giấy hóa đơn)' THEN 'Consumables & Misc'
  WHEN 'Spa salt / bath soak (Muối ngâm)' THEN 'Consumables & Misc'

  ELSE category
END
WHERE category = 'Nail Polish & Products'
  AND name NOT LIKE 'DND %';

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
