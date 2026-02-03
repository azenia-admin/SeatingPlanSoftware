/*
  # Add group_id to furniture_items

  1. Changes
    - Add `group_id` column to `furniture_items` table
    - This allows grouping related furniture items together (e.g., table with chairs)
    - Items in the same group will move, select, and delete together
  
  2. Notes
    - Uses uuid type to match existing ID columns
    - Nullable to support items that aren't part of a group
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'furniture_items' AND column_name = 'group_id'
  ) THEN
    ALTER TABLE furniture_items ADD COLUMN group_id uuid;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_furniture_items_group_id ON furniture_items(group_id);
