import React, { useState } from "react";
import { Sparkles, Link2, Percent, Trash2, CheckCircle2, AlertCircle, Image as ImageIcon, FileText, Upload, X } from "lucide-react";
import { Category, Supplier, Product } from "../types";

function Spinner() {
  return (
    <div className="w-4 h-4 border-2 border-indigo-650 border-t-transparent rounded-full animate-spin inline-block mr-2 align-middle" />
  );
}

interface BulkImportFormProps {
  categories: Category[];
  suppliers: Supplier[];
  onAddProduct: (product: Omit<Product, "id">) => Promise<void>;
}

interface ExtractedProduct {
  name: string;
  catalog_price: number;
  category_name?: string;
  supplier_name?: string;
  description: string;
}

interface UploadedFile {
  data: string;
  mimeType: string;
  name: string;
}

export default function BulkImportForm({
  categories,
  suppliers,
  onAddProduct,
}: BulkImportFormProps) {
  const [catalogUrl, setCatalogUrl] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [catalogFiles, setCatalogFiles] = useState<UploadedFile[]>([]);
  
  // Default values when not matchable
  const [defaultCategoryId, setDefaultCategoryId] = useState(categories[0]?.id || "");
  const [defaultSupplierId, setDefaultSupplierId] = useState(suppliers[0]?.id || "");

  // Pricing formula configs
  const [discountPercent, setDiscountPercent] = useState<number>(0); 
  const [profitMode, setProfitMode] = useState<"fixed" | "percent">("percent"); 
  const [profitAmount, setProfitAmount] = useState<number>(25); 

  // Automation states
  const [isLoading, setIsLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [extractedItems, setExtractedItems] = useState<ExtractedProduct[]>([]);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  // Read images/pdfs and convert to base64 string safely
  const processFiles = (files: File[]) => {
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setCatalogFiles((prev) => [
          ...prev,
          {
            data: base64,
            mimeType: file.type,
            name: file.name,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = (Array.from(e.target.files) as File[]).filter(
      (file) => file.type.startsWith("image/") || file.type === "application/pdf"
    );
    processFiles(files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      const files = (Array.from(e.dataTransfer.files) as File[]).filter(
        (file) => file.type.startsWith("image/") || file.type === "application/pdf"
      );
      processFiles(files);
    }
  };

  const handleRemoveUploadedFile = (indexToRemove: number) => {
    setCatalogFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Support pasting images, PDFs or text anywhere in the importer (Ctrl + V)
  const handlePaste = (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData.files) as File[];
    const validFiles = files.filter(
      (file) => file.type.startsWith("image/") || file.type === "application/pdf"
    );

    if (validFiles.length > 0) {
      e.preventDefault();
      processFiles(validFiles);
      return;
    }

    // Check if user is already typing inside an input/textarea in the form
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
      return; // Let native text paste happen
    }

    // Otherwise, grab text from clipboard and add it to the parsed text box
    const text = e.clipboardData.getData("text");
    if (text) {
      e.preventDefault();
      setPastedText((prev) => (prev ? prev + "\n" + text : text));
    }
  };

  // Trigger Gemini API bulk extraction endpoint
  const handleExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catalogUrl.trim() && !pastedText.trim() && catalogFiles.length === 0) {
      setError("Por favor, envie o PDF do catálogo, fotos, link ou cole o texto dos produtos.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessCount(null);
    setExtractedItems([]);
    setProgressMsg("Iniciando varredura inteligente do PDF / Imagem de catálogo com Gemini 3.5...");

    try {
      // Collect names to assist Gemini mapping
      const categoriesList = categories.map((c) => c.name);
      const suppliersList = suppliers.map((s) => s.name);

      let data: any = null;
      let fallbackToClient = false;

      try {
        const res = await fetch("/api/catalog/bulk-extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: catalogUrl.trim(),
            pastedText: pastedText.trim(),
            categoriesList,
            suppliersList,
            files: catalogFiles.map((f) => ({ data: f.data, mimeType: f.mimeType })),
          }),
        });

        if (!res.ok) {
          throw new Error(`Erro na rota do servidor (${res.status})`);
        }

        data = await res.json();
      } catch (serverErr: any) {
        console.warn("Servidor indisponível ou retornou erro (ex: Netlify sem suporte a backend ativo). Iniciando contingência direta via navegador...", serverErr);
        fallbackToClient = true;
      }

      if (fallbackToClient || !data || !data.success) {
        setProgressMsg("Servidor offline/estático. Conectando diretamente à API do Gemini via navegador...");
        
        const categoriesPrompt = categoriesList && categoriesList.length > 0
          ? `Tente classificar cada produto em uma destas categorias se adequado: ${categoriesList.join(", ")}.`
          : `Categorias comuns recomendadas: Armários, Guarda Roupas, Mesas, Comodas, Rack Home e Painel.`;

        const suppliersPrompt = suppliersList && suppliersList.length > 0
          ? `Tente associar a uma destas marcas/fornecedores se encontrado: ${suppliersList.join(", ")}.`
          : `Se encontrar marcas ou fabricantes como Baião, Balcão, Jr Colchões, insira-os.`;

        const promptText = `Você é um robô de Inteligência Artificial especializado na leitura e extração de dados de catálogos de móveis por imagem, texto ou PDF comercial completo.
Analise detalhadamente todos os dados fornecidos (imagens de catálogo, texto ou documento PDF anexado) para extrair todos os produtos/móveis ofertados.

Para cada produto/móvel real que você identificar, extraia as seguintes propriedades:
1. 'name': Nome comercial completo do móvel/produto de forma limpa e bonita (Exemplo: "Guarda-Roupa Casal 6 Portas").
2. 'catalog_price': O preço do produto listado (número decimal, ou 0 se não localizado). Se houver preço à vista e a prazo, retorne o preço a prazo para podermos aplicar os reajustes.
3. 'category_name': Categoria ideal para o móvel. ${categoriesPrompt}
4. 'supplier_name': Fornecedor ou marca do produto se identificado ou deduzido. ${suppliersPrompt}
5. 'description': Crie uma descrição comercial concisa, limpa, clara e profissional estruturada em subtópicos. Destaque especificações essenciais como dimensões ou diferenciais técnicos. Não acrescente hashtags. No final da descrição, inclua obrigatoriamente a frase: "Entrega ultra rápida".

Ignore linhas, cabeçalhos ou menus que não sejam produtos reais.
Sempre retorne estritamente um JSON contendo a lista sob a chave 'products'.`;

        const storedApiKey = localStorage.getItem("user_gemini_api_key");
        const apiKey = storedApiKey || (import.meta as any).env?.VITE_GEMINI_API_KEY || "AIzaSyBDfUX_yBlU5qC6IT2YtQcY9eUWsRcUfuU";

        const configsToTry = [
          { apiVersion: "v1beta", modelName: "gemini-2.5-flash" },
          { apiVersion: "v1",     modelName: "gemini-2.5-flash" },
          { apiVersion: "v1beta", modelName: "gemini-1.5-flash" },
          { apiVersion: "v1",     modelName: "gemini-1.5-flash" },
        ];

        // Prepare parts array
        const parts: any[] = [];
        
        // Add files
        for (const file of catalogFiles) {
          if (file.data) {
            const cleanBase64 = file.data.replace(/^data:[^;]+;base64,/, "");
            parts.push({
              inlineData: {
                mimeType: file.mimeType || "image/jpeg",
                data: cleanBase64,
              }
            });
          }
        }

        let contentToAnalyze = pastedText || "";
        if (catalogUrl.trim()) {
          contentToAnalyze += `\n\nLink do catálogo: ${catalogUrl.trim()}`;
        }
        
        let combinedTextPrompt = promptText;
        if (contentToAnalyze.trim()) {
          combinedTextPrompt += `\n\nTexto adicional ou conteúdo do catálogo para analisar:\n${contentToAnalyze}`;
        }
        parts.push({ text: combinedTextPrompt });

        let successObj: any = null;
        let lastClientError: any = null;

        for (const config of configsToTry) {
          const { apiVersion, modelName } = config;
          try {
            console.log(`Trying direct browser extraction with ${apiVersion} and model: ${modelName}`);
            
            let response = await fetch(
              `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelName}:generateContent?key=${apiKey}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  contents: [
                    {
                      parts: parts,
                    },
                  ],
                  generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema: {
                      type: "OBJECT",
                      properties: {
                        products: {
                          type: "ARRAY",
                          items: {
                            type: "OBJECT",
                            properties: {
                              name: { type: "STRING" },
                              catalog_price: { type: "NUMBER" },
                              category_name: { type: "STRING" },
                              supplier_name: { type: "STRING" },
                              description: { type: "STRING" },
                            },
                            required: ["name", "catalog_price", "description"],
                          }
                        }
                      },
                      required: ["products"],
                    },
                  },
                }),
              }
            );

            if (!response.ok) {
              const errBody = await response.clone().text();
              if (errBody.includes("responseMimeType") || errBody.includes("responseSchema") || errBody.includes("generation_config")) {
                console.warn("Schema not supported by direct client integration. Retrying without generationConfig schema...");
                // Retry without schema
                const retryParts = [...parts];
                retryParts[retryParts.length - 1] = {
                  text: combinedTextPrompt + "\r\nImportante: Responda APENAS com o código JSON puro contendo { \"products\": [...] }, sem formatação markdown ou textos extras."
                };
                
                response = await fetch(
                  `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelName}:generateContent?key=${apiKey}`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      contents: [
                        {
                          parts: retryParts,
                        },
                      ],
                    }),
                  }
                );
              }
            }

            if (response.ok) {
              const apiResult = await response.json();
              const candidateText = apiResult?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (candidateText) {
                let textToParse = candidateText.trim();
                
                const jsonMatch = textToParse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                if (jsonMatch) {
                  textToParse = jsonMatch[1];
                }
                
                const firstBrace = textToParse.indexOf("{");
                const lastBrace = textToParse.lastIndexOf("}");
                if (firstBrace !== -1 && lastBrace !== -1) {
                  textToParse = textToParse.substring(firstBrace, lastBrace + 1);
                }

                const parsed = JSON.parse(textToParse);
                if (parsed && Array.isArray(parsed.products)) {
                  successObj = parsed;
                  break;
                }
              }
            } else {
              const errText = await response.text();
              throw new Error(`API Error (${response.status}): ${errText}`);
            }
          } catch (clientErr: any) {
            console.warn(`Browser fallback with ${modelName} failed:`, clientErr);
            lastClientError = clientErr;
          }
        }

        if (successObj && Array.isArray(successObj.products)) {
          data = { success: true, products: successObj.products };
        } else {
          throw lastClientError || new Error("Não foi possível processar o catálogo nem via servidor nem diretamente pelo navegador.");
        }
      }

      if (data.success && data.products) {
        setExtractedItems(data.products);
        if (data.products.length === 0) {
          setError("A IA analisou os dados, mas não localizou nenhum produto no catálogo/texto fornecido.");
        }
      } else {
        throw new Error(data.error || "Ocorreu uma falha inexplicada durante a extração.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Não foi possível conectar ao servidor de inteligência artificial.");
    } finally {
      setIsLoading(false);
      setProgressMsg("");
    }
  };

  // Helper calculation functions
  const calculatePricing = (catalogPrice: number) => {
    const cost = catalogPrice * (1 - discountPercent / 100);
    const profit = profitMode === "fixed" ? profitAmount : cost * (profitAmount / 100);
    const finalPrice = cost + profit;
    return {
      costReal: Math.round(cost * 100) / 100,
      profitDesired: Math.round(profit * 100) / 100,
      priceFinal: Math.round(finalPrice * 100) / 100,
    };
  };

  // Run the batch import loop
  const handleBatchImport = async () => {
    if (extractedItems.length === 0) return;

    setIsLoading(true);
    setError(null);
    setSuccessCount(null);

    let count = 0;
    try {
      for (const item of extractedItems) {
        const pricing = calculatePricing(item.catalog_price);
        
        // Find matched Category or use Default Category ID
        let catId = defaultCategoryId;
        if (item.category_name) {
          const matchedCat = categories.find(
            (c) => c.name.toLowerCase().includes(item.category_name!.toLowerCase()) ||
                   item.category_name!.toLowerCase().includes(c.name.toLowerCase())
          );
          if (matchedCat) catId = matchedCat.id;
        }

        // Find matched Supplier or use Default Supplier ID
        let supId = defaultSupplierId;
        if (item.supplier_name) {
          const matchedSup = suppliers.find(
            (s) => s.name.toLowerCase().includes(item.supplier_name!.toLowerCase()) ||
                   item.supplier_name!.toLowerCase().includes(s.name.toLowerCase())
          );
          if (matchedSup) supId = matchedSup.id;
        }

        setProgressMsg(`Salvando [${count + 1}/${extractedItems.length}]: ${item.name}...`);

        // Save using current onAddProduct loop callback securely
        await onAddProduct({
          name: item.name,
          category_id: catId,
          supplier_id: supId,
          price_full: item.catalog_price,
          discount_percent: discountPercent,
          profit_desired: pricing.profitDesired,
          cost_real: pricing.costReal,
          price_final: pricing.priceFinal,
          description: item.description,
          images: [], // No photo as requested
        });

        count++;
      }

      setSuccessCount(count);
      setExtractedItems([]);
      setCatalogUrl("");
      setPastedText("");
      setCatalogFiles([]);
    } catch (err: any) {
      console.error(err);
      setError(`Erro ao salvar após importar ${count} itens: ${err.message}`);
    } finally {
      setIsLoading(false);
      setProgressMsg("");
    }
  };

  // Remove individual row from extracted list
  const handleRemoveRow = (indexToRemove: number) => {
    setExtractedItems((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  return (
    <div 
      onPaste={handlePaste}
      className="space-y-5 bg-white border border-zinc-150 p-5 rounded-2xl shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all"
    >
      <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-650 animate-pulse" />
          <h3 className="font-bold text-zinc-900 text-base">Importação por PDF ou Imagem (IA)</h3>
        </div>
        <span className="text-[10px] bg-indigo-50 text-indigo-750 border border-indigo-150 py-0.5 px-2 rounded-full font-black uppercase tracking-wider flex items-center gap-1">
          📋 Ctrl + V Ativo
        </span>
      </div>

      <form onSubmit={handleExtract} className="space-y-4">
        {/* Visual drag & drop area */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-zinc-700 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-indigo-600" />
            Upload do Catálogo do Distribuidor (PDF / Imagens)
          </label>
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="border-2 border-dashed border-zinc-200 hover:border-indigo-500 rounded-xl p-6 text-center bg-zinc-50/50 hover:bg-zinc-50/90 cursor-pointer transition-all relative group/dropzone"
          >
            <input
              type="file"
              multiple
              accept="image/*,application/pdf"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <Upload className="w-6 h-6 text-zinc-400 mx-auto mb-2 group-hover/dropzone:scale-110 group-hover/dropzone:text-indigo-600 transition-transform" />
            <p className="text-xs font-bold text-zinc-700">Selecione o arquivo PDF do catálogo ou fotos</p>
            <p className="text-[10px] text-zinc-500 mt-1.5 leading-snug">
              Arraste os arquivos aqui, procure no dispositivo ou apenas copie uma imagem/print e aperte <kbd className="bg-zinc-200 border border-zinc-350 px-1.5 py-0.5 rounded text-zinc-800 font-sans font-black text-[9px] shadow-xs select-none">Ctrl + V</kbd> para colar diretamente!
            </p>
          </div>
        </div>

        {/* Selected files preview list */}
        {catalogFiles.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider block">
              Arquivos Selecionados ({catalogFiles.length})
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[160px] overflow-y-auto p-1.5 border border-zinc-100 rounded-lg bg-zinc-50">
              {catalogFiles.map((file, idx) => {
                const isPdf = file.mimeType === "application/pdf";
                return (
                  <div key={idx} className="relative aspect-[3/2] border border-zinc-250 rounded-lg overflow-hidden bg-white p-2 flex flex-col justify-between group">
                    {isPdf ? (
                      <div className="flex flex-col items-center justify-center flex-1 space-y-1">
                        <FileText className="w-6 h-6 text-red-650" />
                        <span className="text-[9px] font-bold text-zinc-650">DOCUMENTO PDF</span>
                      </div>
                    ) : (
                      <img
                        src={file.data}
                        alt={file.name}
                        className="w-full h-full object-cover rounded-md"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveUploadedFile(idx)}
                      className="absolute top-1 right-1 bg-zinc-900/85 hover:bg-zinc-950 text-white p-1 rounded-full shadow-md cursor-pointer transition-colors"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                    <span className="absolute bottom-1 inset-x-1 bg-zinc-950/80 text-[8px] text-white truncate px-1 text-center py-0.5 rounded">
                      {file.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Link / Text Accordion Optionals */}
        <div className="border border-zinc-150 rounded-xl overflow-hidden">
          <div className="bg-zinc-50 px-3 py-2 border-b border-zinc-150 flex items-center justify-between">
            <span className="text-[11px] font-black text-zinc-500 uppercase tracking-widest">
              Métodos Alternativos (Opcional)
            </span>
          </div>
          <div className="p-3 space-y-3 bg-white">
            <div className="space-y-1">
              <label className="block text-[10px] font-semibold text-zinc-650">Link do Catálogo (URL)</label>
              <input
                type="url"
                value={catalogUrl}
                onChange={(e) => setCatalogUrl(e.target.value)}
                placeholder="https://catalogo.com/tabela-pdf"
                className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg text-xs text-zinc-900 bg-zinc-50/50 focus:outline-indigo-505"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-semibold text-zinc-655">Ou Cole dados das tabelas</label>
              <textarea
                rows={2}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Nome do produto ... Preço"
                className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg text-xs text-zinc-900 bg-zinc-50/50 focus:outline-indigo-505 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Adjust prices inputs */}
        <div className="p-4 rounded-xl border border-zinc-150 bg-zinc-50/50 space-y-3.5">
          <h4 className="text-[11px] font-black uppercase text-zinc-500 tracking-wider flex items-center gap-1.5 border-b border-zinc-100 pb-1.5">
            <Percent className="w-4 h-4 text-indigo-650" />
            Configuração de Margem Financeira
          </h4>

          <div className="grid grid-cols-2 gap-3">
            {/* Discount over catalog list price */}
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-zinc-600 uppercase">
                Desconto Distribuidor (%)
              </label>
              <input
                type="number"
                min="0"
                max="95"
                value={discountPercent || ""}
                onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
                placeholder="Exemplo: 30"
                className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg text-xs text-zinc-900 bg-white focus:outline-indigo-500"
              />
              <span className="text-[9px] text-zinc-400 block block">Calcula custo de compra real</span>
            </div>

            {/* Profit target */}
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-zinc-600 uppercase">
                Lucro Adicionado
              </label>
              <div className="flex gap-1.5">
                <input
                  type="number"
                  min="0"
                  value={profitAmount || ""}
                  onChange={(e) => setProfitAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg text-xs text-zinc-900 bg-white focus:outline-indigo-500 font-semibold"
                />
                <select
                  value={profitMode}
                  onChange={(e) => setProfitMode(e.target.value as "fixed" | "percent")}
                  className="bg-white border border-zinc-200 p-1.5 rounded-lg text-[10px] font-medium text-zinc-800"
                >
                  <option value="percent">% Custo</option>
                  <option value="fixed">R$ Fixo</option>
                </select>
              </div>
              <span className="text-[9px] text-zinc-400 block">Soma margem sobre o custo</span>
            </div>
          </div>
        </div>

        {/* Fallback Defaults */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-zinc-700">Categoria Geral</label>
            <select
              value={defaultCategoryId}
              onChange={(e) => setDefaultCategoryId(e.target.value)}
              className="w-full px-2.5 py-2 border border-zinc-200 rounded-lg text-xs text-zinc-900 bg-zinc-50/50 focus:outline-indigo-500"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-zinc-700">Fornecedor Geral</label>
            <select
              value={defaultSupplierId}
              onChange={(e) => setDefaultSupplierId(e.target.value)}
              className="w-full px-2.5 py-2 border border-zinc-200 rounded-lg text-xs text-zinc-900 bg-zinc-50/50 focus:outline-indigo-500"
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Extract Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full cursor-pointer bg-indigo-650 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all"
        >
          <Sparkles className="w-4 h-4 text-amber-300" />
          {isLoading ? "Processando..." : "Analisar e Extrair de Catálogo / PDF"}
        </button>
      </form>

      {/* Progress / Status feedback blocks */}
      {progressMsg && (
        <div className="flex items-center text-xs text-indigo-700 font-medium bg-indigo-50 p-3 rounded-xl border border-indigo-100 text-left">
          <Spinner />
          <span>{progressMsg}</span>
        </div>
      )}

      {error && (
        <div className="text-xs text-red-650 bg-red-50 p-3 rounded-xl border border-red-100 font-medium flex gap-2 text-left">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {successCount !== null && (
        <div className="text-xs text-emerald-700 bg-emerald-50 p-3.5 rounded-xl border border-emerald-100 font-bold flex gap-2 animate-bounce text-left">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
          <span>Sucesso! Importação em massa PDF finalizada com {successCount} itens sem fotos!</span>
        </div>
      )}

      {/* PREVIEW CONTAINER GRID OF EXTRACTED ITEMS */}
      {extractedItems.length > 0 && (
        <div className="space-y-3.5 border-t border-zinc-100 pt-5 animate-fade-in">
          <div className="flex justify-between items-center bg-zinc-50 p-2.5 rounded-xl border border-zinc-150">
            <div>
              <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Produtos Extraídos</span>
              <h4 className="font-bold text-zinc-800 text-xs text-left">Foram encontrados {extractedItems.length} móveis</h4>
            </div>
            <button
              onClick={handleBatchImport}
              disabled={isLoading}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] uppercase rounded-lg shadow-sm cursor-pointer"
            >
              Confirmar Importar Todos ({extractedItems.length})
            </button>
          </div>

          <div className="max-h-[350px] overflow-y-auto space-y-2.5 pr-1">
            {extractedItems.map((item, index) => {
              const pricing = calculatePricing(item.catalog_price);
              return (
                <div
                  key={index}
                  className="bg-zinc-50 hover:bg-zinc-100 border border-zinc-200/80 p-3 rounded-xl text-xs relative group flex flex-col gap-1.5"
                >
                  <button
                    onClick={() => handleRemoveRow(index)}
                    className="absolute top-2.5 right-2.5 text-zinc-400 hover:text-red-700 cursor-pointer"
                    title="Remover este item dos extraídos"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="pr-6 text-left">
                    <span className="text-[9px] font-black uppercase tracking-wider text-indigo-700">
                      [{item.category_name || "Categoria Padrão"}] de [{item.supplier_name || "Fornecedor Padrão"}]
                    </span>
                    <h5 className="font-bold text-zinc-900 leading-snug">{item.name}</h5>
                    <p className="text-[10px] text-zinc-500 leading-relaxed mt-1 font-sans italic">
                      {item.description}
                    </p>
                  </div>

                  {/* Financial computations row */}
                  <div className="grid grid-cols-3 gap-2 border-t border-dashed border-zinc-200/80 pt-2 text-[10px] font-sans">
                    <div className="text-left">
                      <span className="text-zinc-400 block">Preço Catálogo:</span>
                      <strong className="text-zinc-650">R$ {item.catalog_price.toFixed(2)}</strong>
                    </div>
                    <div className="text-left">
                      <span className="text-zinc-400 block">Custo Real ({discountPercent}%):</span>
                      <strong className="text-zinc-700">R$ {pricing.costReal.toFixed(2)}</strong>
                    </div>
                    <div className="text-left">
                      <span className="text-amber-500 block font-bold">Venda Final (+ Lucro):</span>
                      <strong className="text-zinc-900 text-xs font-black">R$ {pricing.priceFinal.toFixed(2)}</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
