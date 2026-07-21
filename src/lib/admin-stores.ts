import { randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getBotUsername } from "@/lib/telegram/client";
import type { StoreRow, OwnerLang } from "@/lib/supabase/database.types";

export interface AdminStoreView {
  id: string;
  name: string;
  telegram_chat_id: number | null;
  linked: boolean; // Telegram に紐づけ済みか
  onboarded: boolean; // Google 連携済みか
  status: "active" | "suspended";
  owner_lang: OwnerLang;
  avg_ticket_amount: number;
  avg_ticket_currency: string;
  category: string | null;
  keywords: string | null;
  trial_ends_at: string | null;
  trial_days_left: number | null;
  invite_token: string | null;
  invite_url: string | null; // Telegram に転送する招待リンク
  created_at: string;
}

function daysLeft(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

async function toView(row: StoreRow, botUsername: string): Promise<AdminStoreView> {
  return {
    id: row.id,
    name: row.name,
    telegram_chat_id: row.telegram_chat_id,
    linked: row.telegram_chat_id != null,
    onboarded: row.onboarded,
    status: row.status,
    owner_lang: row.owner_lang,
    avg_ticket_amount: Number(row.avg_ticket_amount),
    avg_ticket_currency: row.avg_ticket_currency,
    category: row.category,
    keywords: row.keywords,
    trial_ends_at: row.trial_ends_at,
    trial_days_left: daysLeft(row.trial_ends_at),
    invite_token: row.invite_token,
    invite_url: row.invite_token
      ? `https://t.me/${botUsername}?start=invite_${row.invite_token}`
      : null,
    created_at: row.created_at,
  };
}

/** 店舗一覧 */
export async function listStoresForAdmin(): Promise<AdminStoreView[]> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("stores")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<StoreRow[]>();
  const rows = data ?? [];
  let username = "";
  try {
    username = await getBotUsername();
  } catch {
    username = "";
  }
  return Promise.all(rows.map((r) => toView(r, username)));
}

/** 店舗を新規作成（招待トークン発行 + トライアル終了日を設定） */
export async function createStoreForAdmin(input: {
  name: string;
  trialDays: number;
  ownerLang?: OwnerLang;
  avgTicketAmount?: number;
  avgTicketCurrency?: string;
}): Promise<AdminStoreView> {
  const supabase = createSupabaseAdminClient();
  const inviteToken = randomUUID().replace(/-/g, "");
  const trialEnds = new Date(
    Date.now() + Math.max(0, input.trialDays) * 86_400_000,
  ).toISOString();

  const { data, error } = await supabase
    .from("stores")
    .insert({
      name: input.name,
      owner_lang: input.ownerLang ?? "en",
      avg_ticket_amount: input.avgTicketAmount ?? 10,
      avg_ticket_currency: input.avgTicketCurrency ?? "USD",
      invite_token: inviteToken,
      trial_ends_at: trialEnds,
      status: "active",
    })
    .select("*")
    .single<StoreRow>();
  if (error || !data) throw new Error(`createStore failed: ${error?.message}`);

  let username = "";
  try {
    username = await getBotUsername();
  } catch {
    username = "";
  }
  return toView(data, username);
}

/** 店舗の更新（トライアル終了日・名前・状態） */
export async function updateStoreForAdmin(
  id: string,
  patch: {
    name?: string;
    trial_ends_at?: string | null;
    status?: "active" | "suspended";
    category?: string | null;
    keywords?: string | null;
  },
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  // 利用期限を変更（延長＝再開）したら、予告通知のステージをリセットして再度予告が届くようにする
  const finalPatch =
    patch.trial_ends_at !== undefined ? { ...patch, trial_notify_stage: 0 } : patch;
  await supabase.from("stores").update(finalPatch).eq("id", id);
}

/** 店舗を削除（関連トークン・口コミ等は cascade で削除） */
export async function deleteStoreForAdmin(id: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase.from("stores").delete().eq("id", id);
}

/**
 * 招待トークンで店舗に Telegram チャットを紐づける（/start invite_<token>）。
 * 未紐づけ or 同じ chat のときだけ許可。成功したら店舗を返す。
 */
export async function bindStoreByInvite(
  chatId: number,
  inviteToken: string,
): Promise<StoreRow | null> {
  const supabase = createSupabaseAdminClient();
  const { data: store } = await supabase
    .from("stores")
    .select("*")
    .eq("invite_token", inviteToken)
    .maybeSingle<StoreRow>();
  if (!store) return null;

  if (store.telegram_chat_id != null && store.telegram_chat_id !== chatId) {
    // すでに別のチャットに紐づけ済み
    return null;
  }
  if (store.telegram_chat_id == null) {
    const { data: updated } = await supabase
      .from("stores")
      .update({ telegram_chat_id: chatId })
      .eq("id", store.id)
      .select("*")
      .single<StoreRow>();
    return updated ?? store;
  }
  return store;
}
