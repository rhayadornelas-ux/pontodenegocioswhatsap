import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Set high limits to accept product photos in base64 format without issue.
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ limit: "15mb", extended: true }));

// Retrieve Gemini client lazily
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY || "AIzaSyBDfUX_yBlU5qC6IT2YtQcY9eUWsRcUfuU";
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
};

// API Endpoint to process catalog print scanning
app.post("/api/catalog/autofill", async (req, res) => {
  try {
    const { base64Image, mimeType } = req.body;
    if (!base64Image) {
      return res.status(400).json({ error: "Imagem base64 obrigatória para preenchimento." });
    }

    const ai = getGeminiClient();

    // Clean data URI scheme if provided by browser FileReader
    const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");

    const promptText = `A partir do recorte de catálogo, folheto ou foto enviada do produto, identifique ou gere o preenchimento ideal:
1. 'name': Nome comercial exato ou deduzido do móvel/produto (Exemplo: "Guarda-Roupa Casal 6 Portas").
2. 'price': Preço de venda numérico original cheio em R$. Se houver apenas uma parcela, calcule o total. Se não houver preço legível, retorne 0 ou o valor mais aproximado.
3. 'category': Escolha uma das categorias brasileiras comuns de móveis, preferindo "Armários", "Guarda Roupas", "Mesas", "Comodas", ou "Rack Home e Painel".
4. 'supplier': Fabricante ou fornecedor que aparece na foto (Baião, Balcão, Jr Colchões, ou semelhante), caso não tenha coloque "Nenhum".
5. 'description': Crie uma descrição comercial limpa, clara e profissional. Não use estilo do Instagram, hashtags ou excesso de emojis. Apresente as principais especificações técnicas, dimensões originais ou estimadas de forma limpa e características essenciais destacadas em tópicos organizados. Inclua obrigatoriamente a frase: "Entrega ultra rápida" no final da descrição.

Sempre responda no formato JSON solicitado contendo todos esses campos de forma concisa.`;

    const modelsToTry = ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-1.5-flash"];
    let response = null;
    let lastError: any = null;

    for (const model of modelsToTry) {
      try {
        console.log(`Server attempting image scan with model: ${model}`);
        response = await ai.models.generateContent({
          model,
          contents: [
            {
              inlineData: {
                data: cleanBase64,
                mimeType: mimeType || "image/png",
              },
            },
            promptText,
          ],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                price: { type: Type.NUMBER },
                category: { type: Type.STRING },
                supplier: { type: Type.STRING },
                description: { type: Type.STRING },
              },
              required: ["name", "price", "category", "description"],
            },
          },
        });
        if (response && response.text) {
          console.log(`Server succeeded with model ${model}`);
          break;
        }
      } catch (err: any) {
        console.warn(`Server side attempt with model ${model} failed:`, err);
        lastError = err;
      }
    }

    if (!response || !response.text) {
      throw lastError || new Error("Nenhum texto pôde ser analisado na imagem.");
    }

    const resultText = response.text;
    if (!resultText) {
      throw new Error("Nenhum texto pôde ser analisado na imagem pelo modelo da Inteligência Artificial.");
    }

    const parsedData = JSON.parse(resultText.trim());
    return res.json({ success: true, data: parsedData });
  } catch (error: any) {
    console.error("Autofill processing failed:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Erro desconhecido ao processar preenchimento guiado por IA.",
    });
  }
});

