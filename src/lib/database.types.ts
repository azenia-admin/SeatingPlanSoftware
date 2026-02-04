export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      floor_plans: {
        Row: {
          id: string
          name: string
          width: number
          height: number
          created_at: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          id?: string
          name?: string
          width: number
          height: number
          created_at?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          id?: string
          name?: string
          width?: number
          height?: number
          created_at?: string
          updated_at?: string
          user_id?: string | null
        }
      }
      furniture_items: {
        Row: {
          id: string
          floor_plan_id: string
          type: string
          x: number
          y: number
          width: number
          height: number
          rotation: number
          created_at: string
          group_id: string | null
          category: string | null
          section_label: string | null
          seat_count: number | null
          curve: number | null
          seat_spacing: number | null
          row_label: string | null
          row_label_enabled: boolean | null
          chair_count: number | null
          open_spaces: number | null
          automatic_radius: boolean | null
          table_label: string | null
          table_label_visible: boolean | null
          seat_label_start: number | null
          seat_label_direction: string | null
        }
        Insert: {
          id?: string
          floor_plan_id: string
          type: string
          x?: number
          y?: number
          width: number
          height: number
          rotation?: number
          created_at?: string
          group_id?: string | null
          category?: string | null
          section_label?: string | null
          seat_count?: number | null
          curve?: number | null
          seat_spacing?: number | null
          row_label?: string | null
          row_label_enabled?: boolean | null
          chair_count?: number | null
          open_spaces?: number | null
          automatic_radius?: boolean | null
          table_label?: string | null
          table_label_visible?: boolean | null
          seat_label_start?: number | null
          seat_label_direction?: string | null
        }
        Update: {
          id?: string
          floor_plan_id?: string
          type?: string
          x?: number
          y?: number
          width?: number
          height?: number
          rotation?: number
          created_at?: string
          group_id?: string | null
          category?: string | null
          section_label?: string | null
          seat_count?: number | null
          curve?: number | null
          seat_spacing?: number | null
          row_label?: string | null
          row_label_enabled?: boolean | null
          chair_count?: number | null
          open_spaces?: number | null
          automatic_radius?: boolean | null
          table_label?: string | null
          table_label_visible?: boolean | null
          seat_label_start?: number | null
          seat_label_direction?: string | null
        }
      }
    }
  }
}
