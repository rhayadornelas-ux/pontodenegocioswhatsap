import React, { useState, useEffect } from "react";
import { Sparkles, Image as ImageIcon, Plus } from "lucide-react";
import { compressImage } from "../lib/imageCompressor";
import { Category, Supplier, Product } from "../types";

// Custom loader icon replacement using default icons or css animations
function Spinner() {
  return (
    <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin inline-block mr-2" />
  );
}

interface AddProductFormProps {
  categories: Category[];
  suppliers: Supplier[];
  onAddProduct: (product: Omit<Product, "id">) => void;
}

export default function AddProductForm({
  categories,
  suppliers,
  onAddProduct,
}: AddProductFormProps) {
  // Main form states
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  
  // Pricing states
  const [priceFull, setPriceFull] = useState<number>(0);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [profitDesired, setProfitDesired] = useState<number>(0);

  // Directly calculate computed values in render phase for speed, correctness, and instant syncing
  const costReal = priceFull * (1 - discountPercent / 100);
  const priceFinal = costReal + profitDesired;

  const [description, setDescription] = useState("");
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  
  // AI Autofill states
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuccessMsg, setAiSuccessMsg] = useState<string | null>(null);

  // Handle setting default Category & Supplier when they load
  useEffect(() => {
    if (categories.length > 0 && !categoryId) {
      setCategoryId(categories[0].id);
    }
    if (suppliers.length > 0 && !supplierId) {
      setSupplierId(suppliers[0].id);
    }
  }, [categories, suppliers]);

  // Handle manual product photos upload (can select multiple)
  const handlePhotosSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        setSelectedPhotos((prev) => [...prev, ...compressed]);
      });
    }
  };

  // Triggers the Gemini catalog scanning API with robust backend proxy first, falling back to client-side direct calls for static-only hosting like Netlify
  const processImageForAutofill = async (file: File) => {
    setIsAiLoading(true);
    setAiError(null);
    setAiSuccessMsg(null);

    try {
      const base64Image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(file);
      });

      // Clean base64 data URI scheme
      const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");
      const mimeType = file.type || "image/png";

      let parsedData: any = null;
      let lastError = "";

      // 1. Attempt server-side Node.js proxy first (highly secure, protects API Keys)
      try {
        console.log("Attempting server-side catalog autofill proxy...");
        const response = await fetch("/api/catalog/autofill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            base64Image: base64Image,
            mimeType: mimeType,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          if (result && result.success && result.data) {
            parsedData = result.data;
            console.log("Completed successfully via backend proxy.");
          } else if (result && result.error) {
            console.warn("Backend proxy returned api error details:", result.error);
            lastError = result.error;
          }
        } else {
          lastError = `Status ${response.status}: ${await response.text()}`;
          console.warn("Backend proxy could not be resolved or returned non-200 state:", lastError);
        }
      } catch (proxyErr: any) {
        lastError = proxyErr.message || String(proxyErr);
        console.warn("Express server proxy unavailable (expected on client-side static hosting platforms like Netlify):", proxyErr);
      }

      // 2. If the backend proxy was unavailable or failed (e.g., Netlify hosting), fall back to client-side direct fetch
      if (!parsedData) {
        console.log("Server proxy unsuccessful. Invoking direct browser fallback to Google Gemini REST endpoints...");
        
        // Prompt and schema for standard REST API format
        const promptText = `A partir do recorte de catálogo, folheto ou foto enviada do produto, identifique ou gere o preenchimento ideal:
1. 'name': Nome comercial exato ou deduzido do móvel/produto (Exemplo: "Guarda-Roupa Casal 6 Portas").
2. 'price': Preço de venda numérico original cheio em R$. Se houver apenas uma parcela, calcule o total. Se não houver preço legível, retorne 0 ou o valor mais aproximado.
3. 'category': Escolha uma das categorias brasileiras comuns de móveis, preferindo "Armários", "Guarda Roupas", "Mesas", "Comodas", ou "Rack Home e Painel".
4. 'supplier': Fabricante ou fornecedor que aparece na foto (Baião, Balcão, Jr Colchões, ou semelhante), caso não tenha coloque "Nenhum".
5. 'description': Crie uma descrição comercial limpa, clara e profissional. Não use estilo do Instagram, hashtags ou excesso de emojis. Apresente as principais especificações técnicas, dimensões originais ou estimadas de forma limpa e características essenciais destacadas em tópicos organizados. Inclua obrigatoriamente a frase: "Entrega ultra rápida" no final da descrição.

Sempre responda no formato JSON solicitado contendo todos esses campos de forma concisa.`;

        const storedApiKey = localStorage.getItem("user_gemini_api_key");
        const apiKey = storedApiKey || (import.meta as any).env?.VITE_GEMINI_API_KEY || "AIzaSyBDfUX_yBlU5qC6IT2YtQcY9eUWsRcUfuU";

        // Iteratively try stable public REST-supported models and different API versions for client-side fallback
        const configsToTry = [
          { apiVersion: "v1beta", modelName: "gemini-2.5-flash" },
          { apiVersion: "v1",     modelName: "gemini-2.5-flash" },
          { apiVersion: "v1beta", modelName: "gemini-1.5-flash" },
          { apiVersion: "v1",     modelName: "gemini-1.5-flash" },
        ];
        
        for (const config of configsToTry) {
          const { apiVersion, modelName } = config;
          try {
            console.log(`Trying client-side direct request with ${apiVersion} and model: ${modelName}`);
            
            // First attempt with response schema
            let response = await fetch(
              `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelName}:generateContent?key=${apiKey}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  contents: [
                    {
                      parts: [
                        { text: promptText },
                        {
                          inlineData: {
                            mimeType: mimeType,
                            data: cleanBase64,
                          },
                        },
                      ],
                    },
                  ],
                  generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema: {
                      type: "OBJECT",
                      properties: {
                        name: { type: "STRING" },
                        price: { type: "NUMBER" },
                        category: { type: "STRING" },
                        supplier: { type: "STRING" },
                        description: { type: "STRING" },
                      },
                      required: ["name", "price", "category", "description"],
                    },
                  },
                }),
              }
            );

            // If we got a 400 Bad Request alleging "responseMimeType" or "generation_config", retry WITHOUT structured schema
            if (!response.ok) {
              const errBody = await response.clone().text();
              if (errBody.includes("responseMimeType") || errBody.includes("responseSchema") || errBody.includes("generation_config")) {
                console.warn("Schema not supported by API Key/version. Retrying without generationConfig...");
                response = await fetch(
                  `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelName}:generateContent?key=${apiKey}`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      contents: [
                        {
                          parts: [
                            { text: promptText + "\r\nImportante: Responda APENAS com o código JSON puro, sem formatação markdown ou textos extras." },
                            {
                              inlineData: {
                                mimeType: mimeType,
                                data: cleanBase64,
                              },
                            },
                          ],
                        },
                      ],
                    }),
                  }
                );
              }
            }

            if (response.ok) {
              const result = await response.json();
              const candidateText = result?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (candidateText) {
                // Parse manually with robust fallback for codeblocks
                let textToParse = candidateText.trim();
                
                // If it contains ```json codeblocks, pull them out
                const jsonMatch = textToParse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                if (jsonMatch) {
                  textToParse = jsonMatch[1];
                }
                
                // Fine-tune parsing by searching for first { and last }
                const firstBrace = textToParse.indexOf("{");
                const lastBrace = textToParse.lastIndexOf("}");
                if (firstBrace !== -1 && lastBrace !== -1) {
                  textToParse = textToParse.substring(firstBrace, lastBrace + 1);
                }

                parsedData = JSON.parse(textToParse.trim());
                console.log(`Success processing image with client-side fallback model ${modelName} over ${apiVersion}`);
                break; // Found successful data, break execution loop!
              }
            } else {
              const errorText = await response.text();
              console.warn(`Direct Gemini API failed with ${apiVersion}/${modelName}:`, errorText);
              lastError = errorText;

              // Fail fast on quota limits or invalid keys to prevent masking errors
              if (response.status === 429) {
                throw new Error("Limite de cota excedido (Erro 429) no Google Gemini. Por favor, aguarde cerca de 1 minuto antes de tentar novamente ou configure sua própria chave de API no painel do aplicativo.");
              }
              if (response.status === 403) {
                throw new Error("Chave da API do Gemini inválida ou sem permissão de acesso (Erro 403). Por favor, verifique a chave configurada.");
              }
            }
          } catch (modelErr: any) {
            console.warn(`Direct fetch model ${modelName} on ${apiVersion} encountered error:`, modelErr);
            // If it's one of our thrown custom error messages, rethrow it to stop the loop
            if (modelErr.message && (modelErr.message.includes("429") || modelErr.message.includes("403"))) {
              throw modelErr;
            }
            lastError = modelErr.message || String(modelErr);
          }
        }
      }

      if (!parsedData) {
        let helpTip = "Verifique se a sua chave da API (VITE_GEMINI_API_KEY) foi adicionada corretamente.";
        if (lastError.includes("not found for API version") || lastError.includes("API key") || lastError.includes("API_KEY") || lastError.includes("NOT_FOUND")) {
          helpTip = "Isso ocorre porque a chave da API padrão expirou ou é inválida. Se você está usando o Netlify, você PRECISA definir a variável de ambiente VITE_GEMINI_API_KEY com sua própria chave de API gratuita do Google AI Studio nas configurações do Netlify (Site Settings -> Environment Variables) e realizar um novo deploy.";
        }
        throw new Error(
          `A Inteligência Artificial não pôde ler a imagem: ${helpTip} [Erro: ${lastError}]`
        );
      }

      const { name, price, category, supplier, description } = parsedData;

      // Autofill fields nicely
      if (name) setName(name);
      if (price) {
        setPriceFull(Number(price));
        setProfitDesired(Math.round(Number(price) * 0.25)); // Default 25% target profit
      }
      if (description) setDescription(description);

      // Match category
      if (category) {
        const foundCat = categories.find(
          (c) => c.name.toLowerCase().includes(category.toLowerCase()) || 
                 category.toLowerCase().includes(c.name.toLowerCase())
        );
        if (foundCat) {
          setCategoryId(foundCat.id);
        } else {
          // Put the original raw parsed category or default
          setCategoryId(categories[0]?.id || "");
        }
      }

      // Match supplier
      if (supplier && supplier.toLowerCase() !== "nenhum") {
        const foundSup = suppliers.find(
          (s) => s.name.toLowerCase().includes(supplier.toLowerCase()) || 
                 supplier.toLowerCase().includes(s.name.toLowerCase())
        );
        if (foundSup) setSupplierId(foundSup.id);
      }

      // Auto add the scanned image as a product photo
      setSelectedPhotos((prev) => [...prev, base64Image]);

      setAiSuccessMsg("Dados extraídos com sucesso via Inteligência Artificial!");
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || "Erro de conexão ao servidor de IA.");
    } finally {
      setIsAiLoading(false);
    }
  };

  // Upload catalogo file input handler
  const handleCatalogUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processImageForAutofill(e.target.files[0]);
    }
  };

  // Document-wide paste (Ctrl+V) handler for convenience
  useEffect(() => {
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
                // Add photo instantly so it shows in the list
                setSelectedPhotos((prev) => {
                  if (prev.includes(compressed)) return prev;
                  return [...prev, compressed];
                });
                
                // If they have not typed a title yet, run AI to autofill details
                if (!name.trim()) {
                  processImageForAutofill(file);
                }
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
  }, [categories, suppliers, name]);

  // Form submit
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onAddProduct({
      name: name.trim(),
      category_id: categoryId,
      supplier_id: supplierId,
      price_full: priceFull,
      discount_percent: discountPercent,
      profit_desired: profitDesired,
      cost_real: costReal,
      price_final: priceFinal,
      description: description.trim(),
      images: selectedPhotos,
    });

    // Reset fields
    setName("");
    setPriceFull(0);
    setDiscountPercent(0);
    setProfitDesired(0);
    setDescription("");
    setSelectedPhotos([]);
    setAiSuccessMsg(null);
  };

  return (
    <form onSubmit={handleSave} className="space-y-5 bg-white border border-zinc-150 p-5 rounded-2xl shadow-sm">
      <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
        <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse" />
        <h3 className="font-bold text-zinc-900 text-base">Adicionar Produto</h3>
      </div>

      {/* AI CATALOG AUTOFILL WORKFLOW BOX */}
      <div className="bg-gradient-to-br from-indigo-50/70 to-blue-50/50 hover:from-indigo-50 hover:to-blue-50 border border-indigo-100 p-4 rounded-xl relative overflow-hidden transition-all">
        <div className="flex items-start gap-2.5">
          <Sparkles className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-semibold text-xs text-indigo-950 flex items-center gap-1">
              Preenchimento Automático (Catálogo)
            </h4>
            <p className="text-[11px] leading-relaxed text-indigo-800">
              Cole [Ctrl+V] em qualquer lugar da tela ou selecione a foto do catálogo para ler descrição, nome e preço via IA.
            </p>
          </div>
        </div>

        {/* Action Button & Loader */}
        <div className="mt-3.5">
          <label className="inline-flex items-center px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-lg shadow-sm transition-colors cursor-pointer select-none">
            <ImageIcon className="w-3.5 h-3.5 mr-1.5" />
            {isAiLoading ? "Analisando Catálogo..." : "Selecionar Foto do Catálogo"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleCatalogUpload}
              disabled={isAiLoading}
            />
          </label>
        </div>

        {isAiLoading && (
          <div className="mt-2.5 flex items-center text-xs text-indigo-700 font-medium bg-white/60 p-2 rounded-lg">
            <Spinner />
            <span>Lendo panfleto com Gemini 3.5...</span>
          </div>
        )}

        {aiError && (
          <div className="mt-2.5 text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-100 font-medium">
            ⚠️ {aiError}
          </div>
        )}

        {aiSuccessMsg && (
          <div className="mt-2.5 text-xs text-emerald-700 bg-emerald-50 p-2.5 rounded-lg border border-emerald-100 font-medium animate-pulse">
            ✨ {aiSuccessMsg}
          </div>
        )}
      </div>

      {/* Nome do Produto */}
      <div className="space-y-1">
        <label className="block text-xs font-semibold text-zinc-700">Nome do Produto</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Cozinha 4 Peças Cristal"
          required
          className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-indigo-500 bg-zinc-50/50"
        />
      </div>

      {/* Categoria & Fornecedor */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-zinc-700">Categoria</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm text-zinc-900 bg-zinc-50/50 focus:outline-indigo-500"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-semibold text-zinc-700">Fornecedor Interno</label>
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm text-zinc-900 bg-zinc-50/50 focus:outline-indigo-500"
          >
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Precificação Panel block */}
      <div className="border border-zinc-150 p-4 rounded-xl bg-zinc-50/50 space-y-4">
        <h4 className="text-xs font-bold text-zinc-900 tracking-wide uppercase border-b border-zinc-100 pb-1">
          Precificação
        </h4>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="block text-[11px] font-semibold text-zinc-600">Preço Cheio [R$]</label>
            <input
              type="number"
              step="0.01"
              value={priceFull || ""}
              onChange={(e) => setPriceFull(parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg text-xs text-zinc-900 focus:outline-indigo-500 bg-white"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-semibold text-zinc-600">Desconto [%]</label>
            <input
              type="number"
              min="0"
              max="100"
              value={discountPercent || ""}
              onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
              placeholder="0"
              className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg text-xs text-zinc-900 focus:outline-indigo-500 bg-white"
            />
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="block text-[11px] font-semibold text-zinc-600">Lucro Desejado [R$]</label>
            <span className="text-[10px] text-zinc-500 font-medium">
              Custo Real: <strong className="text-zinc-800">R$ {costReal.toFixed(2)}</strong>
            </span>
          </div>
          <input
            type="number"
            step="0.01"
            value={profitDesired || ""}
            onChange={(e) => setProfitDesired(parseFloat(e.target.value) || 0)}
            placeholder="0.00"
            className="w-full px-3 py-1.5 border border-emerald-200 rounded-lg text-xs text-zinc-900 focus:outline-emerald-500 bg-emerald-50/40 font-medium"
          />
        </div>

        {/* Preço Final box */}
        <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3.5 space-y-2.5">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-indigo-950">Preço de Venda Final (Editável)</span>
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

      {/* Descrição */}
      <div className="space-y-1">
        <label className="block text-xs font-semibold text-zinc-700">Descrição</label>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Características, dimensões, portas, gavetas..."
          className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-indigo-500 bg-zinc-50/50"
        />
      </div>

      {/* Fotos do Produto */}
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold text-zinc-700">
          Fotos do Produto (Selecione Várias)
        </label>
        
        {/* Photo Selection Grid */}
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedPhotos.map((photo, i) => (
            <div key={i} className="relative w-12 h-12 rounded bg-zinc-100 border border-zinc-200 overflow-hidden flex items-center justify-center">
              <img src={photo} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => setSelectedPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold cursor-pointer hover:bg-red-600 shadow-sm"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        {/* Picker Trigger */}
        <label className="block border border-dashed border-zinc-300 rounded-xl p-6 text-center cursor-pointer hover:bg-zinc-50/50 transition-all">
          <div className="flex flex-col items-center gap-1">
            <ImageIcon className="w-6 h-6 text-zinc-400" />
            <span className="text-xs font-semibold text-zinc-700">Clique para selecionar múltiplas fotos</span>
            <span className="text-[10px] text-zinc-400">Arraste fotos ou clique aqui</span>
          </div>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handlePhotosSelect}
            className="hidden"
          />
        </label>
      </div>

      {/* Salvar Produto Button */}
      <button
        type="submit"
        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl cursor-pointer transition-all active:scale-[0.99] flex items-center justify-center gap-2"
      >
        <Plus className="w-4 h-4" />
        Salvar Produto
      </button>
    </form>
  );
}
