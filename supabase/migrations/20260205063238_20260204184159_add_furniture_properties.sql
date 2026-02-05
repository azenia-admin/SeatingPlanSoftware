/*
  # Add furniture item properties for rows and tables

  1. New Columns
    - `category` (text) - Category assignment for organization
    - `seat_count` (integer) - Number of seats in a row
    - `curve` (numeric) - Curve amount for rows (0 = straight)
    - `seat_spacing` (numeric) - Spacing between seats in points
    - `row_label` (text) - Custom label for rows
    - `row_label_enabled` (boolean) - Whether row labeling is enabled
    - `section_label` (text) - Section label for grouping
    - `chair_count` (integer) - Number of chairs around a table
    - `open_spaces` (integer) - Number of open spaces (no chairs)
    - `automatic_radius` (boolean) - Auto-calculate table radius
    - `rotation` (numeric) - Rotation angle in degrees
    - `table_label` (text) - Custom label for tables
    - `table_label_visible` (boolean) - Whether table label is visible
    - `seat_label_start` (integer) - Starting number for seat labels
    - `seat_label_direction` (text) - Direction for seat numbering

  2. Notes
    - All new columns are nullable with sensible defaults
    - Properties are specific to row or table type
*/

-- Add category and section label (common to both)
ALTER TABLE furniture_items
ADD COLUMN IF NOT EXISTS category text,
ADD COLUMN IF NOT EXISTS section_label text;

-- Row-specific properties
ALTER TABLE furniture_items
ADD COLUMN IF NOT EXISTS seat_count integer,
ADD COLUMN IF NOT EXISTS curve numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS seat_spacing numeric DEFAULT 1,
ADD COLUMN IF NOT EXISTS row_label text,
ADD COLUMN IF NOT EXISTS row_label_enabled boolean DEFAULT true;

-- Table-specific properties
ALTER TABLE furniture_items
ADD COLUMN IF NOT EXISTS chair_count integer,
ADD COLUMN IF NOT EXISTS open_spaces integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS automatic_radius boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS rotation numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS table_label text,
ADD COLUMN IF NOT EXISTS table_label_visible boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS seat_label_start integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS seat_label_direction text DEFAULT 'clockwise';