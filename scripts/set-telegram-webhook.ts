/**
 * Telegram webhook を登録するワンショットスクリプト。
 * 使い方:
 *   1) .env に TELEGRAM_BOT_TOKEN / TELEGRAM_WEBHOOK_SECRET / NEXT_PUBLIC_APP_URL を設定
 *   2) npx tsx scripts/set-telegram-webhook.ts
 */
import { setWebhook } from "../src/lib/telegram/client";
import { env } from "../src/lib/env";

async function main() {
  const url = `${env.appUrl}/api/telegram/webhook`;
  const res = await setWebhook(url, env.telegramWebhookSecret());
  console.log("setWebhook ->", url);
  console.log(res);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
