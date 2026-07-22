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
    // 地域は店舗ごとに実際の所在地が異なる（鹿児島・プノンペン等）。
    // 現状DBに住所を保持していないため、勝手な都市名は入れず undefined にする。
    // → プロンプト側で「地域が不明なら都市名を創作しない」よう指示している。
    area: undefined,
    category: store.category || "restaurant",
    keywords: keywords.length ? keywords : [store.name || "our restaurant"],
  };
}
