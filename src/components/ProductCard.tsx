import React, { useState } from "react";
import { Trash2, Tag, ArrowRight, Share2, Check, Plus, Upload, Pin } from "lucide-react";
import { Product, Category, Supplier } from "../types";
import { compressImage } from "../lib/imageCompressor";

interface ProductCardProps {
  key?: React.Key;
  id: string;
  product: Product;
  categories: Category[];
  suppliers: Supplier[];
  onDelete: (id: string) => void | Promise<void>;
  onView?: (product: Product) => void;
  isAdmin?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  onUpdate?: (product: Product) => void | Promise<void>;
  isPinned?: boolean;
  pinnedIndex?: number;
  onTogglePin?: (id: string) => void;
}

export default function ProductCard({
  id,
  product,
  categories,
  suppliers,
  onDelete,
  onView,
  isAdmin = false,
  isSelected = false,
  onToggleSelect,
  onUpdate,
  isPinned = false,
  pinnedIndex,
  onTogglePin,
 }: ProductCardProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const categoryName = categories.find((c) => c.id === product.category_id)?.name || "Geral";
  const supplierName = suppliers.find((s) => s.id === product.supplier_id)?.name || "Nenhum";

  // Calculate installments with 17% added to the total (opção parcelada)
  const totalInstallmentPrice = product.price_final * 1.17;
  const installmentValue = totalInstallmentPrice / 12;

  // Retrieve thumbnail image
  const imageSource = product.images?.[0] || "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=400&q=80";

  // Paste handler for this card only when hovering
  React.useEffect(() => {
    if (!isAdmin || !isHovered || !onUpdate) return;

    const handlePasteOnCard = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf("image") !== -1) {
            const file = items[i].getAsFile();
            if (file) {
              const reader = new FileReader();
              reader.onloadend = async () => {
                const base64String = reader.result as string;
                // If the product already has one or more images, append instead of replacing
                const mode = (product.images && product.images.length > 0) ? "add" : "replace";
                await processAndEmitImage(base64String, mode);
              };
              reader.readAsDataURL(file);
              e.preventDefault();
              break;
            }
          }
        }
      }
    };

    window.addEventListener("paste", handlePasteOnCard, true);
    return () => window.removeEventListener("paste", handlePasteOnCard, true);
  }, [isAdmin, isHovered, onUpdate, product]);

  const handleQuickImageChange = (e: React.ChangeEvent<HTMLInputElement>, mode: "replace" | "add") => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      await processAndEmitImage(base64String, mode);
    };
    reader.readAsDataURL(file);
  };

  const processAndEmitImage = async (base64String: string, mode: "replace" | "add") => {
    if (!onUpdate) return;
    setIsUpdating(true);
    try {
      const compressedImage = await compressImage(base64String);
      let updatedImages = [...(product.images || [])];
      if (mode === "replace") {
        if (updatedImages.length > 0) {
          updatedImages[0] = compressedImage;
        } else {
          updatedImages = [compressedImage];
        }
      } else {
        updatedImages.push(compressedImage);
      }

      const updatedProduct: Product = {
        ...product,
        images: updatedImages,
      };

      await onUpdate(updatedProduct);
    } catch (err) {
      console.error("Erro ao atualizar foto rápida:", err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}${window.location.pathname}?produto=${product.id}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div
      id={id}
      onClick={() => onView?.(product)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`flex flex-col sm:flex-row gap-4 p-4 border rounded-2xl hover:shadow-md hover:border-amber-200 hover:bg-amber-50/5 cursor-pointer transition-all bg-white group relative ${
        isSelected ? "border-amber-400 bg-amber-50/10 shadow-sm" : "border-zinc-100"
      }`}
    >
      {/* Checkbox for bulk delete in admin mode */}
      {isAdmin && onToggleSelect && (
        <div 
          className="flex items-center justify-center pr-1 flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(product.id)}
            className="w-5 h-5 rounded border-zinc-300 text-amber-500 focus:ring-amber-500 cursor-pointer"
          />
        </div>
      )}

      {/* Product Image Thumbnail Column (with fast update features under it) */}
      <div className="flex flex-col items-center flex-shrink-0 w-full sm:w-28 gap-2">
        <div className="w-full h-64 sm:h-28 rounded-xl bg-zinc-50 border border-zinc-150 overflow-hidden flex items-center justify-center relative flex-shrink-0 shadow-sm hover:shadow transition-shadow">
          <img
            src={imageSource}
            alt={product.name}
            className="w-full h-full object-contain p-1 bg-white group-hover:scale-105 transition-transform duration-500"
            referrerPolicy="no-referrer"
            loading="lazy"
            decoding="async"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=400&q=80";
            }}
          />
          
          {isPinned && (
            <div className="absolute top-1.5 left-1.5 bg-amber-500 text-zinc-950 font-black text-[9px] px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-0.5 shadow-sm z-10 transition-transform">
              <Pin className="w-2 h-2 fill-zinc-950" />
              <span>Destaque</span>
            </div>
          )}

          {/* Ctrl+V Paste Helper Overlay on Hover */}
          {isAdmin && isHovered && onUpdate && !isUpdating && (
            <div className="absolute inset-0 bg-zinc-950/70 flex flex-col items-center justify-center text-center p-1 text-[10px] text-zinc-100 font-bold opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <span>Cole imagem</span>
              <span className="text-[9px] font-mono mt-0.5 text-amber-400">Ctrl + V</span>
            </div>
          )}

          {/* Loading spinner when processing quick photo uploads */}
          {isUpdating && (
            <div className="absolute inset-0 bg-amber-500/80 flex flex-col items-center justify-center text-center p-1 text-[10px] text-zinc-950 font-black">
              <span className="animate-pulse">Enviando...</span>
            </div>
          )}
        </div>

        {/* Action Button toolbar right below the image thumbnail */}
        {isAdmin && onUpdate && (
          <div className="w-full flex gap-1" onClick={(e) => e.stopPropagation()}>
            <label className="flex-1 px-1 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg text-[9px] font-bold text-center cursor-pointer transition-colors flex items-center justify-center gap-0.5" title="Substituir foto principal">
              <Upload className="w-2.5 h-2.5 text-amber-600" />
              <span>Alterar</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleQuickImageChange(e, "replace")}
                className="hidden"
              />
            </label>
            <label className="flex-1 px-1 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-200 rounded-lg text-[9px] font-bold text-center cursor-pointer transition-colors flex items-center justify-center gap-0.5" title="Adicionar foto extra">
              <Plus className="w-2.5 h-2.5 text-zinc-500" />
              <span>Add</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleQuickImageChange(e, "add")}
                className="hidden"
              />
            </label>
          </div>
        )}
      </div>

      {/* Product Information */}
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-sans font-bold text-zinc-900 group-hover:text-amber-600 transition-colors text-base tracking-tight leading-snug">
              {product.name}
            </h4>
          </div>
          
          <p className="text-xs text-zinc-500 mt-1 line-clamp-2 whitespace-pre-line leading-relaxed">
            {product.description || "Sem descrição disponível."}
          </p>
        </div>

        <div className="mt-4 pt-3 border-t border-zinc-50 flex flex-wrap items-end justify-between gap-3">
          
          {/* Price information */}
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-xs text-zinc-400 font-medium">À Vista:</span>
              <span className="text-lg font-black text-slate-900 tracking-tight">
                R$ {product.price_final.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            
            {/* Installments calculations */}
            <p className="text-[11px] text-emerald-600 font-bold tracking-tight">
              Ou em até 12x de R$ {installmentValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}*
            </p>
          </div>

          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            {/* Share action */}
            <button
              type="button"
              onClick={handleShare}
              className={`p-2 rounded-xl transition-all border ${copiedLink ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-zinc-50 text-zinc-500 border-zinc-200 hover:bg-zinc-150'} cursor-pointer`}
              title="Copiar Link do Produto"
            >
              {copiedLink ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
            </button>

            {/* If Admin view toggled, display management tools */}
            {isAdmin ? (
              <>
                <div className="text-[10px] text-zinc-400 mr-2 text-right">
                  <span className="block font-medium text-purple-700">Forn: {supplierName}</span>
                  <span className="block text-emerald-700 font-semibold">Lucro: R$ {product.profit_desired.toFixed(2)}</span>
                </div>
                {onTogglePin && (
                  <button
                    type="button"
                    onClick={() => onTogglePin(product.id)}
                    className={`p-2 rounded-xl transition-all border cursor-pointer ${
                      isPinned 
                        ? "bg-amber-100 text-amber-900 border-amber-300 font-bold shadow-xs scale-105" 
                        : "bg-zinc-50 text-zinc-400 border-zinc-200 hover:bg-zinc-100 hover:text-zinc-650"
                    }`}
                    title={isPinned ? `Remover Destaque (Destaque #${pinnedIndex !== undefined ? pinnedIndex + 1 : ""})` : "Destaque (Aparecer Primeiro)"}
                  >
                    <Pin className={`w-4 h-4 ${isPinned ? "rotate-45 text-amber-500 fill-amber-500" : ""}`} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onDelete(product.id)}
                  className="text-zinc-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-red-100"
                  title="Excluir produto (Admin)"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => onView?.(product)}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-zinc-950 text-xs font-black rounded-xl flex items-center gap-1 shadow-sm transition-all cursor-pointer"
              >
                Ver Detalhes
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
