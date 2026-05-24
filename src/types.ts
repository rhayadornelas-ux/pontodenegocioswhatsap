export interface Category {
  id: string;
  name: string;
  created_at?: string;
}

export interface Supplier {
  id: string;
  name: string;
  created_at?: string;
}

export interface Product {
  id: string;
  name: string;
  category_id: string;
  supplier_id: string;
  price_full: number;
  discount_percent: number;
  profit_desired: number;
  cost_real: number;
  price_final: number;
  description: string;
  images: string[]; // Base64 strings or URLs
  pin_index?: number | null;
  created_at?: string;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}
