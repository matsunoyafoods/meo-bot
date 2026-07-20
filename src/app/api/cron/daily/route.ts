import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { assertCron } from "@/lib/cron-auth";
import { generateAndProposeArticle } from "@/lib/workflows/article";
import {
  buildAndSendWeeklyReport,
  buildAndSendMonthlyReport,
} from "@/lib/workflows/kpi-report";
import type { StoreRow } from "@/lib/supabase/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 日次ディスパッチャ（Vercel Hobby は cron 本数が少ないため1本に集約）。
 * カンボジア時間(UTC+7)で判定:
 *  - 月/水/金 → 記事下書き生成（機能④）
 *  - 月曜     → 週報（機能⑥）
 *  - 毎月1日  → 前月分の月報（機能⑥）
 */
export async function GET(req: Request): Promise<NextResponse> {
  const denied = assertCron(req);
  if (denied) return denied;

  const now = new Date();
  const local = new Date(now.getTime() + 7 * 3600 * 1000); // UTC+7
  const weekday = local.getUTCDay(); // 0=日 .. 6=土
  const dayOfMonth = local.getUTCDate();

  const doArticle = weekday === 1 || weekday === 3 || weekday === 5;
  const doWeekly = weekday === 1;
  const doMonthly = dayOfMonth === 1;

  const supabase = createSupabaseAdminClient();
  const { data: stores } = await supabase
    .from("stores")
    .select("*")
    .eq("onboarded", true)
    .returns<StoreRow[]>();

  const results: Record<string, string[]> = {};
  for (const store of stores ?? []) {
    const done: string[] = [];
    if (doArticle) {
      try {
        await generateAndProposeArticle(store);
        done.push("article");
      } catch (e) {
        console.error(`[cron/daily] article ${store.id}`, e);
        done.push(`article:error`);
      }
    }
    if (doWeekly) {
      try {
        await buildAndSendWeeklyReport(store, now);
        done.push("weekly");
      } catch (e) {
        console.error(`[cron/daily] weekly ${store.id}`, e);
        done.push(`weekly:error`);
      }
    }
    if (doMonthly) {
      try {
        await buildAndSendMonthlyReport(store, now);
        done.push("monthly");
      } catch (e) {
        console.error(`[cron/daily] monthly ${store.id}`, e);
        done.push(`monthly:error`);
      }
    }
    results[store.id] = done;
  }

  return NextResponse.json({
    ok: true,
    weekday,
    dayOfMonth,
    ran: { doArticle, doWeekly, doMonthly },
    results,
  });
}
