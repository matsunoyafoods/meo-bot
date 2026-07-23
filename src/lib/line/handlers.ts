import {
  lineReply,
  textMessage,
  type LineWebhookEvent,
  type LineQuickAction,
} from "@/lib/line/client";
import {
  ensureStoreForLineUser,
  getStoreByLineUser,
  getOwnerState,
  setOwnerState,
  clearOwnerState,
  updateStore,
} from "@/lib/repo";
import { t, langName } from "@/lib/telegram/i18n";
import { sendMessage as tgSendMessage } from "@/lib/telegram/client";
import { env } from "@/lib/env";
import type { OwnerLang, StoreRow } from "@/lib/supabase/database.types";

/**
 * LINE Webhook 処理（フェーズ2）。
 * - 1対1トーク / グループ の両対応（グループは groupId を店舗IDとして扱う）。
 * - メニュー（クイックリプライ）で操作。設定（言語/ジャンル/キーワード/エリア）と問い合わせを実装。
 * - Google連携が要る機能（投稿/診断/口コミ）と課金は次段で接続（今は準備中メッセージ）。
 * 中身のロジック（repo・i18n・管理者通知）は Telegram と共通のものを再利用。
 */

/* ---------- メニュー（クイックリプライ） ---------- */
function mainMenu(lang: OwnerLang): LineQuickAction[] {
  return [
    { label: t(lang, "menu_post"), data: "menu_post" },
    { label: t(lang, "menu_diagnose"), data: "menu_diagnose" },
    { label: t(lang, "menu_reviews"), data: "menu_reviews" },
    { label: t(lang, "menu_settings"), data: "menu_settings" },
    { label: t(lang, "subscribe_cta"), data: "subscribe" },
    { label: t(lang, "menu_contact"), data: "contact" },
  ];
}
function settingsMenu(lang: OwnerLang): LineQuickAction[] {
  return [
    { label: t(lang, "set_language"), data: "set_lang_menu" },
    { label: t(lang, "set_category"), data: "set_category" },
    { label: t(lang, "set_area"), data: "set_area" },
    { label: t(lang, "set_keywords"), data: "set_keywords" },
    { label: t(lang, "set_ticket"), data: "set_ticket" },
    { label: t(lang, "menu_contact"), data: "contact" },
  ];
}
function langMenu(): LineQuickAction[] {
  return [
    { label: "日本語", data: "set_lang:ja" },
    { label: "English", data: "set_lang:en" },
    { label: "ភាសាខ្មែរ", data: "set_lang:km" },
    { label: "中文", data: "set_lang:zh" },
  ];
}

function reply(replyToken: string, text: string, quick?: LineQuickAction[]): Promise<boolean> {
  return lineReply(replyToken, [textMessage(text, quick)]);
}

/** グループなら groupId、そうでなければ userId を「このチャットの店舗ID」とする */
function chatIdOf(event: LineWebhookEvent): string | null {
  return event.source?.groupId ?? event.source?.userId ?? null;
}

export async function handleLineEvent(event: LineWebhookEvent): Promise<void> {
  const replyToken = event.replyToken;
  const chatId = chatIdOf(event);
  if (!chatId || !replyToken) return;

  // 友だち追加 / グループ参加 → ウェルカム＋メニュー
  if (event.type === "follow" || event.type === "join") {
    const store = await ensureStoreForLineUser(chatId);
    await reply(replyToken, t(store.owner_lang, "menu_title"), mainMenu(store.owner_lang));
    return;
  }

  if (event.type === "message") {
    const store = await ensureStoreForLineUser(chatId);
    await handleLineText(store, replyToken, (event.message?.text ?? "").trim());
    return;
  }

  if (event.type === "postback") {
    const store = (await getStoreByLineUser(chatId)) ?? (await ensureStoreForLineUser(chatId));
    await handleLinePostback(store, replyToken, event.postback?.data ?? "");
    return;
  }
}

