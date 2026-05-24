import React, { useState } from "react";
import { TrendingUp, RefreshCw, CheckCircle } from "lucide-react";
import { Supplier } from "../types";

interface BulkAdjustPricesProps {
  suppliers: Supplier[];
  onApplyBulkAdjust: (params: {
    supplierId: string;
    priceRange: string;
    discountPercent: number;
    fixedProfit: number;
  }) => void;
}

export default function BulkAdjustPrices({
  suppliers,
  onApplyBulkAdjust,
}: BulkAdjustPricesProps) {
  const [targetSupplier, setTargetSupplier] = useState("all");
  const [priceRange, setPriceRange] = useState("all");
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [fixedProfit, setFixedProfit] = useState<number>(0);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    onApplyBulkAdjust({
      supplierId: targetSupplier,
      priceRange,
      discountPercent,
      fixedProfit,
    });
    
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  return (
    <form onSubmit={handleUpdate} className="bg-white border border-zinc-150 p-5 rounded-2xl shadow-sm space-y-4">
      <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
        <TrendingUp className="w-4 h-4 text-emerald-600" />
        <h3 className="font-bold text-zinc-900 text-sm">Ajuste de Preço em Massa</h3>
      </div>

      <p className="text-[11px] leading-relaxed text-zinc-500">
        Você pode aplicar desconto e margem sobre todos os produtos, ou focar em faixas específicas de preço base e fornecedores de uma só vez.
      </p>

      {/* Fornecedor Alvo */}
      <div className="space-y-1">
        <label className="block text-[11px] font-semibold text-zinc-700">Fornecedor Alvo</label>
        <select
          value={targetSupplier}
          onChange={(e) => setTargetSupplier(e.target.value)}
          className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg text-xs text-zinc-900 bg-zinc-50/50 focus:outline-emerald-500"
        >
          <option value="all">Todos os Fornecedores (Qualquer)</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {/* Faixa de Preço Base */}
      <div className="space-y-1">
        <label className="block text-[11px] font-semibold text-zinc-700">Faixa de Preço Base</label>
        <select
          value={priceRange}
          onChange={(e) => setPriceRange(e.target.value)}
          className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg text-xs text-zinc-900 bg-zinc-50/50 focus:outline-emerald-500"
        >
          <option value="all">Todos os Produtos</option>
          <option value="0-500">Produtos até R$ 500,00</option>
          <option value="500-1000">Produtos de R$ 500,00 a R$ 1.000,00</option>
          <option value="1000+">Produtos acima de R$ 1.000,00</option>
        </select>
      </div>

      {/* Discount & Profit parameters */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block text-[11px] font-semibold text-zinc-700">Desconto Geral [%]</label>
          <input
            type="number"
            min="0"
            max="100"
            value={discountPercent || ""}
            onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
            placeholder="0"
            className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg text-xs text-zinc-900 focus:outline-emerald-500 bg-zinc-50/50"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-[11px] font-semibold text-zinc-700">Lucro Fixo [R$]</label>
          <input
            type="number"
            step="0.01"
            value={fixedProfit || ""}
            onChange={(e) => setFixedProfit(parseFloat(e.target.value) || 0)}
            placeholder="0.00"
            className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg text-xs text-zinc-900 focus:outline-emerald-500 bg-zinc-50/50"
          />
        </div>
      </div>

      {/* Confirm Button */}
      <div className="pt-1.5">
        <button
          type="submit"
          className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98]"
        >
          <RefreshCw className="w-3.5 h-3.5 animate-spin-slow" />
          Atualizar Preços
        </button>
      </div>

      {showSuccess && (
        <div className="text-center text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 p-2 rounded-lg flex items-center justify-center gap-1.5">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
          Preços em massa ajustados com sucesso!
        </div>
      )}
    </form>
  );
}
