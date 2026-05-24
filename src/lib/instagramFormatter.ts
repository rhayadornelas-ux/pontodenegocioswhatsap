/**
 * Formats a description into a charming Instagram-style display template,
 * highlighting details, security info, and fast delivery, but avoiding redundant prices and CTAs.
 */
export function formatToInstagramStyle(name: string, descriptionText: string): string {
  let sourceText = (descriptionText || "").trim();

  // If already formatted, extract just the middle body (DETALHES DO PRODUTO)
  if (sourceText.includes("DETALHES DO PRODUTO")) {
    const markerText = sourceText.includes("📋 **DETALHES DO PRODUTO:**") 
      ? "📋 **DETALHES DO PRODUTO:**" 
      : "DETALHES DO PRODUTO:";
    const startIdx = sourceText.indexOf(markerText);
    if (startIdx !== -1) {
      let sub = sourceText.substring(startIdx + markerText.length).trim();
      const delimiterIndex = sub.indexOf("━━━━━");
      if (delimiterIndex !== -1) {
        sub = sub.substring(0, delimiterIndex).trim();
      } else {
        // Look specifically for the safety block header instead of any generic '🚨' emoji
        const upperSub = sub.toUpperCase();
        const securityHeaderIdx = upperSub.indexOf("MÁXIMA SEGURANÇA");
        const securityHeaderIdx2 = upperSub.indexOf("MAXIMA SEGURANCA");
        let safetyIdx = -1;
        if (securityHeaderIdx !== -1) {
          safetyIdx = securityHeaderIdx;
        } else if (securityHeaderIdx2 !== -1) {
          safetyIdx = securityHeaderIdx2;
        }

        if (safetyIdx !== -1) {
          let slicePoint = safetyIdx;
          const beforeSec = sub.substring(0, safetyIdx);
          const lastNewLine = beforeSec.lastIndexOf("\n");
          if (lastNewLine !== -1) {
            slicePoint = lastNewLine;
          }
          sub = sub.substring(0, slicePoint).trim();
        }
      }
      sourceText = sub;
    }
  }

  // Pre-process sourceText to insert newlines before tech specs that might be glued together
  const joinedKeywords = [
    "Especificações Técnicas:",
    "Especificacoes Tecnicas:",
    "Altura:",
    "Largura:",
    "Profundidade:",
    "Portas:",
    "Gavetas:",
    "Características:",
    "Caracteristicas:",
    "Medidas:",
    "Dimensões:",
    "Dimensoes:",
    "Comprimento:"
  ];

  for (const keyword of joinedKeywords) {
    const regex = new RegExp(`([^\\n])(${keyword})`, "gi");
    sourceText = sourceText.replace(regex, "$1\n$2");
  }

  // Split into lines
  const lines = sourceText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Filter out any template noise if they somehow leaked through
  const filteredLines = lines.filter((line) => {
    const lower = line.toLowerCase().trim();
    
    // Protect long informational product sentences from being filtered out 
    if (lower.length > 100) {
      return true;
    }

    // Skip template headers/footers only if they are short copy matches
    if (
      lower === "quer renovar sua casa" ||
      lower.includes("quer renovar sua casa com") ||
      lower.includes("esse móvel é a escolha perfeita") ||
      lower.includes("peças com acabamento refinado") ||
      lower.includes("máxima segurança e confiança") ||
      lower === "máxima segurança" ||
      lower === "maxima seguranca" ||
      lower.includes("sem sinal ou pagamento") ||
      lower.includes("você só realiza o pagamento") ||
      lower.includes("voce so realiza o pagamento") ||
      lower === "entrega ultra rápida." ||
      lower === "entrega ultra rapida." ||
      lower === "entrega ultra rápida" ||
      lower === "entrega ultra rapida" ||
      lower.includes("entrega ultra rápida para seu") ||
      lower.includes("valor especial") ||
      lower.includes("apenas r$") ||
      lower.includes("ou parcelado") ||
      lower.includes("como garantir o seu") ||
      lower.includes("entre em contato") ||
      lower.includes("━━━━━━━━━━━━") ||
      lower.includes("━━━━━")
    ) {
      return false;
    }
    return true;
  });

  const formattedName = name.trim().toUpperCase();

  let mainDescription = "";
  if (filteredLines.length > 0) {
    mainDescription = filteredLines
      .map((line) => {
        // Strip emojis or bullet points at the beginning of the line to reapply them appropriately
        let cleanLine = line.replace(/^[\s✨🚨📐🚚🏢🛋️📋💰👉📲•\-\*👑📍✅🌟⚡️🔹💎🎯✔️]+/, "").trim();
        if (!cleanLine) return null;

        const lower = cleanLine.toLowerCase();
        // Check for dimensions/measurements
        if (
          lower.includes("altura") ||
          lower.includes("alt") ||
          lower.includes("larg") ||
          lower.includes("deep") ||
          lower.includes("prof") ||
          lower.includes("compr") ||
          lower.includes("dimens") ||
          lower.includes("medid") ||
          lower.includes("cm") ||
          lower.includes(" metros") ||
          /\b\d+\s*x\s*\d+\b/.test(lower)
        ) {
          return `📐 ${cleanLine}`;
        }
        // Check for brand/supplier
        if (
          lower.includes("marca") ||
          lower.includes("fabric") ||
          lower.includes("forneced")
        ) {
          return `🏢 ${cleanLine}`;
        }
        // Check for delivery/speed
        if (
          lower.includes("entrega") ||
          lower.includes("rápid") ||
          lower.includes("rapid")
        ) {
          return `🚚 ${cleanLine}`;
        }
        // Default bulletpoint emoji
        return `✨ ${cleanLine}`;
      })
      .filter((l) => l !== null)
      .join("\n");
  }

  if (!mainDescription.trim()) {
    mainDescription =
      "✨ Lindo móvel com design exclusivo e acabamento de altíssima qualidade!\n✨ Perfeito para agregar beleza e sofisticação ao seu lar.";
  }

  const instaTemplate = `🌟 **${formattedName}** 🌟

🛋️ Quer renovar sua casa com elegância e conforto? Esse móvel é a escolha perfeita! Peças com acabamento refinado e de alta durabilidade.

📋 **DETALHES DO PRODUTO:**
${mainDescription}

━━━━━━━━━━━━━━━━━━━━━
🚨 **MÁXIMA SEGURANÇA E CONFIANÇA**
❌ Sem sinal ou pagamento adiantado!
🤝 Você só realiza o pagamento na sua casa depois que o produto for entregue!

🚚 **Entrega ultra rápida para seu endereço!**`;

  return instaTemplate;
}
