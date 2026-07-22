import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { assertCron } from "@/lib/cron-auth";
import { setWebhook, setMyCommands, setChatMenuButton } from "@/lib/telegram/client";

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

  const commands = [
    { command: "start", description: "Start / Connect Google" },
    { command: "menu", description: "Main menu (post, MEO check, reviews, settings)" },
    { command: "settings", description: "Settings (language, genre, keywords, avg. spend)" },
    { command: "post", description: "Create a post (from a keyword)" },
    { command: "reviews", description: "Reply to unreplied reviews (bulk)" },
    { command: "diagnose", description: "MEO diagnosis (Google Maps suggestions)" },
    { command: "subscribe", description: "Subscribe / continue ($49/month)" },
    { command: "manage", description: "Manage or cancel your subscription" },
  ];
  // 既定スコープ（DM）＋ グループ用スコープ の両方に登録
  // → グループでも「/」でコマンド候補が出る（グループには青いメニューボタンが無いため）
  await setMyCommands(commands);
  await setMyCommands(commands, { type: "all_group_chats" });
  // DM左下の「メニュー」ボタンをコマンド一覧表示に固定
  await setChatMenuButton();

  return NextResponse.json({ ok: true, webhookUrl, scopes: ["default", "all_group_chats"] });
}
