import { supabase, SUPABASE_STATUS } from "./supabase";
import { Product, Category, Supplier } from "../types";
import { compressImage } from "./imageCompressor";

// Helper keys for local storage
const KEYS = {
  PRODUCTS: "ponto_products_local",
  CATEGORIES: "ponto_categories_local",
  SUPPLIERS: "ponto_suppliers_local",
};

// Initial data corresponding to the user's screenshots
const INITIAL_CATEGORIES: Category[] = [
  { id: "cat-guarda-roupas", name: "Guarda Roupas" },
  { id: "cat-mesas", name: "Mesas" },
  { id: "cat-comodas", name: "Comodas" },
  { id: "cat-rack", name: "Rack Home e Painel" },
  { id: "cat-armarios", name: "Armários" },
  { id: "cat-banho", name: "Banho" },
];

const INITIAL_SUPPLIERS: Supplier[] = [
  { id: "sup-baiao", name: "Baião" },
  { id: "sup-balcao", name: "Balcão" },
  { id: "sup-jr-colchoes", name: "Jr Colchões" },
];

const INITIAL_PRODUCTS: Product[] = [
  {
    id: "prod-1",
    name: "Aéreo São Luiz",
    category_id: "cat-armarios",
    supplier_id: "sup-baiao",
    price_full: 358.72,
    discount_percent: 0,
    profit_desired: 120.0,
    cost_real: 358.72,
    price_final: 478.72,
    description: "Armário Aéreo São Luiz de alta qualidade com acabamento primoroso, perfeito para sua cozinha doméstica.",
    images: ["https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=400&q=80"],
  },
  {
    id: "prod-2",
    name: "Cozinha 4 Peças Cristal",
    category_id: "cat-armarios",
    supplier_id: "sup-baiao",
    price_full: 999.52,
    discount_percent: 0,
    profit_desired: 300.0,
    cost_real: 999.52,
    price_final: 1299.52,
    description: "Cozinha modular modulada completa da linha Cristal com 4 peças elegantes, amplo espaço interno de armazenagem, armários suspensos e paneleiro moderno.",
    images: ["https://images.unsplash.com/photo-1556912173-3bb406ef7e77?auto=format&fit=crop&w=400&q=80"],
  },
];

// Initialize local databases if needed
export function initializeLocalData() {
  if (!localStorage.getItem(KEYS.CATEGORIES)) {
    localStorage.setItem(KEYS.CATEGORIES, JSON.stringify(INITIAL_CATEGORIES));
  }
  if (!localStorage.getItem(KEYS.SUPPLIERS)) {
    localStorage.setItem(KEYS.SUPPLIERS, JSON.stringify(INITIAL_SUPPLIERS));
  }
  if (!localStorage.getItem(KEYS.PRODUCTS)) {
    localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(INITIAL_PRODUCTS));
  }
}

// Ensure local storage is initialized
initializeLocalData();

// Robust helper to write products to localStorage, handling QuotaExceededError automatically
async function saveProductsLocal(products: Product[]): Promise<void> {
  try {
    localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(products));
  } catch (err: any) {
    const isQuotaError = 
      err.name === "QuotaExceededError" || 
      err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      err.message?.toLowerCase().includes("exceeded the quota") ||
      err.code === 22;

    if (isQuotaError) {
      console.warn("Storage quota exceeded! Executing automatic compression of product photos...");
      
      // Attempt compression of images in all products
      const compressedProducts = await Promise.all(
        products.map(async (prod) => {
          if (!prod.images || prod.images.length === 0) return prod;
          
          try {
            const compressedImages = await Promise.all(
              prod.images.map(img => compressImage(img, 400, 400, 0.5)) // aggressive compression for quota relief!
            );
            return {
              ...prod,
              images: compressedImages
            };
          } catch (compressErr) {
            console.error("Failed to compress image for product:", prod.name, compressErr);
            return prod;
          }
        })
      );
      
      try {
        localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(compressedProducts));
        console.log("Successfully saved compressed products! Space saved from automatic compression.");
        // Sync in-place data properties if needed
        compressedProducts.forEach((cp, idx) => {
          if (products[idx]) {
            products[idx].images = cp.images;
          }
        });
      } catch (retryErr: any) {
        console.error("Critical: Quota still exceeded after compressing images! Dropping large base64 images as fallback...", retryErr);
        // Discard bulky base64 data strings, keep remote URLs
        const trimmedProducts = products.map((p) => {
          if (!p.images) return p;
          return {
            ...p,
            images: p.images.filter(img => !img.startsWith("data:image/")),
          };
        });

        try {
          localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(trimmedProducts));
          trimmedProducts.forEach((tp, idx) => {
            if (products[idx]) {
              products[idx].images = tp.images;
            }
          });
          console.warn("Removed base64 images to prevent application crash from browser storage limitation.");
        } catch (finalErr) {
          throw new Error("Não foi possível salvar os dados devido a limite de espaço do navegador, mesmo removendo as imagens.");
        }
      }
    } else {
      throw err;
    }
  }
}

