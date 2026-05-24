import React, { useState } from "react";
import { Plus, Trash2, Building2 } from "lucide-react";
import { Supplier } from "../types";

interface ManageSuppliersProps {
  suppliers: Supplier[];
  onAddSupplier: (name: string) => void;
  onDeleteSupplier: (id: string) => void;
}

export default function ManageSuppliers({
  suppliers,
  onAddSupplier,
  onDeleteSupplier,
}: ManageSuppliersProps) {
  const [newSup, setNewSup] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSup.trim()) return;
    onAddSupplier(newSup.trim());
    setNewSup("");
  };

  return (
    <div className="bg-white border border-zinc-150 p-5 rounded-2xl shadow-sm space-y-4">
      <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
        <Building2 className="w-4 h-4 text-purple-600" />
        <h3 className="font-bold text-zinc-900 text-sm">Fornecedores (Interno)</h3>
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={newSup}
          onChange={(e) => setNewSup(e.target.value)}
          placeholder="Novo Fornecedor"
          required
          className="flex-1 px-3 py-1.5 border border-zinc-200 rounded-lg text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-purple-500 bg-zinc-50/50"
        />
        <button
          type="submit"
          className="px-3 py-1.5 bg-purple-100 font-bold hover:bg-purple-200 text-purple-700 rounded-lg text-xs transition-colors cursor-pointer"
        >
          Adicionar
        </button>
      </form>

      {/* Scrolling list */}
      <div className="max-h-56 overflow-y-auto border border-zinc-100 rounded-xl divide-y divide-zinc-50 pr-1">
        {suppliers.length === 0 ? (
          <p className="p-3 text-center text-zinc-400 text-xs italic">Nenhum fornecedor registrado.</p>
        ) : (
          suppliers.map((sup) => (
            <div
              key={sup.id}
              className="flex justify-between items-center p-2.5 text-xs text-zinc-800 hover:bg-zinc-50 transition-colors"
            >
              <span className="font-medium truncate">{sup.name}</span>
              <button
                type="button"
                onClick={() => onDeleteSupplier(sup.id)}
                className="text-zinc-400 hover:text-red-500 p-1.5 rounded transition-colors cursor-pointer"
                title="Excluir fornecedor"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
