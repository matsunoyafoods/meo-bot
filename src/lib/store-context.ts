import type { StoreRow } from "@/lib/supabase/database.types";
import type { StoreContext } from "@/lib/gemini/prompts";

/**
 * StoreRow → Gemini 用 StoreContext。
 * 店舗ごとの category / keywords を反映（未設定なら汎用フォールバック）。
 */
export function toStoreContext(store: StoreRow): StoreContext {
  const kw = (store.keywords ?? "")
    .split(/[,、\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const keywords = [store.name, ...kw].filter(Boolean);

  return {
    name: store.name || "our restaurant",
    area: "Phnom Penh, Cambodia",
    category: store.category || "restaurant",
    keywords: keywords.length ? keywords : [store.name || "our restaurant", "Phnom Penh"],
  };
}
