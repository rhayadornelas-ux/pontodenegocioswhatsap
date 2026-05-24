import React, { useState, useRef } from "react";
import { Download, Upload, Copy, Check, Database, ShieldAlert, FileJson, RefreshCw, Layers } from "lucide-react";
import { Product, Category, Supplier } from "../types";
import { StorageService } from "../lib/storage";

interface BackupRestorePanelProps {
  products: Product[];
  categories: Category[];
  suppliers: Supplier[];
  onRestoreCompleted: () => void;
}

export default function BackupRestorePanel({
  products,
  categories,
  suppliers,
  onRestoreCompleted,
}: BackupRestorePanelProps) {
  const [copiedSql, setCopiedSql] = useState(false);
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<{
    show: boolean;
    success: boolean;
    message: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const sqlCode = `-- EXECUTAR NO SQL EDITOR DO SUPABASE PARA RECRIAR TODAS AS TABELAS DO ZERO:

CREATE TABLE IF NOT EXISTS ponto_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS ponto_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS ponto_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category_id UUID REFERENCES ponto_categories(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES ponto_suppliers(id) ON DELETE SET NULL,
  price_full DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  profit_desired DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  cost_real DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  price_final DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  description TEXT,
  images TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- HABILITAR CONTROLE DE ACESSO PÚBLICO (Políticas RLS)
ALTER TABLE ponto_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE ponto_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ponto_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso público geral para leitura" ON ponto_categories FOR SELECT USING (true);
CREATE POLICY "Acesso público geral para escrita" ON ponto_categories FOR INSERT WITH CHECK (true);
CREATE POLICY "Acesso público geral para exclusão" ON ponto_categories FOR DELETE USING (true);

CREATE POLICY "Acesso público geral para leitura" ON ponto_suppliers FOR SELECT USING (true);
CREATE POLICY "Acesso público geral para escrita" ON ponto_suppliers FOR INSERT WITH CHECK (true);
CREATE POLICY "Acesso público geral para exclusão" ON ponto_suppliers FOR DELETE USING (true);

CREATE POLICY "Acesso público geral para leitura" ON ponto_products FOR SELECT USING (true);
CREATE POLICY "Acesso público geral para escrita" ON ponto_products FOR INSERT WITH CHECK (true);
CREATE POLICY "Acesso público geral para atualização" ON ponto_products FOR UPDATE USING (true);
CREATE POLICY "Acesso público geral para exclusão" ON ponto_products FOR DELETE USING (true);
`;

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlCode);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const handleExportBackup = () => {
    try {
      const backupData = {
        app_identifier: "ponto-de-negocios-catalogo",
        exported_at: new Date().toISOString(),
        categories,
        suppliers,
        products,
      };

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      const dateStr = new Date().toISOString().split("T")[0];
      link.href = url;
      link.download = `backup-completo-ponto-catalogo-${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("Erro ao gerar backup: " + err.message);
    }
  };

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsImporting(true);
    setImportStatus(null);

    const file = files[0];
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const backupData = JSON.parse(text);

        // Sanity validation
        if (
          !Array.isArray(backupData.categories) &&
          !Array.isArray(backupData.suppliers) &&
          !Array.isArray(backupData.products)
        ) {
          throw new Error("O arquivo não parece conter um backup válido (Estrutura incorreta).");
        }

        const msg_confirm = importMode === "replace"
          ? "ATENÇÃO: Você escolheu 'Substituir todo o catálogo'. Isso irá limpar todos os produtos e cadastros do sistema antes de restaurar o backup. Deseja prosseguir?"
          : `Você deseja mesclar estes cadastros ao seu catálogo atual?`;

        if (!confirm(msg_confirm)) {
          setIsImporting(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
          return;
        }

        const result = await StorageService.importFullBackup(backupData, importMode);

        if (result.success) {
          setImportStatus({
            show: true,
            success: true,
            message: `Backup restaurado com sucesso! Foram carregados ${result.productsCount} produtos, ${result.categoriesCount} categorias e ${result.suppliersCount} fornecedores. ${
              result.supabaseSynced 
                ? "Sincronizado perfeitamente com o Supabase!" 
                : "Importado localmente (módulo offline)."
            }`
          });
          onRestoreCompleted();
        } else {
          setImportStatus({
            show: true,
            success: false,
            message: `Erro na importação: ${result.error || "Formato de arquivo inválido"}`
          });
        }
      } catch (err: any) {
        setImportStatus({
          show: true,
          success: false,
          message: `Ocorreu um erro ao processar o JSON: ${err.message}`
        });
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };

    reader.readAsText(file);
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm p-5 space-y-6">
      <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
        <Database className="w-5 h-5 text-amber-500" />
        <div>
          <h3 className="font-extrabold text-xs text-zinc-900 uppercase tracking-wider">
            Backup & Segurança de Dados
          </h3>
          <p className="text-[10px] text-zinc-500 font-medium">
            Garanta a imunidade do seu catálogo contra imprevistos ou perdas no Supabase.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Export Backup Box */}
        <div className="bg-amber-50/20 border border-amber-100 p-4 rounded-xl flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs">
              <Download className="w-4 h-4 text-amber-600" />
              <span>1. Gerar Backup (.json)</span>
            </div>
            <p className="text-[10px] text-zinc-500 mt-1">
              Baixe um único arquivo completo contendo {products.length} produtos, {categories.length} categorias e {suppliers.length} fornecedores. Guarde este arquivo em local seguro.
            </p>
          </div>
          <button
            onClick={handleExportBackup}
            className="w-full py-2 bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-zinc-950 font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Fazer Backup Completo</span>
          </button>
        </div>

        {/* Import Backup Box */}
        <div className="bg-zinc-50 border border-zinc-200 p-4 rounded-xl space-y-3">
          <div className="flex items-center gap-1.5 text-zinc-900 font-bold text-xs">
            <Upload className="w-4 h-4 text-zinc-600" />
            <span>2. Restaurar de um Backup</span>
          </div>

          <div className="flex bg-zinc-200/50 p-0.5 rounded-lg text-[10px] font-bold">
            <button
              onClick={() => setImportMode("merge")}
              className={`flex-1 py-1 rounded-md transition-all ${
                importMode === "merge" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
              }`}
            >
              Mesclar Dados Novos
            </button>
            <button
              onClick={() => setImportMode("replace")}
              className={`flex-1 py-1 rounded-md transition-all ${
                importMode === "replace" ? "bg-red-600 text-white shadow-sm" : "text-zinc-500"
              }`}
            >
              ⚠️ Sobrescrever Tudo
            </button>
          </div>

          <label className="w-full py-2 bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-700 font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs">
            {isImporting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-500" />
                <span>Restaurando...</span>
              </>
            ) : (
              <>
                <FileJson className="w-3.5 h-3.5 text-amber-600" />
                <span>Selecionar Arquivo de Backup</span>
              </>
            )}
            <input
              type="file"
              ref={fileInputRef}
              accept=".json"
              disabled={isImporting}
              onChange={handleImportFileChange}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* SQL Quick Restore Code snippet block */}
      <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-4 text-zinc-100 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-amber-400 animate-pulse" />
            <span className="font-extrabold text-[11px] uppercase tracking-wider text-zinc-300">
              3. Estrutura de Tabelas Supabase (SQL)
            </span>
          </div>
          <button
            onClick={handleCopySql}
            className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all"
          >
            {copiedSql ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span>Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copiar Script SQL</span>
              </>
            )}
          </button>
        </div>
        <p className="text-[10px] text-zinc-400 leading-normal">
          Se você migrar de banco, perder sua conta Supabase ou precisar recriar a estrutura do zero, copie este script e cole-o no <strong>SQL Editor</strong> do painel do seu Supabase para criar todas as tabelas e políticas corretas automaticamente em segundos.
        </p>
        <div className="max-h-24 overflow-y-auto font-mono text-[9px] bg-zinc-900/60 p-2 rounded border border-zinc-850 text-zinc-400">
          <pre>{sqlCode}</pre>
        </div>
      </div>

      {importStatus && (
        <div
          className={`p-3 rounded-xl border text-[11px] leading-relaxed flex items-start gap-2 ${
            importStatus.success
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-red-50 border-red-200 text-red-900"
          }`}
        >
          <div className="mt-0.5">
            {importStatus.success ? "✅" : "⚠️"}
          </div>
          <p>{importStatus.message}</p>
        </div>
      )}
    </div>
  );
}
