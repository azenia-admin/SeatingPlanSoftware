import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient<Database> = isSupabaseConfigured
  ? createClient<Database>(supabaseUrl, supabaseAnonKey)
  : (null as unknown as SupabaseClient<Database>);
