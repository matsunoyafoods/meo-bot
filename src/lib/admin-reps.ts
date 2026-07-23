import { randomBytes } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getBotUsername } from "@/lib/telegram/client";
import { addMonths } from "@/lib/trial";
import type {
  SalesRepRow,
  StoreRow,
  RepCommissionEventRow,
} from "@/lib/supabase/database.types";

/**
 * 報酬ルール（現実の運用に合わせたもの）:
 *  - one_time($20): 新規契約が成立した月に必ず1回（何件目の契約でも発生）
 *  - recurring($5): その営業マンにとって21件目以降の契約についてのみ、
 *    実際にStripeの引き落としが成功した月ごとに加算される（1〜20件目は対象外）
 *  - 支払サイクル: 前月26日〜当月25日（カンボジア時間 UTC+7）に成立した分を、
 *    当月の月末に支払う（＝25日締め・当月末払い）
 *
 * 実際の確定記録は rep_commission_events テーブル（Stripe Webhookから記録、
 * stripe_invoice_id で重複防止）。ここでは一度書いた記録を変更しない＝
 * 過去に支払い確定した月の金額が後から動かないようにする。
 */
export const ONE_TIME_BONUS = 20;
export const RECURRING_BONUS = 5;
/** 継続報酬($5/月)は、その営業マンにとって21件目以降の契約からのみ加算される */
export const RECURRING_THRESHOLD = 20;

/** 支払い明細の1行 = Stripeでの引き落とし成功1回 */
export interface RepPayoutLine {
  store_id: string;
  store_name: string;
  kind: "one_time" | "recurring";
  rank: number; // その営業マンにとって何件目の契約か（0=不明）
  eligible: boolean; // 継続報酬(21件目以降)の対象か。one_timeは常にtrue
  amount: number; // 対象外(20件目以内の継続分)なら0
  paid_at: string;
}

export interface AdminRepView {
  id: string;
  name: string;
  code: string;
  referral_url: string | null;
  active_contracts: number; // 現在稼働中(status=active)の担当店舗数（参考値・支払額とは無関係）
  total_contracts: number; // これまでの累計契約成立数（=最大rank）
  payout_month: string; // 支払月 (YYYY-MM。この月の月末に支払う)
  window_start: string; // 締め期間の開始（前月26日 0:00, カンボジア時間）
  window_end: string; // 締め期間の終了（当月25日 23:59:59, カンボジア時間）
  one_time_count: number;
  one_time_amount: number;
  recurring_count: number; // 対象(21件目以降)の継続報酬件数
  recurring_amount: number;
  month_total: number;
  lines: RepPayoutLine[]; // 支払い明細
  created_at: string;
}

export function currentMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** カンボジア時間(UTC+7)の y-m-d 0:00:00 を UTC の ms instant で返す */
function cambodiaMidnightUtcMs(y: number, m1to12: number, d: number): number {
  return Date.UTC(y, m1to12 - 1, d, 0, 0, 0) - 7 * 3600 * 1000;
}

/**
 * 支払月(payoutMonth, 例 "2026-07")の締め期間を返す。
 * ルール: 前月26日 0:00 〜 当月25日 23:59:59（カンボジア時間）に実際の引き落としが
 * あった分を、当月の月末に支払う（＝25日締め・当月末払い）。
 */
