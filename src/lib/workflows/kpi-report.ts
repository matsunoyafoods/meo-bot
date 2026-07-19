import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  KpiReportInsert,
  StoreRow,
} from "@/lib/supabase/database.types";
import { getInsights } from "@/lib/google/business";
import { summarizeKpi } from "@/lib/gemini/client";
import { sendMessage } from "@/lib/telegram/client";

/** 来店転換率（固定 40%） */
const CONVERSION_RATE = 0.4;

/** 直近7日（先週）の [start, end) を UTC で返す */
function lastWeekRange(now: Date): { start: Date; end: Date; weekStart: string } {
  const end = new Date(now);
  end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 7);
  return { start, end, weekStart: start.toISOString().slice(0, 10) };
}

/**
 * 機能⑥: 週報KPI。
 * アクション数(ルート検索+電話) × 来店転換率(40%) × 客単価 = 推定売上貢献額
 * を計算し、Gemini で要約して Telegram 配信。
 */
export async function buildAndSendWeeklyReport(
  store: StoreRow,
  now: Date = new Date(),
): Promise<void> {
  if (!store.telegram_chat_id || !store.google_location_id) return;

  const { start, end, weekStart } = lastWeekRange(now);

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
    week_start: weekStart,
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
  const header = [
    "📊 <b>週報 / Weekly report</b>",
    `🗺 ${routeRequests}　📞 ${phoneCalls}`,
    `💰 ≈ ${estimatedRevenue.toLocaleString()} ${cur}`,
    "",
  ].join("\n");

  await sendMessage(store.telegram_chat_id, header + escapeHtml(summary));
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