export const StorageService = {
  isSupabaseActive(): boolean {
    return SUPABASE_STATUS.isConfigured && supabase !== null;
  },

  // 1. CATEGORIES CRUD
  async getCategories(): Promise<Category[]> {
    if (this.isSupabaseActive() && supabase) {
      try {
        const { data, error } = await supabase
          .from("ponto_categories")
          .select("*")
          .order("name");
        if (error) throw error;
        return data || [];
      } catch (err) {
        console.error("Supabase error fetching categories, falling back:", err);
      }
    }
    const local = localStorage.getItem(KEYS.CATEGORIES);
    return local ? JSON.parse(local) : INITIAL_CATEGORIES;
  },

  async addCategory(name: string): Promise<Category> {
    const newCat: Category = {
      id: "cat-" + Math.random().toString(36).substr(2, 9),
      name: name.trim(),
    };

    if (this.isSupabaseActive() && supabase) {
      try {
        const { data, error } = await supabase
          .from("ponto_categories")
          .insert([{ name: name.trim() }])
          .select();
        if (error) throw error;
        if (data && data[0]) return data[0];
      } catch (err) {
        console.error("Supabase error inserting category, falling back:", err);
      }
    }

    const categories = await this.getCategories();
    categories.push(newCat);
    localStorage.setItem(KEYS.CATEGORIES, JSON.stringify(categories));
    return newCat;
  },

  async deleteCategory(id: string): Promise<boolean> {
    if (this.isSupabaseActive() && supabase) {
      try {
        const { error } = await supabase
          .from("ponto_categories")
          .delete()
          .eq("id", id);
        if (error) throw error;
        return true;
      } catch (err) {
        console.error("Supabase error deleting category, falling back:", err);
      }
    }

    const categories = await this.getCategories();
    const filtered = categories.filter((c) => c.id !== id);
    localStorage.setItem(KEYS.CATEGORIES, JSON.stringify(filtered));
    return true;
  },

  // 2. SUPPLIERS CRUD
  async getSuppliers(): Promise<Supplier[]> {
    if (this.isSupabaseActive() && supabase) {
      try {
        const { data, error } = await supabase
          .from("ponto_suppliers")
          .select("*")
          .order("name");
        if (error) throw error;
        return data || [];
      } catch (err) {
        console.error("Supabase error fetching suppliers, falling back:", err);
      }
    }
    const local = localStorage.getItem(KEYS.SUPPLIERS);
    return local ? JSON.parse(local) : INITIAL_SUPPLIERS;
  },

  async addSupplier(name: string): Promise<Supplier> {
    const newSup: Supplier = {
      id: "sup-" + Math.random().toString(36).substr(2, 9),
      name: name.trim(),
    };

    if (this.isSupabaseActive() && supabase) {
      try {
        const { data, error } = await supabase
          .from("ponto_suppliers")
          .insert([{ name: name.trim() }])
          .select();
        if (error) throw error;
        if (data && data[0]) return data[0];
      } catch (err) {
        console.error("Supabase error inserting supplier, falling back:", err);
      }
    }

    const suppliers = await this.getSuppliers();
    suppliers.push(newSup);
    localStorage.setItem(KEYS.SUPPLIERS, JSON.stringify(suppliers));
    return newSup;
  },

  async deleteSupplier(id: string): Promise<boolean> {
    if (this.isSupabaseActive() && supabase) {
      try {
        const { error } = await supabase
          .from("ponto_suppliers")
          .delete()
          .eq("id", id);
        if (error) throw error;
        return true;
      } catch (err) {
        console.error("Supabase error deleting supplier, falling back:", err);
      }
    }

    const suppliers = await this.getSuppliers();
    const filtered = suppliers.filter((s) => s.id !== id);
    localStorage.setItem(KEYS.SUPPLIERS, JSON.stringify(filtered));
    return true;
  },

  // 3. PRODUCTS CRUD
  async getProducts(): Promise<Product[]> {
    if (this.isSupabaseActive() && supabase) {
      try {
        const { data, error } = await supabase
          .from("ponto_products")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        return data || [];
      } catch (err) {
        console.error("Supabase error fetching products, falling back:", err);
      }
    }
    const local = localStorage.getItem(KEYS.PRODUCTS);
    return local ? JSON.parse(local) : INITIAL_PRODUCTS;
  },

  async addProduct(product: Omit<Product, "id">): Promise<Product> {
    const newProd: Product = {
      ...product,
      id: "prod-" + Math.random().toString(36).substr(2, 9),
    };

    if (this.isSupabaseActive() && supabase) {
      try {
        const { data, error } = await supabase
          .from("ponto_products")
          .insert([product])
          .select();
        if (error) throw error;
        if (data && data[0]) return data[0];
      } catch (err) {
        console.error("Supabase error inserting product, falling back:", err);
      }
    }

    const products = await this.getProducts();
    products.unshift(newProd);
    await saveProductsLocal(products);
    return newProd;
  },

  async updateProduct(product: Product): Promise<Product> {
    if (this.isSupabaseActive() && supabase) {
      try {
        // Exclude id from updated fields in Supabase
        const { id, created_at, ...rest } = product;
        const { data, error } = await supabase
          .from("ponto_products")
          .update(rest)
          .eq("id", id)
          .select();
        if (error) throw error;
        if (data && data[0]) return data[0];
      } catch (err) {
        console.error("Supabase error updating product, falling back:", err);
      }
    }

    const products = await this.getProducts();
    const idx = products.findIndex((p) => p.id === product.id);
    if (idx !== -1) {
      products[idx] = product;
      await saveProductsLocal(products);
    }
    return product;
  },

  async deleteProduct(id: string): Promise<boolean> {
    if (this.isSupabaseActive() && supabase) {
      try {
        const { error } = await supabase
          .from("ponto_products")
          .delete()
          .eq("id", id);
        if (error) throw error;
        return true;
      } catch (err) {
        console.error("Supabase error deleting product, falling back:", err);
      }
    }

    const products = await this.getProducts();
    const filtered = products.filter((p) => p.id !== id);
    await saveProductsLocal(filtered);
    return true;
  },

  async deleteMultipleProducts(ids: string[]): Promise<boolean> {
    if (this.isSupabaseActive() && supabase) {
      try {
        const { error } = await supabase
          .from("ponto_products")
          .delete()
          .in("id", ids);
        if (error) throw error;
        return true;
      } catch (err) {
        console.error("Supabase error bulk deleting products, falling back:", err);
      }
    }

    const products = await this.getProducts();
    const filtered = products.filter((p) => !ids.includes(p.id));
    await saveProductsLocal(filtered);
    return true;
  },

  // BULK UPDATE PRICES
  async bulkUpdatePricing(params: {
    supplierId: string; // "all" or specific
    priceRange: string; // "all", "0-500", "500-1000", "1000+"
    discountPercent: number; // general discount % to set
    fixedProfit: number; // added general profit to add or adjust
  }): Promise<Product[]> {
    const products = await this.getProducts();
    const updatedProducts = products.map((prod) => {
      // Check supplier match
      if (params.supplierId !== "all" && prod.supplier_id !== params.supplierId) {
        return prod;
      }

      // Check price range match
      let inRange = false;
      if (params.priceRange === "all") {
        inRange = true;
      } else if (params.priceRange === "0-500" && prod.price_full <= 500) {
        inRange = true;
      } else if (params.priceRange === "500-1000" && prod.price_full > 500 && prod.price_full <= 1000) {
        inRange = true;
      } else if (params.priceRange === "1000+" && prod.price_full > 1000) {
        inRange = true;
      }

      if (!inRange) {
        return prod;
      }

      // Update calculations
      const price_full = prod.price_full;
      const discount_percent = params.discountPercent;
      const cost_real = price_full * (1 - discount_percent / 100);
      const profit_desired = params.fixedProfit;
      const price_final = cost_real + profit_desired;

      return {
        ...prod,
        discount_percent,
        profit_desired,
        cost_real,
        price_final,
      };
    });

    // Save all updated products
    if (this.isSupabaseActive() && supabase) {
      try {
        // Real bulk update for Supabase can be tricky without stored procedures,
        // so we save them individually in parallel or sequential in background.
        for (const item of updatedProducts) {
          const { id, created_at, ...rest } = item;
          await supabase.from("ponto_products").update(rest).eq("id", id);
        }
      } catch (err) {
        console.error("Supabase bulk update error, falling back:", err);
      }
    }

    await saveProductsLocal(updatedProducts);
    return updatedProducts;
  },

  async updateMultipleProducts(updatedProducts: Product[]): Promise<Product[]> {
    if (this.isSupabaseActive() && supabase) {
      try {
        for (const item of updatedProducts) {
          const { id, created_at, ...rest } = item;
          await supabase.from("ponto_products").update(rest).eq("id", id);
        }
      } catch (err) {
        console.error("Supabase bulk update error, falling back:", err);
      }
    }

    const current = await this.getProducts();
    const updatedMap = new Map(updatedProducts.map((p) => [p.id, p]));
    const newProducts = current.map((p) => {
      const match = updatedMap.get(p.id);
      return match ? match : p;
    });

    await saveProductsLocal(newProducts);
    return newProducts;
  },

  async importFullBackup(
    backup: {
      categories?: Category[];
      suppliers?: Supplier[];
      products?: Product[];
    },
    mode: "replace" | "merge"
  ): Promise<{
    success: boolean;
    categoriesCount: number;
    suppliersCount: number;
    productsCount: number;
    supabaseSynced: boolean;
    error?: string;
  }> {
    try {
      const incomingCategories = Array.isArray(backup.categories) ? backup.categories : [];
      const incomingSuppliers = Array.isArray(backup.suppliers) ? backup.suppliers : [];
      const incomingProducts = Array.isArray(backup.products) ? backup.products : [];

      let finalCategories: Category[] = [];
      let finalSuppliers: Supplier[] = [];
      let finalProducts: Product[] = [];

      if (mode === "replace") {
        finalCategories = incomingCategories;
        finalSuppliers = incomingSuppliers;
        finalProducts = incomingProducts;
      } else {
        const existingCategories = await this.getCategories();
        const existingSuppliers = await this.getSuppliers();
        const existingProducts = await this.getProducts();

        const catIds = new Set(existingCategories.map((c) => c.id));
        finalCategories = [...existingCategories, ...incomingCategories.filter((c) => !catIds.has(c.id))];

        const supIds = new Set(existingSuppliers.map((s) => s.id));
        finalSuppliers = [...existingSuppliers, ...incomingSuppliers.filter((s) => !supIds.has(s.id))];

        const prodIds = new Set(existingProducts.map((p) => p.id));
        finalProducts = [...existingProducts, ...incomingProducts.filter((p) => !prodIds.has(p.id))];
      }

      // Save locally
      localStorage.setItem(KEYS.CATEGORIES, JSON.stringify(finalCategories));
      localStorage.setItem(KEYS.SUPPLIERS, JSON.stringify(finalSuppliers));
      await saveProductsLocal(finalProducts);

      let supabaseSynced = false;
      if (this.isSupabaseActive() && supabase) {
        try {
          if (mode === "replace") {
            // Delete existing
            await supabase.from("ponto_products").delete().neq("id", "00000000-0000-0000-0000-000000000000");
            await supabase.from("ponto_suppliers").delete().neq("id", "00000000-0000-0000-0000-000000000000");
            await supabase.from("ponto_categories").delete().neq("id", "00000000-0000-0000-0000-000000000000");
          }

          // Insert Categories
          if (finalCategories.length > 0) {
            const { error: catErr } = await supabase.from("ponto_categories").upsert(
              finalCategories.map(c => ({ id: c.id, name: c.name }))
            );
            if (catErr) console.warn("Supabase category restore warn:", catErr);
          }

          // Insert Suppliers
          if (finalSuppliers.length > 0) {
            const { error: supErr } = await supabase.from("ponto_suppliers").upsert(
              finalSuppliers.map(s => ({ id: s.id, name: s.name }))
            );
            if (supErr) console.warn("Supabase supplier restore warn:", supErr);
          }

          // Insert Products
          if (finalProducts.length > 0) {
            const formattedProducts = finalProducts.map(p => {
              const { created_at, ...rest } = p;
              return {
                ...rest,
                images: Array.isArray(p.images) ? p.images : [],
              };
            });

            const { error: prodErr } = await supabase.from("ponto_products").upsert(formattedProducts);
            if (prodErr) console.warn("Supabase products restore warn:", prodErr);
          }

          supabaseSynced = true;
        } catch (subErr) {
          console.error("Erro ao sincronizar restore com Supabase:", subErr);
        }
      }

      return {
        success: true,
        categoriesCount: finalCategories.length,
        suppliersCount: finalSuppliers.length,
        productsCount: finalProducts.length,
        supabaseSynced,
      };
    } catch (err: any) {
      console.error("Erro ao processar restauraçao de backup:", err);
      return {
        success: false,
        categoriesCount: 0,
        suppliersCount: 0,
        productsCount: 0,
        supabaseSynced: false,
        error: err.message || "Erro desconhecido",
      };
    }
  }
};
