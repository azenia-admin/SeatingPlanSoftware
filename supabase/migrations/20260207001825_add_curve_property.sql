/*
  # Add curve property to furniture_items

  1. Changes
    - Add `curve` column to `furniture_items` table
      - Type: numeric (double precision)
      - Default: 0 (straight line)
      - Used to define arc curvature for row seating
      - curve = 0 means straight line
      - curve > 0 creates circular arc (larger = tighter arc)

  2. Notes
    - This enables professional seating chart curved row functionality
    - All rows in a multi-row group share the same curve value
    - Seats are positioned along the arc with even spacing
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'furniture_items' AND column_name = 'curve'
  ) THEN
    ALTER TABLE furniture_items ADD COLUMN curve double precision DEFAULT 0 NOT NULL;
  END IF;
END $$;