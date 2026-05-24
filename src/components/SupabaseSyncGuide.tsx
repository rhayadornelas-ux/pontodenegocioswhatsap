import React, { useState } from "react";
import { Database, Copy, Check, Info, Shield, KeyRound, Terminal, RefreshCw, AlertTriangle, CheckCircle } from "lucide-react";
import { supabase, SUPABASE_STATUS } from "../lib/supabase";

export default function SupabaseSyncGuide() {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [userGeminiKey, setUserGeminiKey] = useState(() => localStorage.getItem("user_gemini_api_key") || "");
  const [keySaved, setKeySaved] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testResults, setTestResults] = useState<{
    tested: boolean;
    connectionOk: boolean;
    categories: { status: 'ok' | 'error'; count?: number; error?: string };
    suppliers: { status: 'ok' | 'error'; count?: number; error?: string };
    products: { status: 'ok' | 'error'; count?: number; error?: string };
  } | null>(null);

  const sqlCode = `-- EXECUTAR NO SQL EDITOR DO SUPABASE PARA PREPARAR O BANCO DE DADOS:

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

-- HABILITAR CONTROLE DE ACESSO PÚBLICO (Mudar conforme sua preferência de segurança)
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

  const handleCopy = () => {
    navigator.clipboard.writeText(sqlCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const testConnectionAndTables = async () => {
    setTestLoading(true);
    setTestResults(null);

    // Give a neat small timeout for UI feedback
    await new Promise((resolve) => setTimeout(resolve, 600));

    if (!supabase) {
      setTestResults({
        tested: true,
        connectionOk: false,
        categories: { status: 'error', error: "O cliente Supabase não pôde ser inicializado. Verifique se o VITE_SUPABASE_URL está configurado corretamente." },
        suppliers: { status: 'error', error: "O cliente Supabase não pôde ser inicializado." },
        products: { status: 'error', error: "O cliente Supabase não pôde ser inicializado." },
      });
      setTestLoading(false);
      return;
    }

    try {
      // 1. Query ponto_categories
      const catRes = await supabase.from("ponto_categories").select("id", { count: "exact" }).limit(1);
      // 2. Query ponto_suppliers
      const supRes = await supabase.from("ponto_suppliers").select("id", { count: "exact" }).limit(1);
      // 3. Query ponto_products
      const prodRes = await supabase.from("ponto_products").select("id", { count: "exact" }).limit(1);

      const catStatus = catRes.error 
        ? { status: 'error' as const, error: catRes.error.message } 
        : { status: 'ok' as const, count: catRes.count || catRes.data?.length || 0 };

      const supStatus = supRes.error 
        ? { status: 'error' as const, error: supRes.error.message } 
        : { status: 'ok' as const, count: supRes.count || supRes.data?.length || 0 };

      const prodStatus = prodRes.error 
        ? { status: 'error' as const, error: prodRes.error.message } 
        : { status: 'ok' as const, count: prodRes.count || prodRes.data?.length || 0 };

      const connectionOk = !catRes.error && !supRes.error && !prodRes.error;

      setTestResults({
        tested: true,
        connectionOk,
        categories: catStatus,
        suppliers: supStatus,
        products: prodStatus,
      });
    } catch (err: any) {
      console.error("Test execution caught error:", err);
      setTestResults({
        tested: true,
        connectionOk: false,
        categories: { status: 'error', error: err.message || "Falha ao enviar requisição HTTP ao banco de dados." },
        suppliers: { status: 'error', error: "Falha de conexão" },
        products: { status: 'error', error: "Falha de conexão" },
      });
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="bg-zinc-950 text-zinc-200 border border-zinc-800 p-5 rounded-2xl shadow-lg space-y-4 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-3 h-3 rounded-full ${SUPABASE_STATUS.isConfigured ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
          <div>
            <h3 className="font-bold text-sm tracking-wide flex items-center gap-1.5 text-white">
              <Database className="w-4 h-4 text-emerald-400" />
              INTEGRAÇÃO COM SUPABASE
            </h3>
            <p className="text-[10px] text-zinc-400">
              {SUPABASE_STATUS.isConfigured 
                ? "Sincronizado ativamente com seu banco de dados na nuvem" 
                : "Modo Offline ativo (Salvando localmente no navegador)"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={testConnectionAndTables}
            disabled={testLoading}
            className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[11px] font-bold rounded-lg cursor-pointer transition-colors border border-emerald-500/20 disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${testLoading ? 'animate-spin' : ''}`} />
            {testLoading ? "Testando..." : "Testar Tabelas"}
          </button>

          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="px-2.5 py-1 bg-zinc-805 bg-zinc-800 hover:bg-zinc-700 text-[11px] font-semibold text-white rounded-lg cursor-pointer transition-colors"
          >
            {expanded ? "Ocultar SQL" : "Como Conectar?"}
          </button>
        </div>
      </div>

      {/* Connection & Table Test Panel */}
      {testResults && (
        <div className="bg-zinc-900/55 border border-zinc-800 p-4 rounded-xl space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-widest text-zinc-400 uppercase">RESULTADO DO DIAGNÓSTICO:</span>
            {testResults.connectionOk ? (
              <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">
                <CheckCircle className="w-3 h-3" /> TUDO OK!
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 bg-rose-500/10 text-rose-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-rose-500/20">
                <AlertTriangle className="w-3 h-3" /> COM ALERTA
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {/* Table Categories */}
            <div className={`p-3 rounded-lg border ${testResults.categories.status === 'ok' ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-rose-500/5 border-rose-500/10'}`}>
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-xs tracking-tight text-white">Categories</span>
                {testResults.categories.status === 'ok' ? (
                  <span className="text-emerald-400 font-bold text-[10px]">Ativa</span>
                ) : (
                  <span className="text-rose-400 font-bold text-[10px]">Erro</span>
                )}
              </div>
              <p className="text-[10px] text-zinc-400 leading-tight">Tabela: <code className="text-zinc-300">ponto_categories</code></p>
              {testResults.categories.status === 'ok' ? (
                <p className="text-emerald-400 text-xs font-semibold mt-1">✓ {testResults.categories.count} registros carregados</p>
              ) : (
                <p className="text-rose-400 text-[10px] leading-tight font-medium mt-1 mt-1 font-mono">{testResults.categories.error}</p>
              )}
            </div>

            {/* Table Suppliers */}
            <div className={`p-3 rounded-lg border ${testResults.suppliers.status === 'ok' ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-rose-500/5 border-rose-500/10'}`}>
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-xs tracking-tight text-white">Suppliers</span>
                {testResults.suppliers.status === 'ok' ? (
                  <span className="text-emerald-400 font-bold text-[10px]">Ativa</span>
                ) : (
                  <span className="text-rose-400 font-bold text-[10px]">Erro</span>
                )}
              </div>
              <p className="text-[10px] text-zinc-400 leading-tight">Tabela: <code className="text-zinc-300">ponto_suppliers</code></p>
              {testResults.suppliers.status === 'ok' ? (
                <p className="text-emerald-400 text-xs font-semibold mt-1">✓ {testResults.suppliers.count} registros carregados</p>
              ) : (
                <p className="text-rose-400 text-[10px] leading-tight font-medium mt-1 font-mono">{testResults.suppliers.error}</p>
              )}
            </div>

            {/* Table Products */}
            <div className={`p-3 rounded-lg border ${testResults.products.status === 'ok' ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-rose-500/5 border-rose-500/10'}`}>
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-xs tracking-tight text-white">Products</span>
                {testResults.products.status === 'ok' ? (
                  <span className="text-emerald-400 font-bold text-[10px]">Ativa</span>
                ) : (
                  <span className="text-rose-400 font-bold text-[10px]">Erro</span>
                )}
              </div>
              <p className="text-[10px] text-zinc-400 leading-tight">Tabela: <code className="text-zinc-300">ponto_products</code></p>
              {testResults.products.status === 'ok' ? (
                <p className="text-emerald-400 text-xs font-semibold mt-1">✓ {testResults.products.count} produtos catalogados</p>
              ) : (
                <p className="text-rose-400 text-[10px] leading-tight font-medium mt-1 font-mono">{testResults.products.error}</p>
              )}
            </div>
          </div>

          {!testResults.connectionOk && (
            <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg text-[11px] text-amber-200 leading-relaxed">
              <strong>Como Corrigir Erros de Tabela:</strong> Se você recebeu mensagens informando que as tabelas "does not exist" (não existem) ou violação de segurança, clique no botão <strong>"Como Conectar?"</strong> à direita para exibir as instruções de criação de tabelas e políticas de acesso (row-level security) e cole o script no console SQL do Supabase.
            </div>
          )}
        </div>
      )}

      {!SUPABASE_STATUS.isConfigured && !expanded && !testResults && (
        <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl text-xs text-amber-200">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
          <p className="leading-relaxed text-[11px]">
            O catálogo está funcional utilizando <strong>LocalStorage</strong> para guardar dados com segurança no navegador. Clique em "Como Conectar" para ver como vincular sua nuvem Supabase em 2 minutos! Ou clique em <strong>"Testar Tabelas"</strong> para diagnosticar a conexão atual.
          </p>
        </div>
      )}

      {expanded && (
        <div className="space-y-4 animate-fade-in text-xs leading-relaxed text-zinc-300">
          <div className="space-y-2">
            <h4 className="font-bold text-white flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
              1. Configurar Chaves no AI Studio (Secrets) ou no arquivo .env
            </h4>
            <p className="text-[11px] text-zinc-400 pl-5">
              Abra a aba de configurações à direita, selecione <strong>Secrets</strong> e insira os seguintes pares, ou adicione em seu arquivo local:
            </p>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-zinc-300 pl-5">
              <li><code className="bg-zinc-900 px-1 py-0.5 rounded text-zinc-100">VITE_SUPABASE_URL</code> : Seu endpoint de API (ex: <code className="text-zinc-400">https://abc.supabase.co</code>)</li>
              <li><code className="bg-zinc-900 px-1 py-0.5 rounded text-zinc-100">VITE_SUPABASE_ANON_KEY</code> : Sua chave anônima (anon public key)</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-white flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-blue-400" />
              2. Executar Script SQL no Supabase
            </h4>
            <p className="text-[11px] text-zinc-400 pl-5">
              Abra o dashboard da sua conta Supabase, vá em <strong>SQL Editor</strong>, clique em <strong>New Query</strong>, cole o código abaixo e clique em <strong>Run</strong>:
            </p>

            {/* SQL Code block */}
            <div className="relative border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950">
              <div className="flex justify-between items-center bg-zinc-900 px-3 py-1.5 border-b border-zinc-800">
                <span className="text-[10px] font-mono text-zinc-400 text-xs">schema.sql</span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="text-zinc-400 hover:text-white flex items-center gap-1 text-[10px] cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      Copiar SQL
                    </>
                  )}
                </button>
              </div>
              <pre className="p-3 text-[10px] font-mono overflow-x-auto max-h-44 text-zinc-400 leading-normal">
                {sqlCode}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* SEÇÃO DA API DO GEMINI */}
      <div className="border-t border-zinc-800/80 pt-4 mt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-amber-500" />
            <span className="font-bold text-xs tracking-tight text-white uppercase">Chave de API do Gemini (IA)</span>
          </div>
          {localStorage.getItem("user_gemini_api_key") ? (
            <span className="bg-amber-500/10 text-amber-400 text-[9px] font-bold px-1.5 py-0.5 rounded border border-amber-500/15">
              CHAVE PRÓPRIA ATIVA
            </span>
          ) : (
            <span className="bg-zinc-800 text-zinc-400 text-[9px] font-bold px-1.5 py-0.5 rounded border border-zinc-700">
              PADRÃO COMPARTILHADA
            </span>
          )}
        </div>
        
        <p className="text-[10px] text-zinc-400 leading-normal mt-1 mb-2.5">
          Como seu site foi publicado via <strong>Netlify Drop</strong> (sem integração git para ler variáveis de ambiente automaticamente), configurar sua chave de API pessoal diretamente aqui é a solução perfeita. Ela ficará salva com segurança apenas no seu navegador.
        </p>
        
        <div className="flex gap-2">
          <input
            type="password"
            placeholder="Cole sua chave API aqui (AIzaSy...)"
            value={userGeminiKey}
            onChange={(e) => {
              setUserGeminiKey(e.target.value);
              setKeySaved(false);
            }}
            className="flex-1 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-all"
          />
          <button
            type="button"
            onClick={() => {
              if (userGeminiKey.trim()) {
                localStorage.setItem("user_gemini_api_key", userGeminiKey.trim());
              } else {
                localStorage.removeItem("user_gemini_api_key");
              }
              setKeySaved(true);
              setTimeout(() => setKeySaved(false), 2000);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              keySaved 
                ? 'bg-emerald-600 text-white border border-emerald-500' 
                : 'bg-amber-600 hover:bg-amber-500 text-zinc-950 border border-amber-500'
            }`}
          >
            {keySaved ? "Salvo!" : "Aplicar"}
          </button>
        </div>
        
        <div className="mt-2 text-[9px] text-zinc-500 leading-normal flex items-center justify-between">
          <span>Obtenha uma chave grátis no Google AI Studio.</span>
          {userGeminiKey && (
            <button
              type="button"
              onClick={() => {
                setUserGeminiKey("");
                localStorage.removeItem("user_gemini_api_key");
                setKeySaved(true);
                setTimeout(() => setKeySaved(false), 1500);
              }}
              className="text-zinc-400 hover:text-white underline cursor-pointer"
            >
              Restaurar chave padrão
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
