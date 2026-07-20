import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { assertCron } from "@/lib/cron-auth";
import { setWebhook, setMyCommands } from "@/lib/telegram/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 一度だけ叩く初期設定エンドポイント（?key=CRON_SECRET で保護）。
 *  - Webhook を登録
 *  - コマンドメニュー（/ を押すと出る一覧）を登録
 */
export async function GET(req: Request): Promise<NextResponse> {
  const denied = assertCron(req);
  if (denied) return denied;

  const webhookUrl = `${env.appUrl}/api/telegram/webhook`;
  await setWebhook(webhookUrl, env.telegramWebhookSecret());

  await setMyCommands([
    { command: "start", description: "はじめる / Google連携" },
    { command: "settings", description: "設定（言語・ジャンル・キーワード・客単価）" },
    { command: "post", description: "投稿を作る（キーワードから）" },
    { command: "diagnose", description: "MEO診断（Googleマップの改善提案）" },
  ]);

  return NextResponse.json({ ok: true, webhookUrl });
}
