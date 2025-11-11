/*
  # Remove Unused Index

  1. Changes
    - Drop unused index idx_ticket_items_completed_by on ticket_items table
    - This index has not been used and is consuming storage unnecessarily

  2. Performance
    - Reduces storage overhead
    - Improves write performance on ticket_items table
*/

DROP INDEX IF EXISTS idx_ticket_items_completed_by;
