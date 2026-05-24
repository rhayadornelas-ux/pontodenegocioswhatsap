import React, { useState } from "react";
import { Plus, Trash2, FolderOpen } from "lucide-react";
import { Category } from "../types";

interface ManageCategoriesProps {
  categories: Category[];
  onAddCategory: (name: string) => void;
  onDeleteCategory: (id: string) => void;
}

export default function ManageCategories({
  categories,
  onAddCategory,
  onDeleteCategory,
}: ManageCategoriesProps) {
  const [newCat, setNewCat] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCat.trim()) return;
    onAddCategory(newCat.trim());
    setNewCat("");
  };

  return (
    <div className="bg-white border border-zinc-150 p-5 rounded-2xl shadow-sm space-y-4">
      <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
        <FolderOpen className="w-4 h-4 text-blue-600" />
        <h3 className="font-bold text-zinc-900 text-sm">Gerenciar Categorias</h3>
      </div>

      {/* Input to Add Category */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={newCat}
          onChange={(e) => setNewCat(e.target.value)}
          placeholder="Nova Categoria"
          required
          className="flex-1 px-3 py-1.5 border border-zinc-200 rounded-lg text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-blue-500 bg-zinc-50/50"
        />
        <button
          type="submit"
          className="px-3 py-1.5 bg-blue-100 font-bold hover:bg-blue-200 text-blue-700 rounded-lg text-xs transition-colors cursor-pointer"
        >
          Adicionar
        </button>
      </form>

      {/* Scrollable List */}
      <div className="max-h-56 overflow-y-auto border border-zinc-100 rounded-xl divide-y divide-zinc-50 pr-1">
        {categories.length === 0 ? (
          <p className="p-3 text-center text-zinc-400 text-xs italic">Nenhuma categoria registrada.</p>
        ) : (
          categories.map((cat) => (
            <div
              key={cat.id}
              className="flex justify-between items-center p-2.5 text-xs text-zinc-800 hover:bg-zinc-50 transition-colors"
            >
              <span className="font-medium truncate">{cat.name}</span>
              <button
                type="button"
                onClick={() => onDeleteCategory(cat.id)}
                className="text-zinc-400 hover:text-red-500 p-1.5 rounded transition-colors cursor-pointer"
                title="Excluir categoria"
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
