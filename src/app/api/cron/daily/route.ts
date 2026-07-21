import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { assertCron } from "@/lib/cron-auth";
import { generateAndProposeArticle } from "@/lib/workflows/article";
import {
  buildAndSendWeeklyReport,
  buildAndSendMonthlyReport,
} from "@/lib/workflows/kpi-report";
import { linkPendingStores } from "@/lib/workflows/reconcile";
import { sendMessage } from "@/lib/telegram/client";
import { env } from "@/lib/env";
import type { StoreRow } from "@/lib/supabase/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 1回のcronで処理する店舗数の上限（60秒のタイムアウト対策）。
 * これを超える店舗は、その日は処理せず翌回に回す（last_cron_at の古い順で公平にローテーション）。
 * 店舗が常時これを超えるようになったら Vercel Pro化 or ジョブキュー導入のサイン。
 */
const MAX_STORES_PER_RUN = 8;

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

  // GBPクォータ承認後、連携済みだが未接続の店舗を毎日自動で接続＋通知
  let reconcile = { checked: 0, linked: 0 };
  try {
    reconcile = await linkPendingStores();
  } catch (e) {
    console.error("[cron/daily] reconcile", e);
  }

  const supabase = createSupabaseAdminClient();

  const results: Record<string, string[]> = {};
  let processed = 0;
  let deferred = 0;

  // 店舗ごとの処理が必要な日だけ、店舗ループを回す
  const doAny = doArticle || doWeekly || doMonthly;
  if (doAny) {
    // 対象（onboarded）の総数
    const { count: total } = await supabase
      .from("stores")
      .select("id", { count: "exact", head: true })
      .eq("onboarded", true);

    // last_cron_at が古い（未処理=NULLが最優先）順に、上限件数だけ取得＝公平ローテーション
    const { data: stores } = await supabase
      .from("stores")
      .select("*")
      .eq("onboarded", true)
      .order("last_cron_at", { ascending: true, nullsFirst: true })
      .limit(MAX_STORES_PER_RUN)
      .returns<StoreRow[]>();

    const batch = stores ?? [];
    deferred = Math.max(0, (total ?? 0) - batch.length);

    for (const store of batch) {
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
      // 処理済みマーク（次回は後回しになり、未処理の店舗が先に回る）
      await supabase
        .from("stores")
        .update({ last_cron_at: new Date().toISOString() })
        .eq("id", store.id);
      results[store.id] = done;
      processed++;
    }

    if (deferred > 0) {
      // 上限を超えて今回スキップした店舗数を明示（Pro化/キュー導入の判断材料）
      console.warn(
        `[cron/daily] processed ${processed}/${total} stores, deferred ${deferred} to next run (cap=${MAX_STORES_PER_RUN})`,
      );
      // 管理者(Tom)に自動通知（週1回=月曜だけ。ADMIN_TELEGRAM_CHAT_ID 未設定なら送らない）
      const adminId = Number(env.adminTelegramChatId());
      if (doWeekly && Number.isFinite(adminId) && adminId !== 0) {
        try {
          await sendMessage(
            adminId,
            `⚠️ <b>処理能力の上限サイン</b>\n\n` +
              `日次処理で ${deferred} 店舗を翌回に回しました（現在の上限: 1回 ${MAX_STORES_PER_RUN} 店舗 / 対象 ${total} 店舗）。\n` +
              `店舗数が処理能力に近づいています。そろそろ <b>Vercel Pro化</b> または <b>ジョブキュー導入</b> をご検討ください。`,
          );
        } catch (e) {
          console.error("[cron/daily] admin alert failed", e);
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    weekday,
    dayOfMonth,
    ran: { doArticle, doWeekly, doMonthly },
    reconcile,
    cap: MAX_STORES_PER_RUN,
    processed,
    deferred,
    results,
  });
}
