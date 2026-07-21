import { randomBytes } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getBotUsername } from "@/lib/telegram/client";
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
  one_time_total: number; // 一時報酬の累計対象額（1〜20件 × $20）
  recurring_monthly: number; // 継続報酬の月額（21件目以降 × $5）
  created_at: string;
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

/** 営業マン一覧（担当件数・報酬計算つき） */
export async function listRepsForAdmin(): Promise<AdminRepView[]> {
  const supabase = createSupabaseAdminClient();
  const [{ data: reps }, { data: stores }] = await Promise.all([
    supabase.from("sales_reps").select("*").order("created_at", { ascending: false }).returns<SalesRepRow[]>(),
    supabase.from("stores").select("sales_rep_id,status").returns<Pick<StoreRow, "sales_rep_id" | "status">[]>(),
  ]);

  // 稼働中(active)の担当店舗数を集計
  const counts = new Map<string, number>();
  for (const s of stores ?? []) {
    if (s.sales_rep_id && s.status === "active") {
      counts.set(s.sales_rep_id, (counts.get(s.sales_rep_id) ?? 0) + 1);
    }
  }

  const uname = await username();
  return (reps ?? []).map((r) => {
    const n = counts.get(r.id) ?? 0;
    const oneTimeCount = Math.min(n, THRESHOLD);
    const recurringCount = Math.max(0, n - THRESHOLD);
    return {
      id: r.id,
      name: r.name,
      code: r.code,
      referral_url: uname ? `https://t.me/${uname}?start=rep_${r.code}` : null,
      active_contracts: n,
      one_time_total: oneTimeCount * ONE_TIME_BONUS,
      recurring_monthly: recurringCount * RECURRING_BONUS,
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
    one_time_total: 0,
    recurring_monthly: 0,
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
    patch.trial_ends_at = new Date(Date.now() + 60 * 86_400_000).toISOString();
  }
  await supabase.from("stores").update(patch).eq("id", store.id);
}
