/*
  # Add 'row' type to furniture_items

  1. Changes
    - Update the type check constraint on furniture_items table to include 'row' as a valid type
    
  2. Notes
    - This allows furniture items to be of type 'row' in addition to 'table' and 'chair'
    - Rows represent horizontal arrangements of chairs for free seating
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'furniture_items_type_check'
  ) THEN
    ALTER TABLE furniture_items DROP CONSTRAINT furniture_items_type_check;
  END IF;
END $$;

ALTER TABLE furniture_items 
ADD CONSTRAINT furniture_items_type_check 
CHECK (type IN ('table', 'chair', 'row'));