// Endpoint to read measurement schematics/images and auto update the commercial description
app.post("/api/catalog/extract-measurements", async (req, res) => {
  try {
    const { base64Image, mimeType, currentDescription } = req.body;
    if (!base64Image) {
      return res.status(400).json({ error: "Imagem de medidas é obrigatória." });
    }

    const ai = getGeminiClient();

    // Clean data URI scheme
    const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");

    const promptText = `Analise a foto, desenho técnico, bloco de dimensões ou manual enviado de um móvel.
Sua missão é extrair com precisão absoluta as medidas descritas ou desenhadas e fornecer duas saídas no JSON estruturado:
1. 'measurements': Um resumo simples contendo apenas as dimensões encontradas (Exemplo: "Altura: 2,18 m | Largura: 2,30 m | Profundidade: 52 cm" ou semelhante).
2. 'updated_description': A descrição profissional atualizada do produto. Integre as Novas Medidas extraídas na Descrição Original fornecida abaixo. Organize por tópicos, mantenha as características benéficas comerciais originais limpas (sem excesso de hashtags ou estilo poluído) e certifique-se de que a frase: "Entrega ultra rápida" esteja mantida em uma linha limpa no final da descrição.

Descrição Original do Produto:\n${currentDescription || ""}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          inlineData: {
            data: cleanBase64,
            mimeType: mimeType || "image/png",
          },
        },
        promptText,
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            measurements: { type: Type.STRING },
            updated_description: { type: Type.STRING },
          },
          required: ["measurements", "updated_description"],
        },
      },
    });

    if (!response || !response.text) {
      throw new Error("Não foi possível extrair medidas da imagem enviada.");
    }

    const parsedData = JSON.parse(response.text.trim());
    return res.json({ success: true, ...parsedData });
  } catch (error: any) {
    console.error("Extract measurements failed:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Erro desconhecido ao ler imagem e extrair medidas técnicas.",
    });
  }
});

// Endpoint to process bulk catalog extraction by URL, Copied Text, PDF, or Catalog Images
app.post("/api/catalog/bulk-extract", async (req, res) => {
  try {
    const { url, pastedText, categoriesList, suppliersList, images, files } = req.body;
    let contentToAnalyze = pastedText || "";

    if (url && url.startsWith("http")) {
      try {
        console.log(`Searching/fetching HTML content from: ${url}`);
        const fetchRes = await fetch(url, {
          headers: {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          },
          signal: AbortSignal.timeout(6000)
        });

        if (fetchRes.ok) {
          const rawHtml = await fetchRes.text();
          let cleanText = rawHtml
            .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, "")
            .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();

          if (cleanText.length > 30000) {
            cleanText = cleanText.substring(0, 30000);
          }

          if (cleanText.length > 50) {
            contentToAnalyze += `\n\n[CONTEÚDO EXTRAÍDO DA URL DO CATÁLOGO]:\n${cleanText}`;
          }
        }
      } catch (e: any) {
        console.warn(`Could not fetch URL directly: ${e.message}`);
      }
    }

    const inputFiles = files || images || [];
    const hasFiles = Array.isArray(inputFiles) && inputFiles.length > 0;

    if (!contentToAnalyze.trim() && !hasFiles) {
      return res.status(400).json({ error: "Por favor, envie um arquivo PDF, fotos de folhetos, cole o texto do catálogo ou insira um link." });
    }

    const ai = getGeminiClient();

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

    // Construct the parts array for the Gemini API call
    const parts: any[] = [];

    // Add base64 files if present
    if (hasFiles) {
      for (const file of inputFiles) {
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
    }

    // Add text contents part
    let combinedTextPrompt = promptText;
    if (contentToAnalyze.trim()) {
      combinedTextPrompt += `\n\nTexto adicional ou conteúdo HTML do catálogo para analisar:\n${contentToAnalyze}`;
    }
    parts.push({ text: combinedTextPrompt });

    console.log(`Sending bulk extraction request to Gemini with ${hasFiles ? inputFiles.length : 0} file(s)...`);
    
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            products: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  catalog_price: { type: Type.NUMBER },
                  category_name: { type: Type.STRING },
                  supplier_name: { type: Type.STRING },
                  description: { type: Type.STRING },
                },
                required: ["name", "catalog_price", "description"],
              }
            }
          },
          required: ["products"],
        }
      }
    });

    if (!response || !response.text) {
      throw new Error("Não foi possível processar o catálogo do distribuidor.");
    }

    const result = JSON.parse(response.text.trim());
    return res.json({ success: true, products: result.products || [] });
  } catch (err: any) {
    console.error("Bulk extraction failed:", err);
    return res.status(500).json({ success: false, error: err.message || "Erro desconhecido ao ler catálogo." });
  }
});

// Setup dev server with Vite proxy and static production serving
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
}

setupServer().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server full-stack rodando em http://0.0.0.0:${PORT}`);
  });
});
