import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "@/lib/env";
import {
  articleSystemPrompt,
  articleUserPrompt,
  articleEditSystemPrompt,
  articleEditUserPrompt,
  kpiSummarySystemPrompt,
  kpiSummaryUserPrompt,
  meoDiagnosisSystemPrompt,
  meoDiagnosisUserPrompt,
  ownerEditToReplySystemPrompt,
  reviewReplySystemPrompt,
  reviewReplyUserPrompt,
  translateReviewSystemPrompt,
  type StoreContext,
} from "@/lib/gemini/prompts";

let client: GoogleGenerativeAI | null = null;
function genAI(): GoogleGenerativeAI {
  if (!client) client = new GoogleGenerativeAI(env.geminiApiKey());
  return client;
}

/**
 * systemInstruction + JSON 強制で Gemini を1回呼び、JSON を返す共通関数。
 */
async function generateJson<T>(
  systemInstruction: string,
  userText: string,
): Promise<T> {
  const model = genAI().getGenerativeModel({
    model: env.geminiModel(),
    systemInstruction,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.7,
    },
  });

  const res = await model.generateContent(userText);
  const raw = res.response.text();
  try {
    return JSON.parse(raw) as T;
  } catch {
    // まれに ```json フェンスが付く場合の保険
    const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    return JSON.parse(cleaned) as T;
  }
}

/* ---------- ① 口コミ返信案（言語判定込み） ---------- */
export function generateReviewReply(
  store: StoreContext,
  review: { starRating: number; reviewerName?: string | null; comment?: string | null },
): Promise<{ review_lang: string; reply: string }> {
  return generateJson(
    reviewReplySystemPrompt(store),
    reviewReplyUserPrompt(review),
  );
}

/* ---------- ② 口コミをオーナー母国語へ翻訳 ---------- */
export async function translateReviewForOwner(
  comment: string,
  ownerLang: string,
): Promise<string> {
  const { translation } = await generateJson<{ translation: string }>(
    translateReviewSystemPrompt(ownerLang),
    JSON.stringify({ text: comment }),
  );
  return translation;
}

/* ---------- ③ オーナーの編集文 → 相手の言語の返信 ---------- */
export async function translateOwnerEditToReply(
  store: StoreContext,
  ownerMessage: string,
  reviewerLang: string,
): Promise<string> {
  const { reply } = await generateJson<{ reply: string }>(
    ownerEditToReplySystemPrompt(store, reviewerLang),
    JSON.stringify({ owner_message: ownerMessage }),
  );
  return reply;
}

/* ---------- ④ 日常記事（km/en + オーナー母国語） ---------- */
export function generateArticle(
  store: StoreContext,
  theme: string,
  ownerLang: string,
): Promise<{
  topic: string;
  body_km: string;
  body_en: string;
  body_owner: string;
}> {
  return generateJson(
    articleSystemPrompt(store, ownerLang),
    articleUserPrompt(theme),
  );
}

/* ---------- ④-b 記事の編集（オーナー指示で作り直す） ---------- */
export function reviseArticle(
  store: StoreContext,
  args: { currentKm: string | null; currentEn: string | null; instruction: string },
  ownerLang: string,
): Promise<{
  topic: string;
  body_km: string;
  body_en: string;
  body_owner: string;
}> {
  return generateJson(
    articleEditSystemPrompt(store, ownerLang),
    articleEditUserPrompt(args),
  );
}

/* ---------- ⑦ MEO診断 ---------- */
export interface MeoImprovement {
  title: string;
  action: string;
  impact: "high" | "medium" | "low";
}
export interface MeoDiagnosis {
  score: number;
  headline: string;
  good: string[];
  improve: MeoImprovement[];
}
export function diagnoseMeo(
  store: StoreContext,
  snapshot: unknown,
  ownerLang: string,
): Promise<MeoDiagnosis> {
  return generateJson<MeoDiagnosis>(
    meoDiagnosisSystemPrompt(store, ownerLang),
    meoDiagnosisUserPrompt(snapshot),
  );
}

/* ---------- ⑤ 週報KPI要約 ---------- */
export async function summarizeKpi(
  ownerLang: string,
  data: {
    routeRequests: number;
    phoneCalls: number;
    conversionRate: number;
    avgTicketAmount: number;
    currency: string;
    estimatedRevenue: number;
  },
): Promise<string> {
  const { summary } = await generateJson<{ summary: string }>(
    kpiSummarySystemPrompt(ownerLang),
    kpiSummaryUserPrompt(data),
  );
  return summary;
}
