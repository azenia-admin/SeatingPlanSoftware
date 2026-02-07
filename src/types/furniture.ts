export interface FurnitureItem {
  id: string;
  floor_plan_id: string;
  type: 'table' | 'chair' | 'row';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  group_id?: string | null;
  category?: string | null;
  section_label?: string | null;
  seat_count?: number | null;
  curve?: number | null;
  seat_spacing?: number | null;
  row_label?: string | null;
  row_label_enabled?: boolean | null;
  chair_count?: number | null;
  open_spaces?: number | null;
  automatic_radius?: boolean | null;
  table_label?: string | null;
  table_label_visible?: boolean | null;
  seat_label_start?: number | null;
  seat_label_direction?: string | null;
  row_label_format?: string | null;
  row_label_start_at?: number | null;
  row_label_direction?: string | null;
  row_label_position?: string | null;
  row_displayed_type?: string | null;
  seat_label_format?: string | null;
  seat_displayed_type?: string | null;
  seat_label_enabled?: boolean | null;
  seat_label_start_at?: number | null;
  seat_label_dir?: string | null;
}

export interface FloorPlan {
  id: string;
  name: string;
  width: number;
  height: number;
  created_at: string;
  updated_at: string;
  user_id: string | null;
}

export interface FurnitureTemplate {
  type: 'table' | 'chair' | 'row';
  width: number;
  height: number;
  label: string;
  chairs?: number;
}
