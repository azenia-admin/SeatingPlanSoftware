export interface FurnitureItem {
  id: string;
  floor_plan_id: string;
  type: 'table' | 'chair';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
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
  type: 'table' | 'chair';
  width: number;
  height: number;
  label: string;
}
