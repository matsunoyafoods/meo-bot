import {
  lineReply,
  textMessage,
  type LineWebhookEvent,
  type LineQuickAction,
} from "@/lib/line/client";
import { ensureStoreForLineUser, getStoreByLineUser } from "@/lib/repo";
import { t } from "@/lib/telegram/i18n";
import type { OwnerLang } from "@/lib/supabase/database.types";

/**
 * LINE Webhook イベント処理（フェーズ1）。
 * - 友だち追加 / 初回発話で店舗を作成し、日本語のウェルカム＋メニュー（クイックリプライ）を返す。
 * - メニュー押下（postback）は受けて応答する（本機能の接続はフェーズ2）。
 * 中身のロジック（課金・生成・Google・管理画面）は Telegram と共通のものを順次つないでいく。
 */

function menuQuick(lang: OwnerLang): LineQuickAction[] {
  return [
    { label: t(lang, "menu_post"), data: "menu_post" },
    { label: t(lang, "menu_diagnose"), data: "menu_diagnose" },
    { label: t(lang, "menu_reviews"), data: "menu_reviews" },
    { label: t(lang, "menu_settings"), data: "menu_settings" },
    { label: t(lang, "subscribe_cta"), data: "subscribe" },
    { label: t(lang, "menu_contact"), data: "contact" },
  ];
}

export async function handleLineEvent(event: LineWebhookEvent): Promise<void> {
  const userId = event.source?.userId;
  const replyToken = event.replyToken;
  if (!userId || !replyToken) return;

  // 友だち追加 or メッセージ受信 → 店舗を用意してメニュー表示
  if (event.type === "follow" || event.type === "message") {
    const store = await ensureStoreForLineUser(userId);
    const lang = store.owner_lang;
    await lineReply(replyToken, [
      textMessage(t(lang, "menu_title"), menuQuick(lang)),
    ]);
    return;
  }

  // メニュー押下（フェーズ2で各機能へ接続）
  if (event.type === "postback") {
    const store = (await getStoreByLineUser(userId)) ?? (await ensureStoreForLineUser(userId));
    const lang = store.owner_lang;
    await lineReply(replyToken, [
      textMessage(
        "この機能はまもなくLINEでもご利用いただけます（準備中）。今はメニューからお選びください。",
        menuQuick(lang),
      ),
    ]);
    return;
  }
}
