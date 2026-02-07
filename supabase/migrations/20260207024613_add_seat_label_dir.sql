/*
  # Add seat label direction for rows

  1. Modified Tables
    - `furniture_items`
      - `seat_label_dir` (text, default 'ltr') - direction of seat numbering within a row (ltr or rtl)
  2. Notes
    - 'ltr' means labels go 1,2,3 from left to right
    - 'rtl' means labels go 1,2,3 from right to left
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'furniture_items' AND column_name = 'seat_label_dir'
  ) THEN
    ALTER TABLE furniture_items ADD COLUMN seat_label_dir text DEFAULT 'ltr';
  END IF;
END $$;