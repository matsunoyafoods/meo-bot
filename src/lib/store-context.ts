import type { StoreRow } from "@/lib/supabase/database.types";
import type { StoreContext } from "@/lib/gemini/prompts";

/**
 * StoreRow → Gemini 用 StoreContext。
 * PoC ではエリアを固定。将来は stores に area/category/keywords 列を足すとよい。
 */
export function toStoreContext(store: StoreRow): StoreContext {
  return {
    name: store.name || "our restaurant",
    area: "Phnom Penh, Cambodia",
    category: "ramen / Japanese restaurant",
    keywords: [store.name, "Phnom Penh", "ramen", "Japanese food"].filter(Boolean),
  };
}
