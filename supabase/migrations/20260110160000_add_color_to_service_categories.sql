-- Add color column to store_service_categories
-- Colors: pink, blue, purple, green, yellow

ALTER TABLE store_service_categories
ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT 'pink';

-- Set default colors for existing categories based on their names
UPDATE store_service_categories SET color = 'blue' WHERE name ILIKE '%pédicure%' OR name ILIKE '%pedicure%';
UPDATE store_service_categories SET color = 'pink' WHERE name ILIKE '%manucure%' OR name ILIKE '%manicure%';
UPDATE store_service_categories SET color = 'purple' WHERE name ILIKE '%extension%';
UPDATE store_service_categories SET color = 'green' WHERE name = 'Others';

-- Add comment for documentation
COMMENT ON COLUMN store_service_categories.color IS 'Category color key: pink, blue, purple, green, yellow';
