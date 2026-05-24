import React, { useState, useEffect } from "react";
import { 
  X, 
  Edit3, 
  Trash2, 
  Tag, 
  Building2, 
  Sparkles, 
  Image as ImageIcon, 
  Save, 
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Info,
  Share2,
  Check,
  Truck,
  CreditCard,
  ShieldCheck,
  Lock,
  Upload,
  MessageCircle
} from "lucide-react";
import { Product, Category, Supplier } from "../types";
import { compressImage } from "../lib/imageCompressor";
import { formatToInstagramStyle } from "../lib/instagramFormatter";

interface ProductDetailModalProps {
  product: Product;
  categories: Category[];
  suppliers: Supplier[];
  onClose: () => void;
  onUpdate: (updatedProduct: Product) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
  isAdmin?: boolean;
}

export default function ProductDetailModal({
  product,
  categories,
  suppliers,
  onClose,
  onUpdate,
  onDelete,
  isAdmin = false,
}: ProductDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Carousel state
  const [activeImageIdx, setActiveImageIdx] = useState(0);

  // Form states (Editing mode)
  const [name, setName] = useState(product.name);
  const [categoryId, setCategoryId] = useState(product.category_id);
  const [supplierId, setSupplierId] = useState(product.supplier_id);
  const [priceFull, setPriceFull] = useState<number>(product.price_full);
  const [discountPercent, setDiscountPercent] = useState<number>(product.discount_percent);
  const [profitDesired, setProfitDesired] = useState<number>(product.profit_desired);
  const [description, setDescription] = useState(product.description || "");
  const [images, setImages] = useState<string[]>(product.images || []);

  // Compute values dynamically at render-time for instant sync, type-correctness and Zero-delay
  const costReal = priceFull * (1 - discountPercent / 100);
  const priceFinal = costReal + profitDesired;

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // States and function for Auto-extracting measurements using IA
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractedMedidas, setExtractedMedidas] = useState<string | null>(null);

  const processMeasurementFile = async (file: File) => {
    setIsExtracting(true);
    setExtractError(null);
    setExtractedMedidas(null);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const response = await fetch("/api/catalog/extract-measurements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base64Image: base64,
          mimeType: file.type,
          currentDescription: description
        })
      });

      const resData = await response.json();
      if (resData.success) {
        setExtractedMedidas(resData.measurements);
        setDescription(resData.updated_description || description);
      } else {
        setExtractError(resData.error || "Não foi possível extrair as medidas desta imagem.");
      }
    } catch (err: any) {
      console.error(err);
      setExtractError("Falha na conexão ou processamento da imagem.");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleExtractMeasurementPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processMeasurementFile(e.target.files[0]);
    }
  };

  const handleMeasurementPaste = (e: React.ClipboardEvent) => {
    e.stopPropagation(); // Evita adicionar como foto principal do móvel
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            processMeasurementFile(file);
            break;
          }
        }
      }
    }
  };

  // Ctrl+V paste handler for editing mode in detail modal
  useEffect(() => {
    if (!isEditing) return;

    const handlePaste = (e: ClipboardEvent) => {
      if (e.defaultPrevented) return;

      const items = e.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf("image") !== -1) {
            const file = items[i].getAsFile();
            if (file) {
              e.preventDefault();
              const reader = new FileReader();
              reader.onloadend = async () => {
                const base64String = reader.result as string;
                const compressed = await compressImage(base64String);
                setImages((prev) => [...prev, compressed]);
              };
              reader.readAsDataURL(file);
              break;
            }
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [isEditing]);

  const handleAddPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files) as File[];
      const readPromises = filesArray.map((file) => {
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            resolve(reader.result as string);
          };
          reader.readAsDataURL(file);
        });
      });

      Promise.all(readPromises).then(async (base64Strings) => {
        const compressed = await Promise.all(base64Strings.map(b => compressImage(b)));
        setImages((prev) => [...prev, ...compressed]);
      });
    }
  };

  const handleRemovePhoto = (idxToRemove: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== idxToRemove));
    if (activeImageIdx >= images.length - 1) {
      setActiveImageIdx(Math.max(0, images.length - 2));
    }
  };

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      const updated: Product = {
        ...product,
        name: name.trim(),
        category_id: categoryId,
        supplier_id: supplierId,
        price_full: priceFull,
        discount_percent: discountPercent,
        profit_desired: profitDesired,
        cost_real: costReal,
        price_final: priceFinal,
        description: description.trim(),
        images: images,
      };

      await onUpdate(updated);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        setIsEditing(false);
      }, 1000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (confirm("Tem certeza de que deseja remover este produto do catálogo?")) {
      await onDelete(product.id);
      onClose();
    }
  };

  const handleCopyLink = () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?produto=${product.id}`;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const handleFormatInstagram = () => {
    const instaTemplate = formatToInstagramStyle(name, description);
    setDescription(instaTemplate);
  };

  // Helper descriptions
  const currentCategoryName = categories.find((c) => c.id === product.category_id)?.name || "Geral";
  const currentSupplierName = suppliers.find((s) => s.id === product.supplier_id)?.name || "Nenhum";

  const allImages = product.images && product.images.length > 0 
    ? product.images 
    : ["https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=400&q=80"];

  return (
    <div id="product-detail-modal" className="fixed inset-0 bg-zinc-950/80 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fade-in">
      <div 
        className="bg-zinc-50 rounded-2xl border border-zinc-200 shadow-2xl max-w-3xl w-full max-h-[96vh] sm:max-h-[90vh] overflow-hidden flex flex-col my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header toolbar */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 sm:px-5 py-3.5 bg-white">
          <div className="flex items-center gap-1.5">
            {isEditing ? (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="p-1.5 text-zinc-500 hover:text-zinc-800 transition-colors cursor-pointer mr-1"
                title="Voltar para visualização"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : null}
            <h3 className="font-extrabold text-zinc-900 text-sm tracking-tight">
              {isEditing ? "Editar Registro (Admin)" : "Ficha Técnica do Móvel"}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {!isEditing && (
              <>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all border ${copied ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-zinc-100 border-zinc-200 text-zinc-700 hover:bg-zinc-200'} cursor-pointer`}
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                  {copied ? "Link Copiado!" : "Compartilhar"}
                </button>

                {isAdmin && (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="px-3 py-1.5 bg-amber-500 text-zinc-950 hover:bg-amber-600 rounded-xl text-xs font-black flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="p-2 text-zinc-400 hover:text-red-500 rounded-xl hover:bg-red-50 transition-colors cursor-pointer"
                      title="Excluir produto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-650 p-2 rounded-xl transition-colors cursor-pointer"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-white">
          {!isEditing ? (
            /* VIEW MODE PANEL */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Left Column: Image Carousel / Viewer */}
              <div className="space-y-4">
                <div className="relative aspect-square sm:aspect-[4/3] rounded-2xl bg-zinc-50/50 border border-zinc-200 overflow-hidden flex items-center justify-center p-2 shadow-sm">
                  <img
                    src={allImages[activeImageIdx]}
                    alt={product.name}
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=400&q=80";
                    }}
                  />
                  
                  {/* Prev/Next arrows if multiple images */}
                  {allImages.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setActiveImageIdx((prev) => (prev > 0 ? prev - 1 : allImages.length - 1))}
                        className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/95 hover:bg-white text-zinc-900 shadow-md transition-all cursor-pointer hover:scale-105"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveImageIdx((prev) => (prev < allImages.length - 1 ? prev + 1 : 0))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/95 hover:bg-white text-zinc-900 shadow-md transition-all cursor-pointer hover:scale-105"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>

                {/* Thumbnail strip */}
                {allImages.length > 1 && (
                  <div className="flex flex-wrap gap-2 justify-center">
                    {allImages.map((img, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setActiveImageIdx(i)}
                        className={`w-12 h-12 rounded-xl border-2 overflow-hidden bg-white transition-all ${activeImageIdx === i ? 'border-amber-500 scale-105 shadow-sm' : 'border-zinc-200 opacity-60 hover:opacity-100'}`}
                      >
                        <img src={img} className="w-full h-full object-contain p-0.5" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Shipping & Payment highlights optimized for Brazilian buyers */}
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3 shadow-xs">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-emerald-100 rounded-xl text-emerald-700 flex-shrink-0">
                      <Truck className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="font-bold text-zinc-900 text-xs sm:text-sm">Entrega Ultra Rápida</h4>
                      <p className="text-zinc-500 text-[11px] sm:text-xs">
                        Temos estoque imediato! Realizamos entrega ultra rápida com segurança máxima.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-100 rounded-xl text-blue-700 flex-shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-zinc-900 text-xs sm:text-sm">Pagamento Seguro na Entrega</h4>
                      <p className="text-zinc-500 text-[11px] sm:text-xs">
                        Não solicitamos nenhum valor adiantado. Você confere o produto montado/embalado e realiza o pagamento apenas no ato da entrega!
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-amber-100 rounded-xl text-amber-700 flex-shrink-0">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-zinc-900 text-xs sm:text-sm">Parcelamento em até 12x</h4>
                      <p className="text-zinc-500 text-[11px] sm:text-xs font-semibold">
                        Divida no cartão de crédito em até 12 parcelas (consulte taxas e condições exclusivas com o seu vendedor).
                      </p>
                    </div>
                  </div>
                </div>

              </div>

              {/* Right Column: Key Details & Recalculation math */}
              <div className="space-y-5 flex flex-col justify-between">
                <div className="space-y-4">
                  <div>
                    <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-900 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full mb-2">
                      <Tag className="w-3 h-3" />
                      {currentCategoryName}
                    </span>
                    
                    {isAdmin && (
                      <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 text-[10px] font-semibold px-2.5 py-0.5 rounded-md ml-2 border border-purple-100">
                        <Building2 className="w-3" />
                        Admin: {currentSupplierName}
                      </span>
                    )}

                    <h2 className="text-xl sm:text-2xl font-black text-zinc-900 tracking-tight leading-tight">
                      {product.name}
                    </h2>
                  </div>

                  {/* Clean Description Container */}
                  <div className="space-y-1.5">
                    <h4 className="text-[11px] font-black text-zinc-400 tracking-wider uppercase flex items-center justify-between">
                      <span>Descrição do Produto</span>
                      <span className="text-[10px] text-zinc-400 font-semibold normal-case">Profissional &amp; Detalhada 📋</span>
                    </h4>
                    
                    {/* Rendered beautifully with custom margins inside a clean card block */}
                    <div className="text-xs sm:text-sm text-zinc-800 bg-zinc-50 border border-zinc-150 p-4 rounded-2xl leading-relaxed whitespace-pre-wrap font-sans font-medium text-left">
                      {product.description || "Nenhuma descrição comercial para este móvel."}
                    </div>
                  </div>
                </div>

                {/* Secure Price calculation box */}
                <div className="border-2 border-amber-500/20 p-5 rounded-2xl bg-amber-50/20 space-y-3.5 shadow-xs mt-4">
                  
                  {/* Clientes views ONLY final prices */}
                  {!isAdmin ? (
                    <div className="space-y-3">
                      <div className="flex justify-between items-end border-b border-dashed border-zinc-200 pb-3">
                        <div>
                          <span className="text-[10px] font-black text-zinc-500 block uppercase tracking-wider">Super Oferta Especial</span>
                          <span className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight leading-none">
                            R$ {product.price_final.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] sm:text-xs text-zinc-500 block mt-1">À vista no Pix ou Dinheiro</span>
                        </div>
                        
                        {/* No discount badge in client view */}
                      </div>

                      <div className="pt-1.5 flex justify-between items-center bg-white/70 border border-zinc-150 p-3 rounded-xl">
                        <div>
                          <span className="text-[10px] font-extrabold text-emerald-700 block leading-none">OPÇÃO PARCELADA</span>
                          <span className="text-sm font-black text-emerald-800 block">
                            12x de R$ {((product.price_final * 1.17) / 12).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}*
                          </span>
                        </div>
                        <span className="text-[9px] text-zinc-400 font-bold max-w-[120px] text-right leading-tight">
                          *Consulte condições com seu vendedor.
                        </span>
                      </div>
                      
                      <div className="pt-3">
                        <a
                          href={`https://wa.me/5534991483602?text=${encodeURIComponent(`Olá! Vi o *${product.name}* e quero finalizar a compra.`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex items-center justify-center gap-2 py-3.5 bg-green-500 hover:bg-green-600 active:scale-95 text-white font-black text-sm uppercase rounded-xl transition-all shadow-[0_4px_12px_rgba(34,197,94,0.3)] hover:shadow-[0_6px_16px_rgba(34,197,94,0.4)]"
                        >
                          <MessageCircle className="w-5 h-5" />
                          Comprar no WhatsApp
                        </a>
                      </div>
                    </div>
                  ) : (
                    /* ADMIN COST FORMULA SHEET */
                    <div className="space-y-2.5 text-xs">
                      <h4 className="text-xs font-bold text-purple-900 tracking-wide uppercase border-b border-purple-100 pb-2 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5" />
                        <span>Fórmula Geral (Exclusivo Admin)</span>
                      </h4>

                      <div className="flex justify-between items-center text-zinc-600">
                        <span>Preço de Referência Tabela:</span>
                        <span className="font-semibold text-zinc-800">R$ {product.price_full.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>

                      <div className="flex justify-between items-center text-zinc-650">
                        <span>Desconto Especial Aplicado:</span>
                        <span className="font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">-{product.discount_percent}% desc</span>
                      </div>

                      <div className="flex justify-between items-center border-t border-dashed border-zinc-200 pt-2 font-medium">
                        <span className="text-purple-950 flex items-center gap-1">
                          Custo Real do Fornecedor:
                          <span className="group relative cursor-help">
                            <Info className="w-3.5 h-3.5 text-zinc-400" />
                            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-44 p-2 bg-zinc-900 text-white text-[10px] rounded-lg hidden group-hover:block z-15 font-normal leading-normal shadow-md">
                              Custo real após abater as condições negociadas.
                            </span>
                          </span>
                        </span>
                        <span className="font-bold text-purple-950">R$ {product.cost_real.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>

                      <div className="flex justify-between items-center text-zinc-650">
                        <span className="font-semibold text-emerald-700">Lucro Alvo Líquido:</span>
                        <span className="font-bold text-emerald-700">R$ {product.profit_desired.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>

                      {/* Highly polished total bar */}
                      <div className="pt-2 border-t border-zinc-200 flex justify-between items-end">
                        <div>
                          <span className="text-[10px] font-black text-indigo-900 block leading-none">PREÇO DE VENDA DE CATÁLOGO</span>
                          <span className="text-[10px] text-zinc-500">(Custo Real + Lucro)</span>
                        </div>
                        <span className="text-xl font-black text-indigo-700 leading-none">
                          R$ {product.price_final.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  )}
                  
                </div>

              </div>

            </div>
          ) : (
            /* EDITING FORM PANEL */
            <form onSubmit={handleSaveChanges} className="space-y-4">
              
              {/* Nome do Produto */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-zinc-700">Nome Comercial do Produto</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Cozinha 4 Peças Cristal"
                  required
                  className="w-full px-3 py-2 border border-zinc-250 rounded-xl text-sm text-zinc-900 placeholder:text-zinc-400 bg-white shadow-xs focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none"
                />
              </div>

              {/* Categoria & Fornecedor */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-zinc-700">Categoria</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-250 rounded-xl text-sm text-zinc-900 bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-zinc-700">Fornecedor Interno</label>
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-250 rounded-xl text-sm text-zinc-900 bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Pricing section with accurate requirements math */}
              <div className="border border-zinc-200 p-4 rounded-xl bg-zinc-50 space-y-4 shadow-inner">
                <h4 className="text-xs font-bold text-zinc-950 tracking-wide uppercase border-b border-zinc-200 pb-2 flex justify-between">
                  <span>Atualizar Precificação</span>
                  <span className="text-[10px] text-indigo-700 uppercase font-black tracking-wide">Recálculo automático</span>
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-zinc-600">Preço Cheio Tabela [R$]</label>
                    <input
                      type="number"
                      step="0.01"
                      value={priceFull || ""}
                      onChange={(e) => setPriceFull(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="w-full px-3 py-1.5 border border-zinc-250 rounded-lg text-xs text-zinc-900 bg-white focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-zinc-600">Desconto Fábrica [%]</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={discountPercent || ""}
                      onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full px-3 py-1.5 border border-zinc-250 rounded-lg text-xs text-zinc-900 bg-white focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="block text-[11px] font-bold text-zinc-650">Lucro Alvo Desejado [R$]</label>
                    <span className="text-[10px] text-zinc-500 font-bold">
                      Custo Real Calculado: <strong className="text-zinc-850">R$ {costReal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                    </span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={profitDesired || ""}
                    onChange={(e) => setProfitDesired(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full px-3 py-1.5 border border-emerald-300 rounded-lg text-xs text-zinc-950 bg-white focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-600 focus:outline-none font-bold"
                  />
                </div>

                {/* Preço Final computed block */}
                <div className="bg-indigo-50 border border-indigo-150 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black text-indigo-950">Novo Preço de Catálogo Final (Editável)</span>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const rounded = Math.round(priceFinal);
                          setProfitDesired(Math.max(0, rounded - costReal));
                        }}
                        className="px-2 py-0.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-[10px] font-bold rounded cursor-pointer transition-colors"
                        title="Arredondar para o inteiro mais próximo"
                      >
                        Arredondar .00
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const rounded10 = Math.round(priceFinal / 10) * 10;
                          setProfitDesired(Math.max(0, rounded10 - costReal));
                        }}
                        className="px-2 py-0.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-[10px] font-bold rounded cursor-pointer transition-colors"
                        title="Arredondar para a dezena de reais mais próxima"
                      >
                        Dezena .00
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-indigo-700">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={priceFinal ? parseFloat(priceFinal.toFixed(2)) : ""}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setProfitDesired(val - costReal);
                      }}
                      className="w-full pl-9 pr-3 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs font-bold text-indigo-900 focus:outline-indigo-500"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              {/* Descrição Comercial */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-zinc-700">Descrição Comercial do Produto</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleFormatInstagram}
                      className="px-2 py-0.5 bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 hover:from-purple-700 hover:via-pink-700 hover:to-amber-600 text-white text-[10px] sm:text-xs font-black rounded-lg cursor-pointer transition-all shadow-xs flex items-center gap-1 active:scale-95 animate-pulse"
                      title="Organizar texto no estilo de publicação do Instagram"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Formato Instagram 📸</span>
                    </button>
                    <span className="text-[10px] text-zinc-400 hidden sm:inline">Clara, limpa e profissional 📋</span>
                  </div>
                </div>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Exemplo de descrição limpa:&#10;&#10;Guarda-Roupa de casal espaçoso.&#10;&#10;Dimensões:&#10;- Altura: 2.18m&#10;- Largura: 2.30m&#10;&#10;Entrega ultra rápida."
                  className="w-full px-3 py-2 border border-zinc-250 rounded-xl text-sm text-zinc-900 bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none placeholder:text-zinc-400 font-mono text-xs"
                />

                {/* Assistente inteligente de Extração de Medidas a partir de Foto */}
                <div className="bg-amber-500/5 border border-amber-350 rounded-xl p-3.5 space-y-2.5 mt-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-650 animate-pulse" />
                      <span className="text-[10px] font-black text-amber-950 uppercase tracking-wider">Extrair Medidas de Imagem (IA)</span>
                    </div>
                    <span className="text-[8px] font-black text-amber-900 bg-amber-100/80 rounded px-1.5 py-0.5 uppercase tracking-wide">Beta Inteligente ⚡</span>
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-tight">
                    Suba ou cole um desenho técnico, print de catálogo, rótulo ou foto para atualizar a descrição com as dimensões certinhas!
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-2">
                    <label className={`flex-1 min-h-[34px] border border-dashed border-amber-300 hover:border-amber-500 bg-white hover:bg-amber-50/20 rounded-lg text-center cursor-pointer transition-colors flex items-center justify-center gap-1.5 px-3 py-1.5 ${isExtracting ? 'opacity-60 cursor-not-allowed' : ''}`}>
                      <Upload className="w-3.5 h-3.5 text-amber-600" />
                      <span className="text-[10.5px] font-bold text-zinc-700">
                        {isExtracting ? "Analisando imagem..." : "Subir Foto de Medidas"}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={isExtracting}
                        onChange={handleExtractMeasurementPhoto}
                        className="hidden"
                      />
                    </label>

                    <div 
                      onPaste={handleMeasurementPaste}
                      tabIndex={0}
                      className="flex-1 border-2 border-dashed border-zinc-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 bg-white hover:bg-zinc-50/50 rounded-lg text-center cursor-pointer transition-colors flex items-center justify-center gap-2 px-3 py-1.5 outline-none"
                      title="Clique aqui para focar e aperte Ctrl+V para colar o print do catálogo diretamente!"
                    >
                      <span className="bg-zinc-200 border border-zinc-350 px-1 py-0.5 rounded text-zinc-800 font-black text-[8px] font-sans">Ctrl + V</span>
                      <span className="text-[10.5px] text-zinc-500 font-bold">Colar desenho aqui</span>
                    </div>
                  </div>

                  {isExtracting && (
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-700 animate-pulse bg-amber-50 p-2 rounded-lg border border-amber-150">
                      <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping" />
                      <span>Analisando foto técnica... Isso pode levar de 3 a 5 segundos.</span>
                    </div>
                  )}

                  {extractError && (
                    <div className="text-[10px] font-bold text-red-700 bg-red-50 border border-red-150 px-2.5 py-2 rounded-lg">
                      ⚠️ {extractError}
                    </div>
                  )}

                  {extractedMedidas && (
                    <div className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-150 px-2.5 py-2 rounded-lg flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>Medidas Aplicadas: <strong className="font-sans underline">{extractedMedidas}</strong></span>
                    </div>
                  )}
                </div>
              </div>

              {/* Multi images editor */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-zinc-700">Fotos Registradas do Produto</label>
                
                {/* Image grid strip */}
                <div className="flex flex-wrap gap-2">
                  {images.map((img, i) => (
                    <div key={i} className="relative w-14 h-14 rounded-xl border border-zinc-200 bg-zinc-50 overflow-hidden group shadow-inner">
                      <img src={img} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(i)}
                        className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shadow-md cursor-pointer transition-transform hover:scale-110"
                        title="Remover foto"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                <label className="inline-flex items-center px-4 py-3 border-2 border-dashed border-zinc-300 rounded-xl hover:bg-zinc-50 cursor-pointer text-xs font-bold text-zinc-600 transition-colors w-full justify-center">
                  <ImageIcon className="w-4 h-4 text-zinc-400 mr-2" />
                  <span>Adicionar Mais Fotos</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onClick={(e) => (e.target as any).value = null}
                    onChange={handleAddPhotos}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Action Save / Cancel buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-200">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 border border-zinc-250 text-zinc-700 hover:bg-zinc-100 font-bold rounded-xl text-xs cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-black rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow transition-colors"
                >
                  {isSaving ? "Gravando..." : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      Salvar Alterações
                    </>
                  )}
                </button>
              </div>

              {saveSuccess && (
                <div className="text-center text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-150 p-2.5 rounded-xl">
                  Alterações salvas com sucesso! Sincronizando catálogo...
                </div>
              )}

            </form>
          )}
        </div>
      </div>
    </div>
  );
}
