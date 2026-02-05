/*
  # Create Floor Plan Tables

  1. New Tables
    - `floor_plans`
      - `id` (uuid, primary key)
      - `name` (text)
      - `width` (numeric) - width in meters
      - `height` (numeric) - height in meters
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
      - `user_id` (uuid) - for future auth integration
    
    - `furniture_items`
      - `id` (uuid, primary key)
      - `floor_plan_id` (uuid, foreign key)
      - `type` (text) - 'table' or 'chair'
      - `x` (numeric) - x position in meters
      - `y` (numeric) - y position in meters
      - `width` (numeric) - width in meters
      - `height` (numeric) - height in meters
      - `rotation` (numeric) - rotation in degrees
      - `created_at` (timestamp)
  
  2. Security
    - Enable RLS on both tables
    - Add policies for public access (can be restricted later with auth)
*/

CREATE TABLE IF NOT EXISTS floor_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'New Floor Plan',
  width numeric NOT NULL,
  height numeric NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  user_id uuid
);

CREATE TABLE IF NOT EXISTS furniture_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  floor_plan_id uuid NOT NULL REFERENCES floor_plans(id) ON DELETE CASCADE,
  type text NOT NULL,
  x numeric NOT NULL DEFAULT 0,
  y numeric NOT NULL DEFAULT 0,
  width numeric NOT NULL,
  height numeric NOT NULL,
  rotation numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE floor_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE furniture_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to floor_plans"
  ON floor_plans FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to floor_plans"
  ON floor_plans FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to floor_plans"
  ON floor_plans FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to floor_plans"
  ON floor_plans FOR DELETE
  TO public
  USING (true);

CREATE POLICY "Allow public read access to furniture_items"
  ON furniture_items FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to furniture_items"
  ON furniture_items FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to furniture_items"
  ON furniture_items FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to furniture_items"
  ON furniture_items FOR DELETE
  TO public
  USING (true);

CREATE INDEX IF NOT EXISTS idx_furniture_items_floor_plan_id ON furniture_items(floor_plan_id);