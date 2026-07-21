import { randomBytes } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getBotUsername } from "@/lib/telegram/client";
import { addMonths } from "@/lib/trial";
import type { SalesRepRow, StoreRow } from "@/lib/supabase/database.types";

/** 報酬ルール（1件あたり） */
export const ONE_TIME_BONUS = 20; // 1〜20件目: 一時報酬 $20
export const RECURRING_BONUS = 5; // 21件目以降: 継続報酬 $5/月
export const THRESHOLD = 20;

export interface AdminRepView {
  id: string;
  name: string;
  code: string;
  referral_url: string | null;
  active_contracts: number; // 稼働中(status=active)の担当店舗数
  month: string; // 計算対象月 (YYYY-MM)
  one_time_count: number; // 今月の新規(1〜20件目)の件数
  one_time_amount: number; // 今月の一時報酬額
  recurring_count: number; // 21件目以降で稼働中の件数
  recurring_amount: number; // 今月の継続報酬額
  month_total: number; // 今月の支払額（一時＋継続）
  created_at: string;
}

export function currentMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthBounds(month: string): { start: number; end: number } {
  const [y, m] = month.split("-").map(Number);
  return { start: Date.UTC(y, m - 1, 1), end: Date.UTC(y, m, 1) };
}

function shortCode(): string {
  // URL に安全な短いコード（英数字8文字）
  return randomBytes(6).toString("base64url").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "rep";
}

async function username(): Promise<string> {
  try {
    return await getBotUsername();
  } catch {
    return "";
  }
}

type StorePick = Pick<StoreRow, "sales_rep_id" | "status" | "created_at">;

/** 営業マン一覧（指定月の報酬計算つき） */
export async function listRepsForAdmin(month = currentMonth()): Promise<AdminRepView[]> {
  const supabase = createSupabaseAdminClient();
  const [{ data: reps }, { data: stores }] = await Promise.all([
    supabase.from("sales_reps").select("*").order("created_at", { ascending: false }).returns<SalesRepRow[]>(),
    supabase.from("stores").select("sales_rep_id,status,created_at").returns<StorePick[]>(),
  ]);

  const { start, end } = monthBounds(month);

  // 営業マンごとに担当店舗を登録日順（契約順）でまとめる
  const byRep = new Map<string, StorePick[]>();
  for (const s of stores ?? []) {
    if (!s.sales_rep_id) continue;
    const arr = byRep.get(s.sales_rep_id) ?? [];
    arr.push(s);
    byRep.set(s.sales_rep_id, arr);
  }

  const uname = await username();
  return (reps ?? []).map((r) => {
    const list = byRep.get(r.id) ?? [];

    // モデル: 全件に一時$20（契約した月）＋ 稼働中は$5/月（継続）
    let oneTimeCount = 0; // 対象月に新規契約した件数
    let recurringCount = 0; // 対象月末までに契約済みで稼働中の件数
    let active = 0;
    list.forEach((s) => {
      const ts = new Date(s.created_at).getTime();
      if (s.status === "active") active++;
      // 一時報酬: 対象月に契約した全件
      if (ts >= start && ts < end) oneTimeCount++;
      // 継続報酬: 稼働中 & 対象月末までに契約済みの全件
      if (s.status === "active" && ts < end) recurringCount++;
    });

    const oneTimeAmount = oneTimeCount * ONE_TIME_BONUS;
    const recurringAmount = recurringCount * RECURRING_BONUS;
    return {
      id: r.id,
      name: r.name,
      code: r.code,
      referral_url: uname ? `https://t.me/${uname}?start=rep_${r.code}` : null,
      active_contracts: active,
      month,
      one_time_count: oneTimeCount,
      one_time_amount: oneTimeAmount,
      recurring_count: recurringCount,
      recurring_amount: recurringAmount,
      month_total: oneTimeAmount + recurringAmount,
      created_at: r.created_at,
    };
  });
}

/** 営業マンを新規作成（専用リンク用コードを発行） */
export async function createRepForAdmin(name: string): Promise<AdminRepView> {
  const supabase = createSupabaseAdminClient();
  const code = shortCode();
  const { data, error } = await supabase
    .from("sales_reps")
    .insert({ name: name.trim(), code })
    .select("*")
    .single<SalesRepRow>();
  if (error || !data) throw new Error(`createRep failed: ${error?.message}`);
  const uname = await username();
  return {
    id: data.id,
    name: data.name,
    code: data.code,
    referral_url: uname ? `https://t.me/${uname}?start=rep_${data.code}` : null,
    active_contracts: 0,
    month: currentMonth(),
    one_time_count: 0,
    one_time_amount: 0,
    recurring_count: 0,
    recurring_amount: 0,
    month_total: 0,
    created_at: data.created_at,
  };
}

export async function deleteRepForAdmin(id: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  // 店舗の sales_rep_id は on delete set null で自動的に外れる
  await supabase.from("sales_reps").delete().eq("id", id);
}

/** コードから営業マンを取得（Bot の rep_ ディープリンク用） */
export async function getRepByCode(code: string): Promise<SalesRepRow | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("sales_reps")
    .select("*")
    .eq("code", code)
    .maybeSingle<SalesRepRow>();
  return data ?? null;
}

/**
 * 店舗に担当営業マンを紐づける（rep_ リンク経由の初回登録）。
 * すでに担当がいる場合は上書きしない（最初の紐づけ優先）。
 * 未設定ならトライアル(60日)も同時に付与。
 */
export async function attributeStoreToRep(
  store: StoreRow,
  code: string,
): Promise<void> {
  if (store.sales_rep_id) return; // 既に担当あり → 変更しない
  const rep = await getRepByCode(code);
  if (!rep) return;

  const supabase = createSupabaseAdminClient();
  const patch: Partial<StoreRow> = { sales_rep_id: rep.id };
  if (!store.trial_ends_at) {
    patch.trial_ends_at = addMonths(new Date(), 1).toISOString();
  }
  await supabase.from("stores").update(patch).eq("id", store.id);
}
