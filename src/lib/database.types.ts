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
      events: {
        Row: {
          id: string
          title: string
          event_date: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          event_date?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          event_date?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      layouts: {
        Row: {
          id: string
          event_id: string
          name: string | null
          width: number
          height: number
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          event_id: string
          name?: string | null
          width?: number
          height?: number
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          name?: string | null
          width?: number
          height?: number
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
      layout_items: {
        Row: {
          id: string
          layout_id: string
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
          row_label_format: string | null
          row_label_start_at: number | null
          row_label_direction: string | null
          row_label_position: string | null
          row_displayed_type: string | null
          seat_label_format: string | null
          seat_displayed_type: string | null
          seat_label_enabled: boolean | null
          seat_label_start_at: number | null
          seat_label_dir: string | null
        }
        Insert: {
          id?: string
          layout_id: string
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
          row_label_format?: string | null
          row_label_start_at?: number | null
          row_label_direction?: string | null
          row_label_position?: string | null
          row_displayed_type?: string | null
          seat_label_format?: string | null
          seat_displayed_type?: string | null
          seat_label_enabled?: boolean | null
          seat_label_start_at?: number | null
          seat_label_dir?: string | null
        }
        Update: {
          id?: string
          layout_id?: string
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
          row_label_format?: string | null
          row_label_start_at?: number | null
          row_label_direction?: string | null
          row_label_position?: string | null
          row_displayed_type?: string | null
          seat_label_format?: string | null
          seat_displayed_type?: string | null
          seat_label_enabled?: boolean | null
          seat_label_start_at?: number | null
          seat_label_dir?: string | null
        }
      }
      event_seats: {
        Row: {
          id: string
          event_id: string
          seat_number: string
          row_label: string | null
          section_label: string | null
          x: number
          y: number
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          seat_number: string
          row_label?: string | null
          section_label?: string | null
          x: number
          y: number
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          seat_number?: string
          row_label?: string | null
          section_label?: string | null
          x?: number
          y?: number
          status?: string
          created_at?: string
        }
      }
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
