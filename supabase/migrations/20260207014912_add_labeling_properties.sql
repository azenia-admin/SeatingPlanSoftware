/*
  # Add row and seat labeling properties

  1. New Columns on `furniture_items`
    - `row_label_format` (text) - Format scheme for row labels (numbers, letters, LETTERS, roman, ROMAN)
    - `row_label_start_at` (integer) - Starting value for row label numbering, default 1
    - `row_label_direction` (text) - Numbering direction for rows (ltr or rtl), default 'ltr'
    - `row_label_position` (text) - Position of label relative to row, default 'auto'
    - `row_displayed_type` (text) - Display name for the row type, default 'Row'
    - `seat_label_format` (text) - Format scheme for seat labels (numbers, letters, LETTERS, roman, ROMAN)
    - `seat_displayed_type` (text) - Display name for the seat type, default 'Seat'

  2. Notes
    - All columns are nullable with sensible defaults
    - Used by the Row labeling and Seat labeling sidebar sections
    - label_format options: 'numbers' (1,2,3), 'letters' (a,b,c), 'LETTERS' (A,B,C), 'roman' (i,ii,iii), 'ROMAN' (I,II,III)
    - label_position options: 'auto', 'left', 'center-left', 'center', 'center-right', 'right'
*/

ALTER TABLE furniture_items
ADD COLUMN IF NOT EXISTS row_label_format text DEFAULT 'numbers',
ADD COLUMN IF NOT EXISTS row_label_start_at integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS row_label_direction text DEFAULT 'ltr',
ADD COLUMN IF NOT EXISTS row_label_position text DEFAULT 'auto',
ADD COLUMN IF NOT EXISTS row_displayed_type text DEFAULT 'Row',
ADD COLUMN IF NOT EXISTS seat_label_format text DEFAULT 'numbers',
ADD COLUMN IF NOT EXISTS seat_displayed_type text DEFAULT 'Seat';
