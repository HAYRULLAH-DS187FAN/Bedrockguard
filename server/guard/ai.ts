import { invokeLLM, listLLMModels } from "../_core/llm";
import type { ModerationConfig, ModerationSignal } from "../../shared/guard";

export async function getAiRiskSignal(content: string, config: ModerationConfig): Promise<ModerationSignal | null> {
  if (!config.ai.enabled || !content.trim()) return null;
  const catalog = await listLLMModels();
  const preferred = config.ai.modelPreference === "gpt-5-mini" && catalog.data.some(model => model.id === "gpt-5-mini") ? "gpt-5-mini" : undefined;
  const response = await invokeLLM({
    model: preferred,
    maxTokens: 360,
    messages: [
      { role: "system", content: "Minecraft sunucusu mesaj risk sınıflandırıcısısın. Sadece yardımcı sinyal üret; yaptırım önermiyorsun. Oyun bağlamındaki şakalaşmayı agresif biçimde cezalandırma. JSON şemasına eksiksiz uy." },
      { role: "user", content: `İncelenecek oyuncu mesajı:\n${content.slice(0, 512)}` },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "bedrockguard_risk_signal",
        strict: true,
        schema: {
          type: "object",
          properties: {
            risk: { type: "number", minimum: 0, maximum: 1 },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            categories: { type: "array", items: { type: "string", enum: ["harassment", "threat", "advertising", "none"] }, maxItems: 3 },
            rationale: { type: "string", maxLength: 240 },
          },
          required: ["risk", "confidence", "categories", "rationale"],
          additionalProperties: false,
        },
      },
    },
  });
  const rawContent = response.choices[0]?.message.content;
  const jsonContent = typeof rawContent === "string" ? rawContent : "{}";
  const value = JSON.parse(jsonContent) as { risk?: number; confidence?: number; categories?: string[]; rationale?: string };
  const confidence = typeof value.confidence === "number" ? value.confidence : 0;
  const risk = typeof value.risk === "number" ? value.risk : 0;
  if (confidence < config.ai.minimumConfidence || risk <= 0) return null;
  return {
    category: "ai_risk",
    ruleId: "ai.message_risk",
    label: "AI destekleyici risk sinyali",
    points: Math.min(config.ai.maxSignalPoints, Math.max(1, Math.round(risk * config.ai.maxSignalPoints))),
    confidence,
    explanation: `${(value.categories ?? ["risk"]).join(", ")}: ${(value.rationale ?? "Yapılandırılmış risk sınıflandırması.").slice(0, 240)}`,
  };
}
