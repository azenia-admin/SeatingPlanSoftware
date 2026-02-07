/*
  # Add seat label properties

  1. Modified Tables
    - `furniture_items`
      - `seat_label_enabled` (boolean, default false) - whether seat labels are shown
      - `seat_label_start_at` (integer, default 1) - starting number/index for seat labels
  2. Notes
    - Seat labels are disabled by default (chairs show no text)
    - When enabled, each seat displays its computed label based on seat_label_format
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'furniture_items' AND column_name = 'seat_label_enabled'
  ) THEN
    ALTER TABLE furniture_items ADD COLUMN seat_label_enabled boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'furniture_items' AND column_name = 'seat_label_start_at'
  ) THEN
    ALTER TABLE furniture_items ADD COLUMN seat_label_start_at integer DEFAULT 1;
  END IF;
END $$;