function payoutWindow(payoutMonth: string): { start: number; end: number } {
  const [y, m] = payoutMonth.split("-").map(Number);
  const prev = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
  const start = cambodiaMidnightUtcMs(prev.y, prev.m, 26);
  const end = cambodiaMidnightUtcMs(y, m, 26) - 1; // 当月26日0:00の1ms前 = 25日23:59:59.999
  return { start, end };
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

/** 営業マン一覧（指定した支払月の確定明細つき） */
export async function listRepsForAdmin(payoutMonth = currentMonth()): Promise<AdminRepView[]> {
  const supabase = createSupabaseAdminClient();
  const { start, end } = payoutWindow(payoutMonth);

  const [{ data: reps }, { data: activeStores }, { data: allOneTime }, { data: windowEvents }, { data: storesForNames }] =
    await Promise.all([
      supabase.from("sales_reps").select("*").order("created_at", { ascending: false }).returns<SalesRepRow[]>(),
      supabase
        .from("stores")
        .select("id,sales_rep_id")
        .eq("status", "active")
        .returns<Pick<StoreRow, "id" | "sales_rep_id">[]>(),
      // 累計順位(rank)を出すため、全期間の一時報酬(=各店舗の初回引き落とし)を古い順で取得
      supabase
        .from("rep_commission_events")
        .select("id,store_id,sales_rep_id,kind,amount,paid_at,stripe_invoice_id,created_at")
        .eq("kind", "one_time")
        .order("paid_at", { ascending: true })
        .returns<RepCommissionEventRow[]>(),
      // 今回の支払月(締め期間)の対象イベント
      supabase
        .from("rep_commission_events")
        .select("id,store_id,sales_rep_id,kind,amount,paid_at,stripe_invoice_id,created_at")
        .gte("paid_at", new Date(start).toISOString())
        .lte("paid_at", new Date(end).toISOString())
        .order("paid_at", { ascending: true })
        .returns<RepCommissionEventRow[]>(),
      supabase.from("stores").select("id,name").returns<Pick<StoreRow, "id" | "name">[]>(),
    ]);

  const storeName = new Map((storesForNames ?? []).map((s) => [s.id, s.name]));

  // 営業マンごとの累計rank（店舗ID → 何件目の契約か）
  const rankByRep = new Map<string, Map<string, number>>();
  for (const ev of allOneTime ?? []) {
    const m = rankByRep.get(ev.sales_rep_id) ?? new Map<string, number>();
    if (!m.has(ev.store_id)) m.set(ev.store_id, m.size + 1);
    rankByRep.set(ev.sales_rep_id, m);
  }

  const activeCountByRep = new Map<string, number>();
  for (const s of activeStores ?? []) {
    if (!s.sales_rep_id) continue;
    activeCountByRep.set(s.sales_rep_id, (activeCountByRep.get(s.sales_rep_id) ?? 0) + 1);
  }

  const eventsByRep = new Map<string, RepCommissionEventRow[]>();
  for (const ev of windowEvents ?? []) {
    const arr = eventsByRep.get(ev.sales_rep_id) ?? [];
    arr.push(ev);
    eventsByRep.set(ev.sales_rep_id, arr);
  }

  const uname = await username();
  return (reps ?? []).map((r) => {
    const ranks = rankByRep.get(r.id) ?? new Map<string, number>();
    const events = eventsByRep.get(r.id) ?? [];

    const lines: RepPayoutLine[] = events.map((ev) => {
      const rank = ranks.get(ev.store_id) ?? 0;
      const eligible = ev.kind === "one_time" || rank > RECURRING_THRESHOLD;
      return {
        store_id: ev.store_id,
        store_name: storeName.get(ev.store_id) ?? "(削除済み店舗)",
        kind: ev.kind,
        rank,
        eligible,
        amount: eligible ? ev.amount : 0,
        paid_at: ev.paid_at,
      };
    });

    const oneTimeLines = lines.filter((l) => l.kind === "one_time");
    const recurringLines = lines.filter((l) => l.kind === "recurring" && l.eligible);
    const oneTimeAmount = oneTimeLines.reduce((a, l) => a + l.amount, 0);
    const recurringAmount = recurringLines.reduce((a, l) => a + l.amount, 0);

    return {
      id: r.id,
      name: r.name,
      code: r.code,
      referral_url: uname ? `https://t.me/${uname}?start=rep_${r.code}` : null,
      active_contracts: activeCountByRep.get(r.id) ?? 0,
      total_contracts: ranks.size,
      payout_month: payoutMonth,
      window_start: new Date(start).toISOString(),
      window_end: new Date(end).toISOString(),
      one_time_count: oneTimeLines.length,
      one_time_amount: oneTimeAmount,
      recurring_count: recurringLines.length,
      recurring_amount: recurringAmount,
      month_total: oneTimeAmount + recurringAmount,
      lines,
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
  const month = currentMonth();
  const { start, end } = payoutWindow(month);
  return {
    id: data.id,
    name: data.name,
    code: data.code,
    referral_url: uname ? `https://t.me/${uname}?start=rep_${data.code}` : null,
    active_contracts: 0,
    total_contracts: 0,
    payout_month: month,
    window_start: new Date(start).toISOString(),
    window_end: new Date(end).toISOString(),
    one_time_count: 0,
    one_time_amount: 0,
    recurring_count: 0,
    recurring_amount: 0,
    month_total: 0,
    lines: [],
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
