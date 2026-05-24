import { createClient } from "@supabase/supabase-js";

// Retrieve Vite environment variables safely (with your variables as default fallbacks).
const rawUrl = (import.meta as any).env.VITE_SUPABASE_URL || "https://bbtqbfgipdjrumrramsx.supabase.co/rest/v1/";
const supabaseUrl = rawUrl.trim().replace(/\/rest\/v1\/?$/, "");
const supabaseAnonKey = ((import.meta as any).env.VITE_SUPABASE_ANON_KEY || "sb_publishable_Cnq3hcmUwxgSAA0YNjZ6cg_zVIIK-gl").trim();

const isConfigured = supabaseUrl !== "" && supabaseAnonKey !== "";

export const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export const SUPABASE_STATUS = {
  isConfigured,
  url: supabaseUrl,
};
