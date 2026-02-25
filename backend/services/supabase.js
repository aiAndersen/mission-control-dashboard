import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

// Support both backend (SUPABASE_URL) and Vercel frontend (VITE_SUPABASE_URL) env var naming
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.warn('[Supabase] WARNING: Supabase environment variables not set. Database operations will fail.')
}

export const supabase = createClient(supabaseUrl || '', supabaseKey || '')
