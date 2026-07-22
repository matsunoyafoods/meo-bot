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

  // オーナーが設定したエリア（市区町村）があればそれを使う。
  // 未設定なら undefined のまま → プロンプト側で「都市名を創作しない」ガードが効く。
  const area = store.area?.trim() || undefined;

  return {
    name: store.name || "our restaurant",
    area,
    category: store.category || "restaurant",
    keywords: keywords.length ? keywords : [store.name || "our restaurant"],
  };
}