/* ---------- テキスト入力（設定の途中入力など） ---------- */
async function handleLineText(store: StoreRow, replyToken: string, text: string): Promise<void> {
  const lang = store.owner_lang;
  const state = await getOwnerState(store.id);

  if (state?.mode === "awaiting_category") {
    await updateStore(store.id, { category: text });
    await clearOwnerState(store.id);
    return void reply(replyToken, t(lang, "category_saved", { v: text }), mainMenu(lang));
  }
  if (state?.mode === "awaiting_keywords") {
    await updateStore(store.id, { keywords: text });
    await clearOwnerState(store.id);
    return void reply(replyToken, t(lang, "keywords_saved"), mainMenu(lang));
  }
  if (state?.mode === "awaiting_area") {
    const clear = /^(none|なし|無|no|N\/A)$/i.test(text);
    await updateStore(store.id, { area: clear || !text ? null : text });
    await clearOwnerState(store.id);
    return void reply(
      replyToken,
      clear || !text ? t(lang, "area_cleared") : t(lang, "area_saved", { v: text }),
      mainMenu(lang),
    );
  }
  if (state?.mode === "awaiting_ticket_amount") {
    await updateStore(store.id, { avg_ticket_amount: Number(text.replace(/[^\d.]/g, "")) || 0 });
    await clearOwnerState(store.id);
    return void reply(replyToken, t(lang, "keywords_saved"), mainMenu(lang)); // 簡易確認
  }
  if (state?.mode === "awaiting_contact_message") {
    await clearOwnerState(store.id);
    await forwardContact(store, text);
    return void reply(
      replyToken,
      text ? t(lang, "contact_sent") : t(lang, "contact_unavailable"),
      mainMenu(lang),
    );
  }

  // 状態なし → メニューを表示
  await reply(replyToken, t(lang, "menu_title"), mainMenu(lang));
}

/* ---------- ボタン（postback） ---------- */
async function handleLinePostback(store: StoreRow, replyToken: string, data: string): Promise<void> {
  const lang = store.owner_lang;

  if (data === "menu_settings") {
    return void reply(replyToken, t(lang, "settings_title"), settingsMenu(lang));
  }
  if (data === "set_lang_menu") {
    return void reply(replyToken, t(lang, "set_language"), langMenu());
  }
  if (data.startsWith("set_lang:")) {
    const newLang = data.split(":")[1] as OwnerLang;
    await updateStore(store.id, { owner_lang: newLang });
    return void reply(
      replyToken,
      t(newLang, "lang_saved", { lang: langName(newLang) }),
      mainMenu(newLang),
    );
  }
  if (data === "set_category") {
    await setOwnerState(store.id, "awaiting_category", {});
    return void reply(replyToken, t(lang, "ask_category"));
  }
  if (data === "set_keywords") {
    await setOwnerState(store.id, "awaiting_keywords", {});
    return void reply(replyToken, t(lang, "ask_keywords"));
  }
  if (data === "set_area") {
    await setOwnerState(store.id, "awaiting_area", {});
    return void reply(replyToken, t(lang, "ask_area"));
  }
  if (data === "set_ticket") {
    await setOwnerState(store.id, "awaiting_ticket_amount", {});
    return void reply(replyToken, t(lang, "ask_ticket"));
  }
  if (data === "contact") {
    await setOwnerState(store.id, "awaiting_contact_message", {});
    return void reply(replyToken, t(lang, "contact_prompt"));
  }

  // Google連携が要る機能 / 課金は次段で接続
  if (["menu_post", "menu_diagnose", "menu_reviews", "subscribe", "manage"].includes(data)) {
    return void reply(
      replyToken,
      "この機能はまもなくLINEでもご利用いただけます（Google連携・お申し込みを準備中です）。今は「設定」と「問い合わせ」がご利用いただけます。",
      mainMenu(lang),
    );
  }

  await reply(replyToken, t(lang, "menu_title"), mainMenu(lang));
}

/* ---------- 問い合わせを管理者(Tom)のTelegramへ転送 ---------- */
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
async function forwardContact(store: StoreRow, body: string): Promise<void> {
  const text = body.trim();
  if (!text) return;
  const adminId = Number(env.adminTelegramChatId());
  if (!adminId || Number.isNaN(adminId)) {
    console.error("[line] contact: ADMIN_TELEGRAM_CHAT_ID 未設定のため転送できません");
    return;
  }
  const name = store.name?.trim() || "(店名未設定)";
  const msg =
    `📩 <b>新しい問い合わせ (LINE)</b>\n` +
    `店舗: ${escapeHtml(name)}\n` +
    `言語: ${store.owner_lang}\n` +
    `line_id: <code>${escapeHtml(store.line_user_id ?? "")}</code>\n` +
    `store_id: <code>${store.id}</code>\n— — —\n${escapeHtml(text)}`;
  try {
    await tgSendMessage(adminId, msg);
  } catch (e) {
    console.error("[line] contact forward failed", e);
  }
}
