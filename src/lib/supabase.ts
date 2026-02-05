import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Environment check:', {
    VITE_SUPABASE_URL: supabaseUrl,
    VITE_SUPABASE_ANON_KEY: supabaseAnonKey ? 'present' : 'missing',
  });
  throw new Error(
    'Missing Supabase environment variables. Please restart the dev server for .env changes to take effect.'
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
