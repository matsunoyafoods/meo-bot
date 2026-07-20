import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  KpiReportInsert,
  StoreRow,
} from "@/lib/supabase/database.types";
import { getInsights } from "@/lib/google/business";
import { summarizeKpi } from "@/lib/gemini/client";
import { sendMessage } from "@/lib/telegram/client";
import { listReportChatIds } from "@/lib/repo";

/** 来店転換率（固定 40%） */
const CONVERSION_RATE = 0.4;

/** 直近7日（先週）の [start, end) を UTC で返す */
function lastWeekRange(now: Date): { start: Date; end: Date; periodStart: string } {
  const end = new Date(now);
  end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 7);
  return { start, end, periodStart: start.toISOString().slice(0, 10) };
}

/** 前月（1日〜末日）の [start, end) を UTC で返す */
function lastMonthRange(now: Date): { start: Date; end: Date; periodStart: string } {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return { start, end, periodStart: start.toISOString().slice(0, 10) };
}

/** オーナーの個人チャット＋登録グループ全てへ送信 */
async function sendToAll(store: StoreRow, text: string): Promise<void> {
  const targets = new Set<number>();
  if (store.telegram_chat_id) targets.add(store.telegram_chat_id);
  for (const id of await listReportChatIds(store.id)) targets.add(id);
  for (const chatId of targets) {
    try {
      await sendMessage(chatId, text);
    } catch (e) {
      console.error(`[kpi-report] send to ${chatId} failed`, e);
    }
  }
}

/**
 * 機能⑥: KPIレポート（週次/月次共通コア）。
 * アクション数(ルート検索+電話) × 来店転換率(40%) × 客単価 = 推定売上貢献額
 * を計算し、Gemini で要約して オーナー＋グループ に配信。
 */
async function buildAndSendReport(
  store: StoreRow,
  range: { start: Date; end: Date; periodStart: string },
  titleLabel: string,
): Promise<void> {
  if (!store.google_location_id) return;
  const reportChats = await listReportChatIds(store.id);
  if (!store.telegram_chat_id && reportChats.length === 0) return;

  const { start, end, periodStart } = range;

  const { routeRequests, phoneCalls } = await getInsights(
    store.id,
    store.google_location_id,
    start,
    end,
  );

  const actions = routeRequests + phoneCalls;
  const estimatedRevenue =
    actions * CONVERSION_RATE * Number(store.avg_ticket_amount);

  const summary = await summarizeKpi(store.owner_lang, {
    routeRequests,
    phoneCalls,
    conversionRate: CONVERSION_RATE,
    avgTicketAmount: Number(store.avg_ticket_amount),
    currency: store.avg_ticket_currency,
    estimatedRevenue,
  });

  const supabase = createSupabaseAdminClient();
  const insert: KpiReportInsert = {
    store_id: store.id,
    week_start: periodStart,
    route_requests: routeRequests,
    phone_calls: phoneCalls,
    conversion_rate: CONVERSION_RATE,
    avg_ticket_amount: Number(store.avg_ticket_amount),
    avg_ticket_currency: store.avg_ticket_currency,
    estimated_revenue: estimatedRevenue,
    summary_text: summary,
  };
  await supabase.from("kpi_reports").upsert(insert, { onConflict: "store_id,week_start" });

  const cur = store.avg_ticket_currency;
  const nameLine = store.name ? `<i>${escapeHtml(store.name)}</i>\n` : "";
  const header = [
    `📊 <b>${titleLabel}</b>`,
    nameLine + `🗺 ${routeRequests}　📞 ${phoneCalls}`,
    `💰 ≈ ${estimatedRevenue.toLocaleString()} ${cur}`,
    "",
  ].join("\n");

  await sendToAll(store, header + escapeHtml(summary));
}

/** 週報（毎週月曜） */
export function buildAndSendWeeklyReport(
  store: StoreRow,
  now: Date = new Date(),
): Promise<void> {
  return buildAndSendReport(store, lastWeekRange(now), "週報 / Weekly report");
}

/** 月報（毎月1日・前月分） */
export function buildAndSendMonthlyReport(
  store: StoreRow,
  now: Date = new Date(),
): Promise<void> {
  return buildAndSendReport(store, lastMonthRange(now), "月報 / Monthly report");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
