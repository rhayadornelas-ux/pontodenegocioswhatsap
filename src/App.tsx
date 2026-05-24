import React, { useState, useEffect } from "react";
import { 
  Building2, 
  Tag, 
  MapPin, 
  Handshake, 
  Search, 
  Filter, 
  SlidersHorizontal, 
  Sparkles, 
  Database,
  ArrowUpDown,
  Layers,
  Percent,
  Coins,
  Type,
  CheckCircle,
  HelpCircle,
  Truck,
  CreditCard,
  ShieldCheck,
  Lock,
  Unlock,
  LogOut,
  ChevronRight,
  Share2,
  Copy,
  Plus,
  Trash2,
  X,
  Pin,
  MessageCircle,
  Star
} from "lucide-react";

import { Category, Supplier, Product } from "./types";
import { StorageService } from "./lib/storage";

// Components
import ProductCard from "./components/ProductCard";
import AddProductForm from "./components/AddProductForm";
import BulkImportForm from "./components/BulkImportForm";
import ManageCategories from "./components/ManageCategories";
import ManageSuppliers from "./components/ManageSuppliers";
import BulkAdjustPrices from "./components/BulkAdjustPrices";
import SupabaseSyncGuide from "./components/SupabaseSyncGuide";
import BackupRestorePanel from "./components/BackupRestorePanel";
import ProductDetailModal from "./components/ProductDetailModal";
import { formatToInstagramStyle } from "./lib/instagramFormatter";
import { roundPrice } from "./lib/priceUtils";

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  
  // Selected product for detailed modal viewing and editing
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  // Loading & Filter states
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedSupplier, setSelectedSupplier] = useState("all");
  const [sortBy, setSortBy] = useState<"name" | "price" | "price_asc" | "newest">("price_asc");
  const [pinnedProductIds, setPinnedProductIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("ponto_pinned_products");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Admin state & session
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    return localStorage.getItem("ponto_admin_authed") === "true";
  });
  const [showAdminPanel, setShowAdminPanel] = useState<boolean>(false);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");
  const [activeAddTab, setActiveAddTab] = useState<"single" | "bulk">("single");
  
  // Notice alert banner state
  const [copiedGeneralLink, setCopiedGeneralLink] = useState(false);

  // Bulk actions status/confirmation states
  const [bulkActionConfirm, setBulkActionConfirm] = useState<{
    type: "delete" | "format_instagram" | "round_prices" | "capitalize_titles" | "change_category" | "change_supplier";
    count: number;
  } | null>(null);
  const [bulkTargetId, setBulkTargetId] = useState<string>("");
  const [bulkSuccessToast, setBulkSuccessToast] = useState<string | null>(null);
  const [bulkIsProcessing, setBulkIsProcessing] = useState(false);

  // Funnel Optimization: Exit Intent
  const [showExitIntent, setShowExitIntent] = useState(false);
  const [hasShownExitIntent, setHasShownExitIntent] = useState(false);

  // Clear selections when admin panels change
  useEffect(() => {
    setSelectedProductIds([]);
  }, [showAdminPanel, isAdmin]);

  // Global Mouse Leave Listener for Exit Intent Pop-up
  useEffect(() => {
    const handleMouseLeave = (e: MouseEvent) => {
      // Trigger pop-up only if the user moves their mouse up toward browser tabs, hasn't seen it yet, and isn't an admin
      if (e.clientY <= 0 && !hasShownExitIntent && !isAdmin) {
        setShowExitIntent(true);
        setHasShownExitIntent(true);
      }
    };
    document.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [hasShownExitIntent, isAdmin]);

  // Pagination states for extreme load speed of catalog cards
  const [visibleProductsCount, setVisibleProductsCount] = useState(12);
  const [visibleAdminProductsCount, setVisibleAdminProductsCount] = useState(12);

  // Automatically reset visible counters back to 12 when search, category, supplier, or sorting is changed
  useEffect(() => {
    setVisibleProductsCount(12);
    setVisibleAdminProductsCount(12);
  }, [searchQuery, selectedCategory, selectedSupplier, sortBy]);

  const handleToggleSelectProduct = (productId: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  const updatePinsOnSupabase = async (newPinnedIds: string[]) => {
    if (!StorageService.isSupabaseActive()) return;
    try {
      const changedProducts: Product[] = [];
      const updatedProducts = products.map((prod) => {
        const foundIndex = newPinnedIds.indexOf(prod.id);
        const nextPin = foundIndex !== -1 ? foundIndex : null;
        if (prod.pin_index !== nextPin) {
          const updated = { ...prod, pin_index: nextPin };
          changedProducts.push(updated);
          return updated;
        }
        return prod;
      });

      if (changedProducts.length > 0) {
        setProducts(updatedProducts);
        await Promise.all(
          changedProducts.map(async (p) => {
            try {
              await StorageService.updateProduct(p);
            } catch (err) {
              console.warn("Falha ao salvar pin_index no Supabase (pode ser que precise adicionar a coluna na tabela ponto_products):", err);
            }
          })
        );
      }
    } catch (err) {
      console.error("Erro ao sincronizar destaques com banco de dados:", err);
    }
  };

  const handleTogglePinProduct = (productId: string) => {
    let next: string[] = [];
    setPinnedProductIds((prev) => {
      if (prev.includes(productId)) {
        next = prev.filter((id) => id !== productId);
      } else {
        next = [...prev, productId];
      }
      localStorage.setItem("ponto_pinned_products", JSON.stringify(next));
      return next;
    });
    setTimeout(() => {
      updatePinsOnSupabase(next);
    }, 10);
  };

  const handleMovePinUp = (index: number) => {
    let next: string[] = [];
    setPinnedProductIds((prev) => {
      if (index === 0) return prev;
      next = [...prev];
      const temp = next[index];
      next[index] = next[index - 1];
      next[index - 1] = temp;
      localStorage.setItem("ponto_pinned_products", JSON.stringify(next));
      return next;
    });
    setTimeout(() => {
      updatePinsOnSupabase(next);
    }, 10);
  };

  const handleMovePinDown = (index: number) => {
    let next: string[] = [];
    setPinnedProductIds((prev) => {
      if (index === prev.length - 1) return prev;
      next = [...prev];
      const temp = next[index];
      next[index] = next[index + 1];
      next[index + 1] = temp;
      localStorage.setItem("ponto_pinned_products", JSON.stringify(next));
      return next;
    });
    setTimeout(() => {
      updatePinsOnSupabase(next);
    }, 10);
  };

  const triggerBulkDelete = () => {
    if (selectedProductIds.length === 0) return;
    setBulkActionConfirm({
      type: "delete",
      count: selectedProductIds.length,
    });
  };

  const triggerBulkFormatInstagram = () => {
    if (selectedProductIds.length === 0) return;
    setBulkActionConfirm({
      type: "format_instagram",
      count: selectedProductIds.length,
    });
  };

  const triggerBulkRoundPrices = () => {
    if (selectedProductIds.length === 0) return;
    setBulkActionConfirm({
      type: "round_prices",
      count: selectedProductIds.length,
    });
  };

  const triggerBulkCapitalizeTitles = () => {
    if (selectedProductIds.length === 0) return;
    setBulkActionConfirm({
      type: "capitalize_titles",
      count: selectedProductIds.length,
    });
  };

  const triggerBulkChangeCategory = () => {
    if (selectedProductIds.length === 0) return;
    setBulkActionConfirm({
      type: "change_category",
      count: selectedProductIds.length,
    });
    setBulkTargetId(categories[0]?.id || "");
  };

  const triggerBulkChangeSupplier = () => {
    if (selectedProductIds.length === 0) return;
    setBulkActionConfirm({
      type: "change_supplier",
      count: selectedProductIds.length,
    });
    setBulkTargetId(suppliers[0]?.id || "");
  };

  const executeBulkAction = async () => {
    if (!bulkActionConfirm) return;
    setBulkIsProcessing(true);

    try {
      if (bulkActionConfirm.type === "delete") {
        await StorageService.deleteMultipleProducts(selectedProductIds);
        setProducts((prev) => prev.filter((p) => !selectedProductIds.includes(p.id)));
        setSelectedProductIds([]);
        if (selectedProduct && selectedProductIds.includes(selectedProduct.id)) {
          setSelectedProduct(null);
        }
        setBulkSuccessToast("Produtos removidos com sucesso! 🗑️");
      } else if (bulkActionConfirm.type === "format_instagram") {
        const selectedProducts = products.filter((p) => selectedProductIds.includes(p.id));
        const updatedProducts = selectedProducts.map((p) => ({
          ...p,
          description: formatToInstagramStyle(p.name, p.description),
        }));
        
        const allUpdated = await StorageService.updateMultipleProducts(updatedProducts);
        setProducts(allUpdated);
        setSelectedProductIds([]);
        setBulkSuccessToast("Todas as descrições selecionadas foram organizadas no formato Instagram! ✨📸");
      } else if (bulkActionConfirm.type === "round_prices") {
        const selectedProducts = products.filter((p) => selectedProductIds.includes(p.id));
        const updatedProducts = selectedProducts.map((p) => ({
          ...p,
          price_final: roundPrice(p.price_final),
        }));
        
        const allUpdated = await StorageService.updateMultipleProducts(updatedProducts);
        setProducts(allUpdated);
        setSelectedProductIds([]);
        setBulkSuccessToast("Todos os preços dos produtos selecionados foram arredondados com sucesso! 💰✨");
      } else if (bulkActionConfirm.type === "capitalize_titles") {
        const selectedProducts = products.filter((p) => selectedProductIds.includes(p.id));
        const updatedProducts = selectedProducts.map((p) => {
          const uName = p.name.toUpperCase();
          const hasInsta = p.description.includes("DETALHES DO PRODUTO");
          return {
            ...p,
            name: uName,
            description: hasInsta ? formatToInstagramStyle(uName, p.description) : p.description,
          };
        });
        
        const allUpdated = await StorageService.updateMultipleProducts(updatedProducts);
        setProducts(allUpdated);
        setSelectedProductIds([]);
        setBulkSuccessToast("Todos os títulos selecionados foram convertidos para CAIXA ALTA! 🔠✨");
      } else if (bulkActionConfirm.type === "change_category") {
        if (!bulkTargetId) {
          throw new Error("Nenhuma categoria selecionada para alteração em lote.");
        }
        const selectedProducts = products.filter((p) => selectedProductIds.includes(p.id));
        const updatedProducts = selectedProducts.map((p) => ({
          ...p,
          category_id: bulkTargetId,
        }));
        
        const allUpdated = await StorageService.updateMultipleProducts(updatedProducts);
        setProducts(allUpdated);
        setSelectedProductIds([]);
        setBulkSuccessToast("Categoria de todos os produtos selecionados foi alterada com sucesso! 🏷️✨");
      } else if (bulkActionConfirm.type === "change_supplier") {
        if (!bulkTargetId) {
          throw new Error("Nenhum fornecedor selecionado para alteração em lote.");
        }
        const selectedProducts = products.filter((p) => selectedProductIds.includes(p.id));
        const updatedProducts = selectedProducts.map((p) => ({
          ...p,
          supplier_id: bulkTargetId,
        }));
        
        const allUpdated = await StorageService.updateMultipleProducts(updatedProducts);
        setProducts(allUpdated);
        setSelectedProductIds([]);
        setBulkSuccessToast("Fornecedor de todos os produtos selecionados foi alterado com sucesso! 🏢✨");
      }
    } catch (err) {
      console.error("Erro ao executar ação em massa:", err);
      setBulkSuccessToast("Ocorreu um erro ao processar os produtos.");
    } finally {
      setBulkIsProcessing(false);
      setBulkActionConfirm(null);
      setTimeout(() => {
        setBulkSuccessToast(null);
      }, 5000);
    }
  };

  // Load all initial records
  const loadWorkspaceData = async () => {
    setIsLoading(true);
    try {
      const fetchedCategories = await StorageService.getCategories();
      const fetchedSuppliers = await StorageService.getSuppliers();
      const fetchedProducts = await StorageService.getProducts();

      setCategories(fetchedCategories);
      setSuppliers(fetchedSuppliers);
      setProducts(fetchedProducts);

      // Check if any product has a valid db pin_index
      const dbPinned = fetchedProducts
        .filter((p) => typeof p.pin_index === "number" && p.pin_index !== null)
        .sort((a, b) => (a.pin_index ?? 9999) - (b.pin_index ?? 9999))
        .map((p) => p.id);

      if (dbPinned.length > 0) {
        setPinnedProductIds(dbPinned);
        localStorage.setItem("ponto_pinned_products", JSON.stringify(dbPinned));
      }
    } catch (err) {
      console.error("Erro ao carregar dados do catálogo:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspaceData();
  }, []);

  // Sync URL hash & search parameters for Deep Link Navigation
  useEffect(() => {
    const handleUrlChange = () => {
      const hash = window.location.hash;
      const params = new URLSearchParams(window.location.search);
      const queryProdId = params.get("produto") || params.get("product") || params.get("id");
      
      if (queryProdId) {
        const found = products.find((p) => p.id === queryProdId);
        if (found) {
          setSelectedProduct(found);
          return;
        }
      }

      if (hash && hash.startsWith("#produto-")) {
        const prodId = hash.replace("#produto-", "");
        const found = products.find((p) => p.id === prodId);
        if (found) {
          setSelectedProduct(found);
        }
      } else if (hash && hash.startsWith("#categoria-")) {
        const catId = hash.replace("#categoria-", "");
        setSelectedCategory(catId);
        const element = document.getElementById("catalog-showcase");
        if (element) {
          element.scrollIntoView({ behavior: "smooth" });
        }
      }
    };

    if (products.length > 0) {
      handleUrlChange();
    }

    window.addEventListener("hashchange", handleUrlChange);
    window.addEventListener("popstate", handleUrlChange);
    return () => {
      window.removeEventListener("hashchange", handleUrlChange);
      window.removeEventListener("popstate", handleUrlChange);
    };
  }, [products]);

  // Update URL hash and search parameters when selecting product detail
  useEffect(() => {
    if (selectedProduct) {
      // Sync hash
      window.location.hash = `produto-${selectedProduct.id}`;
      // Sync query parameter securely
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("produto", selectedProduct.id);
        window.history.replaceState(null, "", url.pathname + url.search + url.hash);
      } catch (e) {
        console.error("Erro ao atualizar query params:", e);
      }
    } else {
      // Revert back or clear hash/query if detail was active
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.has("produto")) {
          url.searchParams.delete("produto");
          window.history.replaceState(null, "", url.pathname + url.search + url.hash);
        }
      } catch (e) {
        console.error("Erro ao limpar query params:", e);
      }

      if (window.location.hash.startsWith("#produto-")) {
        window.location.hash = selectedCategory !== "all" ? `categoria-${selectedCategory}` : "";
      }
    }
  }, [selectedProduct]);

  // Handle category selector changes
  const handleSelectCategory = (catId: string) => {
    setSelectedCategory(catId);
    if (catId === "all") {
      window.location.hash = "";
    } else {
      window.location.hash = `categoria-${catId}`;
    }
  };

  // 1. ADD / DELETE / UPDATE PRODUCTS
  const handleAddProduct = async (newProduct: Omit<Product, "id">) => {
    try {
      const added = await StorageService.addProduct(newProduct);
      setProducts((prev) => [added, ...prev]);
    } catch (err) {
      console.error("Erro ao adicionar produto:", err);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (confirm("Tem certeza de que deseja remover este produto do catálogo definitivo?")) {
      try {
        await StorageService.deleteProduct(id);
        setProducts((prev) => prev.filter((p) => p.id !== id));
        if (selectedProduct?.id === id) {
          setSelectedProduct(null);
        }
      } catch (err) {
        console.error("Erro ao deletar produto:", err);
      }
    }
  };

  const handleUpdateProduct = async (updatedProduct: Product) => {
    try {
      const updated = await StorageService.updateProduct(updatedProduct);
      setProducts((prev) => prev.map((p) => p.id === updated.id ? updated : p));
      if (selectedProduct?.id === updated.id) {
        setSelectedProduct(updated);
      }
    } catch (err) {
      console.error("Erro ao atualizar produto do catálogo:", err);
    }
  };

  // 2. ADD / DELETE CATEGORIES
  const handleAddCategory = async (name: string) => {
    try {
      const added = await StorageService.addCategory(name);
      setCategories((prev) => [...prev, added]);
    } catch (err) {
      console.error("Erro ao adicionar categoria:", err);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    const counts = products.filter((p) => p.category_id === id).length;
    if (counts > 0) {
      alert(`Não é possível excluir esta categoria pois ela contém ${counts} produto(s) vinculado(s).`);
      return;
    }

    try {
      await StorageService.deleteCategory(id);
      setCategories((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error("Erro ao deletar categoria:", err);
    }
  };

  // 3. ADD / DELETE SUPPLIERS
  const handleAddSupplier = async (name: string) => {
    try {
      const added = await StorageService.addSupplier(name);
      setSuppliers((prev) => [...prev, added]);
    } catch (err) {
      console.error("Erro ao adicionar fornecedor:", err);
    }
  };

  const handleDeleteSupplier = async (id: string) => {
    const counts = products.filter((p) => p.supplier_id === id).length;
    if (counts > 0) {
      alert(`Não é possível excluir este fornecedor pois ele possui ${counts} produto(s) vinculado(s).`);
      return;
    }

    try {
      await StorageService.deleteSupplier(id);
      setSuppliers((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error("Erro ao deletar fornecedor:", err);
    }
  };

  // 4. BULK ADJUST PRICING ENGINE
  const handleApplyBulkAdjust = async (params: {
    supplierId: string;
    priceRange: string;
    discountPercent: number;
    fixedProfit: number;
  }) => {
    try {
      const updated = await StorageService.bulkUpdatePricing(params);
      setProducts(updated);
    } catch (err) {
      console.error("Erro ao re-calcular margens em massa:", err);
    }
  };

  // Login handler
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginUser === "dieg07" && loginPass === "brasil10") {
      setIsAdmin(true);
      setShowAdminPanel(true);
      localStorage.setItem("ponto_admin_authed", "true");
      setShowLoginModal(false);
      setLoginError("");
      setLoginUser("");
      setLoginPass("");
    } else {
      setLoginError("Usuário ou senha incorretos.");
    }
  };

  const handleLogout = () => {
    setIsAdmin(false);
    setShowAdminPanel(false);
    localStorage.removeItem("ponto_admin_authed");
  };

  const copyGeneralLink = () => {
    const link = window.location.href.split('#')[0];
    navigator.clipboard.writeText(link);
    setCopiedGeneralLink(true);
    setTimeout(() => setCopiedGeneralLink(false), 2000);
  };

  // Filter & Search product list in real-time
  const filteredProducts = products.filter((prod) => {
    const matchesSearch = prod.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          prod.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === "all" || prod.category_id === selectedCategory;
    const matchesSupplier = isAdmin ? (selectedSupplier === "all" || prod.supplier_id === selectedSupplier) : true;

    return matchesSearch && matchesCategory && matchesSupplier;
  });

  // Sort filtered products
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    // Check if pins are defined and active
    const aPinnedIdx = pinnedProductIds.indexOf(a.id);
    const bPinnedIdx = pinnedProductIds.indexOf(b.id);
    const aIsPinned = aPinnedIdx !== -1;
    const bIsPinned = bPinnedIdx !== -1;

    // Pinned products always come first, ordered 1st to 5th
    if (aIsPinned && bIsPinned) {
      return aPinnedIdx - bPinnedIdx;
    }
    if (aIsPinned) return -1;
    if (bIsPinned) return 1;

    // Standard sorts for unpinned items
    if (sortBy === "name") {
      return a.name.localeCompare(b.name);
    } else if (sortBy === "price") {
      return b.price_final - a.price_final; // Highest price first
    } else if (sortBy === "price_asc") {
      return a.price_final - b.price_final; // Lowest price first
    } else {
      return b.id.localeCompare(a.id);
    }
  });

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col text-zinc-900 selection:bg-amber-500 selection:text-zinc-950">
      
      {/* PERSISTENT HEADER BAR */}
      <header className="bg-zinc-950 text-white shadow-xl sticky top-0 z-40 border-b border-zinc-800">
        <div id="ponto-header-container" className="max-w-7xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between gap-4">
          
          {/* Brand Logo Ponto de Negócios */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="relative flex items-center justify-center bg-gradient-to-tr from-amber-400 to-amber-600 p-2.5 rounded-2xl shadow-[0_4px_12px_rgba(245,158,11,0.35)] border border-amber-300 flex-shrink-0">
              <MapPin className="w-5 h-5 text-zinc-950 flex-shrink-0 animate-bounce" />
              <Handshake className="w-3.5 h-3.5 text-zinc-950 absolute" />
            </div>
            
            <div>
              <h1 className="font-sans font-black tracking-wider text-base sm:text-xl bg-gradient-to-r from-white via-amber-100 to-amber-400 bg-clip-text text-transparent leading-none">
                PONTO DE NEGÓCIOS
              </h1>
              <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest leading-none mt-1">
                Catálogo Digital de Móveis
              </p>
            </div>
          </div>

          {/* Admin Toggle Indicators */}
          <div className="flex items-center gap-2">
            {isAdmin ? (
              <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-xl p-1 pr-3">
                <button
                  type="button"
                  onClick={() => setShowAdminPanel(!showAdminPanel)}
                  className={`px-3 py-1.5 text-[10px] sm:text-xs font-black rounded-lg uppercase tracking-wider transition-all cursor-pointer ${showAdminPanel ? 'bg-amber-500 text-zinc-950 shadow-md' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
                >
                  {showAdminPanel ? "Ver Catálogo" : "Acessar Painel"}
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg cursor-pointer transition-colors"
                  title="Sair da Sessão Admin"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowLoginModal(true)}
                className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-850 hover:text-amber-400 text-zinc-300 border border-zinc-800 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                <Lock className="w-3.5 h-3.5 text-zinc-500" />
                <span className="hidden sm:inline">Painel Admin</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* THREE ESSENTIAL GUARANTEES BANNER (CLIENT MODE ORIENTED) */}
      <section className="bg-amber-500 text-zinc-950 py-3 px-4 shadow-sm relative overflow-hidden">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-center sm:text-left">
          
          {/* Quick statement details */}
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-6 gap-y-1.5 text-[11px] sm:text-xs font-black uppercase tracking-wide">
            <span className="flex items-center gap-1.5 bg-zinc-950/10 px-2.5 py-1 rounded-lg">
              <Truck className="w-4 h-4" />
              🚚 ENTREGA ULTRA RÁPIDA!
            </span>
            <span className="flex items-center gap-1.5 bg-zinc-950/10 px-2.5 py-1 rounded-lg">
              <ShieldCheck className="w-4 h-4" />
              🔒 PAGAMENTO É FEITO NA ENTREGA!
            </span>
            <span className="flex items-center gap-1.5 bg-zinc-950/10 px-2.5 py-1 rounded-lg">
              <CreditCard className="w-4 h-4" />
              💳 PARCELAMOS EM ATÉ 12X!
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-zinc-950 text-white font-extrabold px-2.5 py-1 rounded-full uppercase">
              Consulte condições
            </span>
            <button
              onClick={copyGeneralLink}
              className="bg-white/20 hover:bg-white/35 active:scale-95 transition-all p-1 rounded-lg text-zinc-900 flex items-center justify-center"
              title="Copiar link do catálogo para compartilhar no Whatsapp"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* CORE ROUTER SWITCH */}
      {isAdmin && showAdminPanel ? (
        
        /* ============== ADMIN PANEL WORKSPACE ============== */
        <div className="animate-fade-in flex-1">
          
          {/* ADMIN TITLE HEAD */}
          <div className="bg-purple-900 text-white py-6 px-4 border-b border-purple-850">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="bg-amber-400 text-zinc-950 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Configurações do Catálogo
                </span>
                <h2 className="text-2xl font-black tracking-tight mt-1">Painel do Administrador</h2>
                <p className="text-purple-200 text-xs mt-0.5 font-medium">
                  Modo de Gerenciamento Ativo • Ajuste de Preços, Cadastros Automatizados por IA e Sincronização.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAdminPanel(false)}
                  className="px-4 py-2 bg-purple-800 hover:bg-purple-700 text-white text-xs font-extrabold rounded-xl transition-all cursor-pointer border border-purple-750"
                >
                  Voltar para Visualizar como Cliente
                </button>
                <button
                  onClick={handleLogout}
                  className="px-3 py-2 bg-red-600/30 hover:bg-red-600 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors"
                >
                  Sair
                </button>
              </div>
            </div>
          </div>

          {/* INTERNAL METRICS AND UTILS */}
          <main className="max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* COLUMN 1: Add Product (Scan Form via IA built-in) */}
            <section className="lg:col-span-4 space-y-6">
              <div className="flex bg-zinc-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveAddTab("single")}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                    activeAddTab === "single"
                      ? "bg-white text-zinc-900 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-800"
                  }`}
                >
                  Cadastro Individual
                </button>
                <button
                  type="button"
                  onClick={() => setActiveAddTab("bulk")}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                    activeAddTab === "bulk"
                      ? "bg-white text-zinc-900 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-800"
                  }`}
                >
                  ✨ Importar em Massa (IA)
                </button>
              </div>

              {activeAddTab === "single" ? (
                <AddProductForm 
                  categories={categories}
                  suppliers={suppliers}
                  onAddProduct={handleAddProduct}
                />
              ) : (
                <BulkImportForm 
                  categories={categories}
                  suppliers={suppliers}
                  onAddProduct={handleAddProduct}
                />
              )}

              <SupabaseSyncGuide />
              <BackupRestorePanel 
                products={products}
                categories={categories}
                suppliers={suppliers}
                onRestoreCompleted={loadWorkspaceData}
              />
            </section>

            {/* COLUMN 2: Managed List for Admin */}
            <section className="lg:col-span-5 space-y-5">
              <div className="bg-white border border-zinc-200 p-5 rounded-2xl shadow-sm space-y-4">
                
                <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                  <h3 className="font-bold text-zinc-900 text-xs uppercase tracking-wider">
                    Filtro no Catálogo Administrativo
                  </h3>
                  <span className="text-[10px] text-zinc-400 font-bold uppercase">
                    {filteredProducts.length} itens encontrados
                  </span>
                </div>

                {/* Filters engine block */}
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Filtrar por nome de produto..."
                      className="w-full pl-9 pr-4 py-2 border border-zinc-200 rounded-xl text-xs text-zinc-900 bg-zinc-50/50"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1">
                      <Tag className="w-3.5 h-3.5 text-zinc-500" />
                      <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="w-full bg-transparent text-[11px] font-medium text-zinc-700 focus:outline-none"
                      >
                        <option value="all">Todas Categorias</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1">
                      <Building2 className="w-3.5 h-3.5 text-zinc-500" />
                      <select
                        value={selectedSupplier}
                        onChange={(e) => setSelectedSupplier(e.target.value)}
                        className="w-full bg-transparent text-[11px] font-medium text-zinc-700 focus:outline-none"
                      >
                        <option value="all">Todos Fornecedores</option>
                        {suppliers.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* BULK SELECTION ACTIONS BAR */}
                {sortedProducts.length > 0 && (
                  <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 flex items-center justify-between gap-3 text-xs shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                    <label className="flex items-center gap-2 cursor-pointer select-none font-bold text-zinc-700">
                      <input
                        type="checkbox"
                        checked={sortedProducts.every((p) => selectedProductIds.includes(p.id))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedProductIds((prev) => {
                              const newIds = [...prev];
                              sortedProducts.forEach((p) => {
                                if (!newIds.includes(p.id)) newIds.push(p.id);
                              });
                              return newIds;
                            });
                          } else {
                            const sortedIds = sortedProducts.map((p) => p.id);
                            setSelectedProductIds((prev) => prev.filter((id) => !sortedIds.includes(id)));
                          }
                        }}
                        className="w-4.5 h-4.5 rounded border-zinc-350 text-amber-500 focus:ring-amber-500 cursor-pointer"
                      />
                      <span>
                        {selectedProductIds.length > 0 
                          ? `${selectedProductIds.length} selecionado(s)` 
                          : "Selecionar todos filtrados"}
                      </span>
                    </label>

                    {selectedProductIds.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={triggerBulkFormatInstagram}
                          className="px-3 py-1.5 bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 hover:opacity-95 text-white font-black text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition-all shadow-xs active:scale-95"
                          title="Formatar descrições de todos os selecionados no estilo Instagram"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          Formatar Instagram 📸
                        </button>
                        <button
                          type="button"
                          onClick={triggerBulkRoundPrices}
                          className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-750 text-amber-400 border border-zinc-700 font-black text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition-all shadow-xs active:scale-95"
                          title="Arredondar preços dos produtos selecionados usando a regra inteligente"
                        >
                          <Coins className="w-3.5 h-3.5" />
                          Arredondar Preços 💰
                        </button>
                        <button
                          type="button"
                          onClick={triggerBulkCapitalizeTitles}
                          className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-750 text-blue-400 border border-zinc-700 font-black text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition-all shadow-xs active:scale-95"
                          title="Transformar títulos de todos os selecionados em Caixa Alta (Maiúsculas)"
                        >
                          <Type className="w-3.5 h-3.5" />
                          Títulos em Caixa Alta 🔠
                        </button>
                        <button
                          type="button"
                          onClick={triggerBulkChangeCategory}
                          className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-750 text-emerald-400 border border-zinc-700 font-black text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition-all shadow-xs active:scale-95"
                          title="Alterar a categoria de todos os itens selecionados de uma vez"
                        >
                          <Tag className="w-3.5 h-3.5" />
                          Mudar Categoria 🏷️
                        </button>
                        <button
                          type="button"
                          onClick={triggerBulkChangeSupplier}
                          className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-750 text-indigo-400 border border-zinc-700 font-black text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition-all shadow-xs active:scale-95"
                          title="Alterar o fornecedor de todos os itens selecionados de uma vez"
                        >
                          <Building2 className="w-3.5 h-3.5" />
                          Mudar Fornecedor 🏢
                        </button>
                        <button
                          type="button"
                          onClick={triggerBulkDelete}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-705 text-white font-black text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remover {selectedProductIds.length}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Products Catalog list */}
                <div className="space-y-3 max-h-[80vh] overflow-y-auto pr-1">
                  {isLoading ? (
                    <div className="py-12 text-center text-zinc-400 text-xs">Carregando dados...</div>
                  ) : sortedProducts.length === 0 ? (
                    <div className="py-12 border border-dashed border-zinc-200 rounded-xl text-center text-zinc-400 text-xs font-semibold">
                      Nenhum móvel cadastrado ou localizado.
                    </div>
                  ) : (
                    <>
                      {sortedProducts.slice(0, visibleAdminProductsCount).map((p) => (
                        <ProductCard
                          key={p.id}
                          id={`admin-${p.id}`}
                          product={p}
                          categories={categories}
                          suppliers={suppliers}
                          onDelete={handleDeleteProduct}
                          onView={(clicked) => setSelectedProduct(clicked)}
                          isAdmin={true}
                          isSelected={selectedProductIds.includes(p.id)}
                          onToggleSelect={handleToggleSelectProduct}
                          onUpdate={handleUpdateProduct}
                          isPinned={pinnedProductIds.includes(p.id)}
                          pinnedIndex={pinnedProductIds.indexOf(p.id)}
                          onTogglePin={handleTogglePinProduct}
                        />
                      ))}

                      {sortedProducts.length > visibleAdminProductsCount && (
                        <div className="pt-2 text-center">
                          <button
                            type="button"
                            onClick={() => setVisibleAdminProductsCount((prev) => prev + 12)}
                            className="w-full py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold rounded-xl transition-colors cursor-pointer border border-zinc-200 shadow-3xs"
                          >
                            Carregar Mais ({sortedProducts.length - visibleAdminProductsCount} restantes)
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>

              </div>
            </section>

            {/* COLUMN 3: Bulk adjusts prices & lists */}
            <section className="lg:col-span-3 space-y-6">
              {/* PINNED PRODUCTS HIGH-PRIORITY MANAGER */}
              <div className="bg-white border border-amber-200 p-5 rounded-2xl shadow-xs space-y-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-amber-400 to-amber-600" />
                
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-amber-50 rounded-xl border border-amber-200">
                    <Pin className="w-4 h-4 text-amber-600 rotate-45 fill-amber-500" />
                  </div>
                  <div>
                    <h3 className="font-sans font-black text-xs text-zinc-900 uppercase tracking-wider">
                      Destaques do Catálogo
                    </h3>
                    <p className="text-[10px] text-zinc-500 font-medium leading-none mt-0.5">
                      Estes produtos sempre aparecem primeiro.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  {pinnedProductIds.length === 0 ? (
                    <div className="py-4 text-center border border-dashed border-zinc-200 rounded-xl text-[11px] text-zinc-400 font-medium">
                      Nenhum produto fixado.<br />
                      Toque no pino 📌 nos cartões para destacar!
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {pinnedProductIds.map((id, index) => {
                        const prod = products.find((p) => p.id === id);
                        if (!prod) return null;
                        return (
                          <div
                            key={id}
                            className="flex items-center justify-between gap-2 p-2 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-xs rounded-xl"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-5 h-5 bg-amber-100 text-amber-900 text-[10px] font-black rounded-lg flex items-center justify-center border border-amber-200">
                                {index + 1}º
                              </span>
                              <span className="font-extrabold text-zinc-805 text-[11px] truncate" title={prod.name}>
                                {prod.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                type="button"
                                disabled={index === 0}
                                onClick={() => handleMovePinUp(index)}
                                className="p-1 hover:bg-zinc-200 text-zinc-500 rounded disabled:opacity-30 cursor-pointer text-[10px]"
                                title="Mover para cima"
                              >
                                ▲
                              </button>
                              <button
                                type="button"
                                disabled={index === pinnedProductIds.length - 1}
                                onClick={() => handleMovePinDown(index)}
                                className="p-1 hover:bg-zinc-200 text-zinc-500 rounded disabled:opacity-30 cursor-pointer text-[10px]"
                                title="Mover para baixo"
                              >
                                ▼
                              </button>
                              <button
                                type="button"
                                onClick={() => handleTogglePinProduct(id)}
                                className="p-1 text-red-500 hover:bg-red-50 rounded cursor-pointer font-black text-[13px] leading-none ml-1"
                                title="Remover de Destaques"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <BulkAdjustPrices 
                suppliers={suppliers}
                onApplyBulkAdjust={handleApplyBulkAdjust}
              />

              <ManageCategories 
                categories={categories}
                onAddCategory={handleAddCategory}
                onDeleteCategory={handleDeleteCategory}
              />

              <ManageSuppliers 
                suppliers={suppliers}
                onAddSupplier={handleAddSupplier}
                onDeleteSupplier={handleDeleteSupplier}
              />
            </section>

          </main>

        </div>

      ) : (

        /* ============== CLIENT MODE (BOUTIQUE CATÁLOGO PUBLICO) ============== */
        <div className="animate-fade-in flex-1 flex flex-col">
          
          {/* CUSTOMER SEARCH & HERO DECOR */}
          <section className="bg-gradient-to-b from-zinc-900 to-zinc-950 text-white px-4 py-8 sm:py-12 relative shadow-inner">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(245,158,11,0.15),rgba(255,255,255,0))]" />
            <div className="max-w-4xl mx-auto text-center space-y-4 relative z-10">
              
              <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 text-[10px] font-black uppercase tracking-widest px-3.5 py-1 rounded-full border border-amber-500/20">
                ⭐ O CATÁLOGO EXCLUSIVO PARA CLIENTES
              </span>

              <h2 className="font-sans font-black tracking-tight text-2xl sm:text-4xl leading-tight">
                Encontre os Melhores Móveis para o seu Lar
              </h2>

              <p className="text-amber-400 font-bold text-sm sm:text-base flex items-center justify-center gap-1.5 pt-2">
                <MapPin className="w-5 h-5 flex-shrink-0 animate-bounce" /> Atendimento Exclusivo para Uberlândia e Região!
              </p>

              <p className="text-zinc-400 text-xs sm:text-sm max-w-xl mx-auto leading-relaxed mt-2">
                Navegue pelas categorias de móveis com estoque a pronta entrega. Sem intermediários, sem atrasos e com pagamento totalmente feito apenas na entrega!
              </p>

              {/* SEARCH INPUT */}
              <div className="max-w-xl mx-auto pt-2">
                <div className="relative">
                  <Search className="w-5 h-5 text-zinc-400 absolute left-4 top-3.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="O que você está procurando hoje? Ex: Cama, Guarda-Roupa..."
                    className="w-full pl-11 pr-4 py-3 sm:py-3.5 bg-zinc-900/90 hover:bg-zinc-900 border border-zinc-800 rounded-2xl text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all shadow-lg"
                  />
                </div>
              </div>

            </div>
          </section>

          {/* CATEGORY SWIPE BAR (Instagram style pills) */}
          <section className="bg-white border-y border-zinc-200 py-4 px-4 sticky top-[60px] sm:top-[73px] z-30 shadow-xs">
            <div className="max-w-7xl mx-auto">
              
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">
                  Filtrar por Categoria
                </span>
                
                {selectedCategory !== "all" && (
                  <button
                    onClick={() => handleSelectCategory("all")}
                    className="text-[10px] font-black text-amber-600 hover:text-amber-700 uppercase"
                  >
                    Ver Tudo (Limpar Filtros)
                  </button>
                )}
              </div>

              {/* Pill Slider container */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-zinc-200 pr-4">
                <button
                  onClick={() => handleSelectCategory("all")}
                  className={`px-4.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex-shrink-0 flex items-center gap-2 ${selectedCategory === "all" ? 'bg-amber-500 text-zinc-950 font-black shadow-sm' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'}`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Todos Mobiliários</span>
                </button>

                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => handleSelectCategory(cat.id)}
                    className={`px-4.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex-shrink-0 ${selectedCategory === cat.id ? 'bg-amber-500 text-zinc-950 font-black shadow-sm' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'}`}
                  >
                    #{cat.name}
                  </button>
                ))}
              </div>

            </div>
          </section>

          {/* VISUAL BOUTIQUE PRODUCT SHOWCASE */}
          <main id="catalog-showcase" className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 pb-4">
              <div>
                <h3 className="text-lg font-black text-zinc-900 tracking-tight">
                  {selectedCategory === "all" ? "Nosso Catálogo Completo" : `Móveis em: ${categories.find(c => c.id === selectedCategory)?.name || "Categoria"}`}
                </h3>
                <p className="text-zinc-500 text-xs">
                  Mostrando {sortedProducts.length} itens a pronta entrega para você escolher.
                </p>
              </div>

              <div className="flex items-center gap-3">
                
                {/* Sort indicator */}
                <div className="flex items-center gap-1 text-xs text-zinc-500 bg-white border border-zinc-200 px-3 py-1.5 rounded-xl">
                  <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-transparent font-bold text-zinc-700 cursor-pointer focus:outline-none focus:ring-0"
                  >
                    <option value="newest">Mais Recentes</option>
                    <option value="name">Ordem Alfabética</option>
                    <option value="price_asc">Menor Preço 💰</option>
                    <option value="price">Maior Preço 💎</option>
                  </select>
                </div>

              </div>
            </div>

            {/* PRODUCT GRID LIST VIEW */}
            {isLoading ? (
              <div className="py-24 text-center text-zinc-400 text-xs font-bold flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <span>Carregando Catálogo Oficial Ponto de Negócios...</span>
              </div>
            ) : sortedProducts.length === 0 ? (
              <div className="py-20 border-2 border-dashed border-zinc-200 rounded-3xl text-center text-zinc-500 max-w-lg mx-auto bg-white p-6 space-y-3">
                <div className="p-3 bg-zinc-50 rounded-full w-12 h-12 flex items-center justify-center mx-auto text-zinc-400">
                  <Search className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-zinc-900 text-sm">Nenhum produto encontrado neste filtro</h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Não localizamos móbiles correspondentes à busca ou à categoria selecionada neste momento. Experimente limpar ou alterar o filtro acima.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedCategory("all");
                    window.location.hash = "";
                  }}
                  className="px-4 py-2 bg-amber-500 text-zinc-950 text-xs font-black rounded-xl hover:bg-amber-600 transition-colors"
                >
                  Ver Tudo de Fábrica
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sortedProducts.slice(0, visibleProductsCount).map((p) => (
                    <ProductCard
                      key={p.id}
                      id={`pcard-${p.id}`}
                      product={p}
                      categories={categories}
                      suppliers={suppliers}
                      onDelete={handleDeleteProduct}
                      onView={(clicked) => setSelectedProduct(clicked)}
                      isAdmin={false}
                      isPinned={pinnedProductIds.includes(p.id)}
                      pinnedIndex={pinnedProductIds.indexOf(p.id)}
                    />
                  ))}
                </div>

                {sortedProducts.length > visibleProductsCount && (
                  <div className="flex justify-center pt-4 animate-fade-in">
                    <button
                      type="button"
                      onClick={() => setVisibleProductsCount((prev) => prev + 12)}
                      className="px-6 py-3 bg-amber-500 hover:bg-amber-600 font-extrabold text-xs sm:text-sm rounded-2xl cursor-pointer text-zinc-950 transition-all shadow hover:shadow-md flex items-center justify-center gap-2 mt-4 hover:scale-[1.02] active:scale-95"
                    >
                      <span>🔥 VER MAIS MÓVEIS ({sortedProducts.length - visibleProductsCount} restantes)</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* CLIENT DISCLOSURE INFORMATION CARD */}
            <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 grid grid-cols-1 md:grid-cols-3 gap-6 shadow-xl relative overflow-hidden mt-12 border border-slate-800">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.08),rgba(0,0,0,0))]" />
              
              <div className="space-y-2 relative z-10">
                <Truck className="w-10 h-10 text-amber-400 mb-2" />
                <h4 className="font-black text-base uppercase">Frete &amp; Entrega Expressa</h4>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Realizamos a entrega ultra rápida até o seu endereço com equipe especializada para garantir que seu produto chegue intacto.
                </p>
              </div>

              <div className="space-y-2 relative z-10">
                <ShieldCheck className="w-10 h-10 text-amber-400 mb-2" />
                <h4 className="font-black text-base uppercase">Compra Segura Garantida</h4>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  O Ponto de Negócios prioriza seu sossego. Pague apenas quando o móvel for descarregado na sua casa. Aceitamos cartões, Pix ou dinheiro.
                </p>
              </div>

              <div className="space-y-2 relative z-10">
                <ChevronRight className="w-10 h-10 text-amber-400 mb-2" />
                <h4 className="font-black text-base uppercase">Consulte os Condições</h4>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Nosso parcelamento em até 12x oferece taxas incrivelmente flexíveis. Entre em contato diretamente com o vendedor que te guiou para o fechamento!
                </p>
              </div>
            </div>

            {/* SEÇÃO DE DEPOIMENTOS DE CLIENTES */}
            <div className="mt-12 mb-8 animate-fade-in pb-12">
              <div className="text-center mb-8">
                <h3 className="text-xl sm:text-2xl font-black text-zinc-900 tracking-tight">O que nossos clientes dizem</h3>
                <p className="text-zinc-500 text-sm mt-2">Confira as avaliações de quem já comprou conosco em Uberlândia e Região.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { name: "Maria Silva", text: "Comprei um sofá maravilhoso! A entrega foi super rápida em Uberlândia, no mesmo dia já estava na minha sala. Recomendo muito!" },
                  { name: "João Paulo", text: "Excelente atendimento. O pagamento na entrega me deu muita segurança e os montadores foram muito profissionais e caprichosos na montagem." },
                  { name: "Fernanda Costa", text: "Móveis de primeira qualidade e um preço imbatível. Achei o guarda-roupa que sempre quis para o meu quarto sem precisar esperar encomendar." }
                ].map((depoimento, idx) => (
                  <div key={idx} className="bg-white border border-zinc-200 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow flex flex-col items-center text-center">
                    <div className="flex text-amber-500 mb-3">
                      <Star className="w-4 h-4 fill-current" />
                      <Star className="w-4 h-4 fill-current" />
                      <Star className="w-4 h-4 fill-current" />
                      <Star className="w-4 h-4 fill-current" />
                      <Star className="w-4 h-4 fill-current" />
                    </div>
                    <p className="text-sm text-zinc-650 italic mb-4 leading-relaxed line-clamp-4 flex-1">"{depoimento.text}"</p>
                    <span className="font-bold text-zinc-900 text-xs uppercase tracking-wider">{depoimento.name}</span>
                  </div>
                ))}
              </div>
            </div>

          </main>

        </div>

      )}

      {/* Product Detail & Edit Modal Overlay */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          categories={categories}
          suppliers={suppliers}
          onClose={() => setSelectedProduct(null)}
          onUpdate={handleUpdateProduct}
          onDelete={handleDeleteProduct}
          isAdmin={isAdmin}
        />
      )}

      {/* SECURE ADMIN LOGIN MODAL */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-zinc-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div 
            className="bg-white rounded-3xl border border-zinc-200 shadow-2xl max-w-sm w-full overflow-hidden p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-500" />
                <h3 className="font-sans font-black text-zinc-900 text-sm">
                  Restrito aos Administradores
                </h3>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowLoginModal(false);
                  setLoginError("");
                }}
                className="text-zinc-400 hover:text-zinc-600 p-1.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-500 leading-relaxed">
              O catálogo de precompras possui acesso restrito para edição, remoção e recalculo de preço. Insira as credenciais oficiais.
            </p>

            <form onSubmit={handleLoginSubmit} className="space-y-3.5">
              
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-zinc-600 uppercase">Usuário</label>
                <input
                  type="text"
                  value={loginUser}
                  onChange={(e) => setLoginUser(e.target.value)}
                  placeholder="Seu usuário"
                  required
                  className="w-full px-3.5 py-2 border border-zinc-250 rounded-xl text-xs text-zinc-900 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-zinc-600 uppercase">Senha de Acesso</label>
                <input
                  type="password"
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  placeholder="Sua senha"
                  required
                  className="w-full px-3.5 py-2 border border-zinc-250 rounded-xl text-xs text-zinc-900 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              {loginError && (
                <div className="text-[11px] text-red-600 font-bold bg-red-50 border border-red-100 p-2 rounded-xl text-center">
                  ⚠️ {loginError}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-zinc-950 text-xs font-black rounded-xl cursor-pointer shadow transition-colors uppercase leading-none"
              >
                Autenticar Painel
              </button>

            </form>

            <div className="text-[10px] text-center text-zinc-400">
              Ponto de Negócios • Proteção de Custos Ativa
            </div>

          </div>
        </div>
      )}

      {/* Persistent Copied General link notifier */}
      {copiedGeneralLink && (
        <div className="fixed bottom-4 right-4 bg-emerald-600 text-white font-extrabold text-xs px-4 py-2.5 rounded-full shadow-lg z-50 flex items-center gap-1.5 animate-slide-up">
          <CheckCircle className="w-4 h-4" />
          <span>Link do catálogo copiado com sucesso!</span>
        </div>
      )}

      {/* Bulk actions confirmation modal */}
      {bulkActionConfirm && (
        <div className="fixed inset-0 bg-black/65 z-50 flex items-center justify-center p-4 backdrop-blur-2xs">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-zinc-200/55 shadow-xl animate-scale-up space-y-4 text-left">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="p-2.5 bg-amber-50 rounded-2xl">
                {bulkActionConfirm.type === "round_prices" ? (
                  <Coins className="w-6 h-6 text-amber-500" />
                ) : bulkActionConfirm.type === "capitalize_titles" ? (
                  <Type className="w-6 h-6 text-blue-500" />
                ) : bulkActionConfirm.type === "change_category" ? (
                  <Tag className="w-6 h-6 text-emerald-500" />
                ) : bulkActionConfirm.type === "change_supplier" ? (
                  <Building2 className="w-6 h-6 text-indigo-500" />
                ) : bulkActionConfirm.type === "delete" ? (
                  <Trash2 className="w-6 h-6 text-red-500" />
                ) : (
                  <Sparkles className="w-6 h-6 text-amber-500" />
                )}
              </div>
              <div>
                <h3 className="font-bold text-zinc-900 text-sm">
                  {bulkActionConfirm.type === "delete" 
                    ? "Remover móveis" 
                    : bulkActionConfirm.type === "round_prices"
                    ? "Arredondar preços"
                    : bulkActionConfirm.type === "capitalize_titles"
                    ? "Títulos em Caixa Alta"
                    : bulkActionConfirm.type === "change_category"
                    ? "Mudar categoria em lote"
                    : bulkActionConfirm.type === "change_supplier"
                    ? "Mudar fornecedor em lote"
                    : "Organizar descrições"}
                </h3>
                <p className="text-[11px] text-zinc-500">Ação para {bulkActionConfirm.count} {bulkActionConfirm.count === 1 ? 'item selecionado' : 'itens selecionados'}</p>
              </div>
            </div>

            <p className="text-zinc-650 text-xs leading-relaxed">
              {bulkActionConfirm.type === "delete" 
                ? `Tem certeza de que deseja remover permanentemente os ${bulkActionConfirm.count} produtos selecionados do catálogo?` 
                : bulkActionConfirm.type === "round_prices"
                ? `Deseja arredondar o preço final de todos os ${bulkActionConfirm.count} produtos selecionados? Produtos com centenas próximas (como x05, x10) arredondam para trás terminando em 99,00 (ex: 807 -> 799; 1010 -> 999). Outros valores arredondam para frente terminando em 9 (ex: 771,82 -> 779; 1027 -> 1029).`
                : bulkActionConfirm.type === "capitalize_titles"
                ? `Deseja transformar o título de todos os ${bulkActionConfirm.count} produtos selecionados para LETRAS MAIÚSCULAS (CAIXA ALTA)? Isso padronizará o catálogo.`
                : bulkActionConfirm.type === "change_category"
                ? `Selecione para qual categoria deseja mover os ${bulkActionConfirm.count} produtos selecionados:`
                : bulkActionConfirm.type === "change_supplier"
                ? `Selecione para qual fornecedor deseja mover os ${bulkActionConfirm.count} produtos selecionados:`
                : "Deseja reformatar e organizar as descrições de todos os produtos selecionados no estilo do Instagram (detalhes com emojis, sem preços repetidos e sem links)? Isso facilitará muito a cópia e divulgação de catálogo."}
            </p>

            {/* Render select menus for bulk updating relations */}
            {bulkActionConfirm.type === "change_category" && (
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-wider">Nova Categoria</label>
                <select
                  value={bulkTargetId}
                  onChange={(e) => setBulkTargetId(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-250 rounded-xl text-xs text-zinc-950 bg-white shadow-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {bulkActionConfirm.type === "change_supplier" && (
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-wider">Novo Fornecedor</label>
                <select
                  value={bulkTargetId}
                  onChange={(e) => setBulkTargetId(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-250 rounded-xl text-xs text-zinc-950 bg-white shadow-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={bulkIsProcessing}
                onClick={() => setBulkActionConfirm(null)}
                className="flex-1 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-xs rounded-xl cursor-pointer transition-colors"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={bulkIsProcessing}
                onClick={executeBulkAction}
                className={`flex-1 py-2 text-white font-extrabold text-xs rounded-xl cursor-pointer transition-all ${
                  bulkActionConfirm.type === "delete" 
                    ? "bg-red-600 hover:bg-red-700" 
                    : bulkActionConfirm.type === "round_prices"
                    ? "bg-amber-500 hover:bg-amber-600"
                    : bulkActionConfirm.type === "capitalize_titles"
                    ? "bg-blue-600 hover:bg-blue-700"
                    : bulkActionConfirm.type === "change_category"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : bulkActionConfirm.type === "change_supplier"
                    ? "bg-indigo-600 hover:bg-indigo-700"
                    : "bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 hover:opacity-95"
                }`}
              >
                {bulkIsProcessing ? "Processando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success notification toast for bulk changes */}
      {bulkSuccessToast && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 bg-zinc-900 border border-zinc-700/50 text-white font-bold text-xs p-4 rounded-2xl shadow-xl z-50 flex items-center gap-2.5 animate-slide-up max-w-sm">
          <div className="p-1.5 bg-emerald-500/20 rounded-lg text-emerald-400 flex-shrink-0">
            <CheckCircle className="w-4 h-4" />
          </div>
          <span className="flex-1 leading-relaxed">{bulkSuccessToast}</span>
          <button 
            type="button" 
            onClick={() => setBulkSuccessToast(null)} 
            className="text-[10px] text-zinc-400 hover:text-white px-1 py-0.5"
          >
            Fechar
          </button>
        </div>
      )}

      {/* FUNNEL UPDATES: EXIT INTENT / WHATSAPP FIXED BUTTON */}
      {!isAdmin && showExitIntent && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full border border-amber-200 shadow-2xl animate-scale-up text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.1),rgba(255,255,255,0))]" />
            <div className="relative z-10 space-y-4">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto shadow-lg animate-bounce">
                <MessageCircle className="w-8 h-8 text-white" />
              </div>
              <h3 className="font-sans font-black text-2xl text-zinc-900 tracking-tight">Espera um pouquinho!</h3>
              <p className="text-zinc-650 text-sm leading-relaxed">
                Antes de sair, saiba que temos <span className="font-bold text-amber-600">ofertas e condições especiais</span> em Uberlândia e Região que não estão listadas no site!
              </p>
              <p className="text-xs text-zinc-500">Chame no WhatsApp agora e tire todas suas dúvidas com um consultor oficial.</p>
              
              <div className="pt-2">
                <a
                  href="https://wa.me/5534991483602?text=Ol%C3%A1%21%20Vi%20o%20cat%C3%A1logo%20e%20gostaria%20de%20saber%20mais%20sobre%20as%20ofertas."
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShowExitIntent(false)}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-green-500 hover:bg-green-600 active:scale-95 text-white font-black text-sm uppercase rounded-xl transition-all shadow-md"
                >
                  <MessageCircle className="w-5 h-5" /> Falar no WhatsApp
                </a>
                <button
                  type="button"
                  onClick={() => setShowExitIntent(false)}
                  className="mt-3 text-xs text-zinc-400 hover:text-zinc-600 font-medium cursor-pointer p-2"
                >
                  Não, obrigado. Quero apenas sair.
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating WhatsApp Button (visible only in client view) */}
      {!isAdmin && (
        <a
          href="https://wa.me/5534991483602?text=Ol%C3%A1%21%20Vim%20pelo%20cat%C3%A1logo%20virtual%20e%20gostaria%20de%20tirar%20uma%20d%C3%BAvida."
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 md:bottom-8 md:right-8 w-14 h-14 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center shadow-2xl hover:shadow-[0_8px_30px_rgba(34,197,94,0.4)] hover:scale-110 active:scale-95 transition-all z-40"
          title="Fale conosco no WhatsApp!"
        >
          <MessageCircle className="w-7 h-7" />
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500 border-2 border-white"></span>
          </span>
        </a>
      )}

      {/* FOOTER */}
      <footer className="bg-zinc-950 border-t border-zinc-900 py-8 text-zinc-400 text-center text-xs mt-auto">
        <div className="max-w-7xl mx-auto px-4 space-y-3.5">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] font-semibold text-zinc-500">
            <span>Ponto de Negócios © 2026</span>
            <span>•</span>
            <span>Catálogo Virtual de Móveis</span>
            <span>•</span>
            <button 
              type="button" 
              onClick={() => {
                if (isAdmin) {
                  setShowAdminPanel(!showAdminPanel);
                } else {
                  setShowLoginModal(true);
                }
              }} 
              className="text-amber-500 hover:underline cursor-pointer"
            >
              🔑 {isAdmin ? "Tocar no Painel Admin" : "Acesso Restrito Admin"}
            </button>
          </div>

        </div>
      </footer>
    </div>
  );
}
