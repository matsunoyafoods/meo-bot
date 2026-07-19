import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  StoreRow,
  OwnerStateRow,
  OwnerStateMode,
  ReviewRow,
} from "@/lib/supabase/database.types";

export async function getStoreByChatId(chatId: number): Promise<StoreRow | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("stores")
    .select("*")
    .eq("telegram_chat_id", chatId)
    .maybeSingle<StoreRow>();
  return data ?? null;
}

/** /start 時: chat に紐づく店舗が無ければ作る */
export async function ensureStoreForChat(chatId: number): Promise<StoreRow> {
  const existing = await getStoreByChatId(chatId);
  if (existing) return existing;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("stores")
    .insert({ telegram_chat_id: chatId })
    .select("*")
    .single<StoreRow>();
  if (error || !data) throw new Error(`ensureStoreForChat failed: ${error?.message}`);
  return data;
}

export async function updateStore(
  storeId: string,
  patch: Partial<StoreRow>,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase.from("stores").update(patch).eq("id", storeId);
}

export async function getOwnerState(storeId: string): Promise<OwnerStateRow | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("owner_states")
    .select("*")
    .eq("store_id", storeId)
    .maybeSingle<OwnerStateRow>();
  return data ?? null;
}

export async function setOwnerState(
  storeId: string,
  mode: OwnerStateMode,
  context: Record<string, unknown> = {},
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase
    .from("owner_states")
    .upsert({ store_id: storeId, mode, context }, { onConflict: "store_id" });
}

export async function clearOwnerState(storeId: string): Promise<void> {
  await setOwnerState(storeId, null, {});
}

export async function getReview(reviewId: string): Promise<ReviewRow | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("reviews")
    .select("*")
    .eq("id", reviewId)
    .maybeSingle<ReviewRow>();
  return data ?? null;
}
