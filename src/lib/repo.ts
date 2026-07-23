import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { addMonths } from "@/lib/trial";
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

/** 新規店舗のデフォルト無料期間（ヶ月）。招待/紹介リンク経由でなくても付与する。 */
const DEFAULT_TRIAL_MONTHS = 1;

/** /start 時: chat に紐づく店舗が無ければ作る（無料期間つき） */
export async function ensureStoreForChat(chatId: number): Promise<StoreRow> {
  const existing = await getStoreByChatId(chatId);
  if (existing) return existing;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("stores")
    .insert({
      telegram_chat_id: chatId,
      owner_lang: "en",
      trial_ends_at: addMonths(new Date(), DEFAULT_TRIAL_MONTHS).toISOString(),
    })
    .select("*")
    .single<StoreRow>();
  if (error || !data) throw new Error(`ensureStoreForChat failed: ${error?.message}`);
  return data;
}

/* ---------- LINE チャネル（日本市場向け・Telegram と並行運用） ---------- */

export async function getStoreByLineUser(lineUserId: string): Promise<StoreRow | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("stores")
    .select("*")
    .eq("line_user_id", lineUserId)
    .maybeSingle<StoreRow>();
  return data ?? null;
}

/** LINE の友だち/発話時: 該当店舗が無ければ作る（無料期間つき・言語は日本語既定） */
export async function ensureStoreForLineUser(lineUserId: string): Promise<StoreRow> {
  const existing = await getStoreByLineUser(lineUserId);
  if (existing) return existing;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("stores")
    .insert({
      platform: "line",
      line_user_id: lineUserId,
      owner_lang: "ja",
      trial_ends_at: addMonths(new Date(), DEFAULT_TRIAL_MONTHS).toISOString(),
    })
    .select("*")
    .single<StoreRow>();
  if (error || !data) throw new Error(`ensureStoreForLineUser failed: ${error?.message}`);
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

export async function getStoreByInviteToken(token: string): Promise<StoreRow | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("stores")
    .select("*")
    .eq("invite_token", token)
    .maybeSingle<StoreRow>();
  return data ?? null;
}

/**
 * LINE グループ(groupId)→店舗 の対応を取得。
 * グループは別店舗を作らず、この対応表でオーナーの店舗を参照する。
 */
export async function getStoreByLineChat(lineId: string): Promise<StoreRow | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("line_chats")
    .select("store_id")
    .eq("line_id", lineId)
    .maybeSingle<{ store_id: string }>();
  if (!data) return null;
  const { data: store } = await supabase
    .from("stores")
    .select("*")
    .eq("id", data.store_id)
    .maybeSingle<StoreRow>();
  return store ?? null;
}

/** LINE グループ(groupId)を既存の店舗に紐づける（重複は上書き） */
export async function linkLineChatToStore(
  lineId: string,
  storeId: string,
  kind: "group" | "user" = "group",
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase
    .from("line_chats")
    .upsert({ line_id: lineId, store_id: storeId, kind }, { onConflict: "line_id" });
}

/** グループ等のレポート配信先を登録（重複は無視） */
export async function addReportChat(
  storeId: string,
  chatId: number,
  title: string | null,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase
    .from("report_chats")
    .upsert({ store_id: storeId, chat_id: chatId, title }, { onConflict: "store_id,chat_id" });
}

/** 店舗のレポート配信先 chat_id 一覧 */
export async function listReportChatIds(storeId: string): Promise<number[]> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("report_chats")
    .select("chat_id")
    .eq("store_id", storeId)
    .returns<{ chat_id: number }[]>();
  return (data ?? []).map((r) => r.chat_id);
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
