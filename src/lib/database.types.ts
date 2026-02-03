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
        }
      }
    }
  }
}
