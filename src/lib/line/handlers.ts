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
import { randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildAuthUrl } from "@/lib/google/oauth";
import { isStoreUsable } from "@/lib/trial";
import { runDiagnosis } from "@/lib/workflows/diagnose";
import type { OwnerLang, StoreRow } from "@/lib/supabase/database.types";

/**
 * LINE Webhook 処理（フェーズ2）。
 * - 1対1トーク / グループ の両対応（グループは groupId を店舗IDとして扱う）。
 * - メニュー（クイックリプライ）で操作。設定（言語/ジャンル/キーワード/エリア）と問い合わせを実装。
 * - Google連携が要る機能（投稿/診断/口コミ）と課金は次段で接続（今は準備中メッセージ）。
 * 中身のロジック（repo・i18n・管理者通知）は Telegram と共通のものを再利用。
 */

/* ---------- メニュー（クイックリプライ） ---------- */
function mainMenu(store: Pick<StoreRow, "owner_lang" | "onboarded">): LineQuickAction[] {
  const lang = store.owner_lang;
  const items: LineQuickAction[] = [];
  if (!store.onboarded) items.push({ label: t(lang, "connect_google"), data: "connect_google" });
  items.push(
    { label: t(lang, "menu_post"), data: "menu_post" },
    { label: t(lang, "menu_diagnose"), data: "menu_diagnose" },
    { label: t(lang, "menu_reviews"), data: "menu_reviews" },
    { label: t(lang, "menu_settings"), data: "menu_settings" },
    { label: t(lang, "subscribe_cta"), data: "subscribe" },
    { label: t(lang, "menu_contact"), data: "contact" },
  );
  return items;
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

async function reply(replyToken: string, text: string, quick?: LineQuickAction[]): Promise<boolean> {
  const ok = await lineReply(replyToken, [textMessage(text, quick)]);
  console.log("[line] reply", JSON.stringify({ ok, len: text.length, quick: quick?.length ?? 0 }));
  return ok;
}

/** グループなら groupId、そうでなければ userId を「このチャットの店舗ID」とする */
function chatIdOf(event: LineWebhookEvent): string | null {
  return event.source?.groupId ?? event.source?.userId ?? null;
}

export async function handleLineEvent(event: LineWebhookEvent): Promise<void> {
  const replyToken = event.replyToken;
  const chatId = chatIdOf(event);
  console.log(
    "[line] event",
    JSON.stringify({
      type: event.type,
      src: event.source?.type,
      hasToken: Boolean(replyToken),
      data: event.postback?.data,
      text: event.message?.text?.slice(0, 30),
    }),
  );
  if (!chatId || !replyToken) return;

  // 友だち追加 / グループ参加 → ウェルカム＋メニュー
  if (event.type === "follow" || event.type === "join") {
    const store = await ensureStoreForLineUser(chatId);
    await reply(replyToken, t(store.owner_lang, "menu_title"), mainMenu(store));
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
    return void reply(replyToken, t(lang, "category_saved", { v: text }), mainMenu(store));
  }
  if (state?.mode === "awaiting_keywords") {
    await updateStore(store.id, { keywords: text });
    await clearOwnerState(store.id);
    return void reply(replyToken, t(lang, "keywords_saved"), mainMenu(store));
  }
  if (state?.mode === "awaiting_area") {
    const clear = /^(none|なし|無|no|N\/A)$/i.test(text);
    await updateStore(store.id, { area: clear || !text ? null : text });
    await clearOwnerState(store.id);
    return void reply(
      replyToken,
      clear || !text ? t(lang, "area_cleared") : t(lang, "area_saved", { v: text }),
      mainMenu(store),
    );
  }
  if (state?.mode === "awaiting_ticket_amount") {
    await updateStore(store.id, { avg_ticket_amount: Number(text.replace(/[^\d.]/g, "")) || 0 });
    await clearOwnerState(store.id);
    return void reply(replyToken, t(lang, "keywords_saved"), mainMenu(store)); // 簡易確認
  }
  if (state?.mode === "awaiting_contact_message") {
    await clearOwnerState(store.id);
    await forwardContact(store, text);
    return void reply(
      replyToken,
      text ? t(lang, "contact_sent") : t(lang, "contact_unavailable"),
      mainMenu(store),
    );
  }

  // 状態なし → メニューを表示
  await reply(replyToken, t(lang, "menu_title"), mainMenu(store));
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
      mainMenu({ owner_lang: newLang, onboarded: store.onboarded }),
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
  if (data === "connect_google") {
    return void sendGoogleConnect(store, replyToken);
  }

  // MEO診断（公開マップをPlaces APIで診断。Google連携は不要）
  if (data === "menu_diagnose") {
    if (!isStoreUsable(store)) {
      return void reply(replyToken, t(lang, "trial_ended"), mainMenu(store));
    }
    // 診断は数秒かかる。結果はプッシュで届く（runDiagnosis 内で配信）。
    await runDiagnosis(store);
    return;
  }

  // 投稿・口コミ・課金は次段で接続
  if (["menu_post", "menu_reviews", "subscribe", "manage"].includes(data)) {
    return void reply(
      replyToken,
      "この機能はまもなくLINEでもご利用いただけます（準備中です）。今は「Google連携」「MEO診断」「設定」「問い合わせ」がご利用いただけます。",
      mainMenu(store),
    );
  }

  await reply(replyToken, t(lang, "menu_title"), mainMenu(store));
}

/* ---------- Google連携リンクを送る（LINEの oauth_state を発行） ---------- */
async function sendGoogleConnect(store: StoreRow, replyToken: string): Promise<void> {
  const lang = store.owner_lang;
  const state = randomUUID();
  const supabase = createSupabaseAdminClient();
  await supabase
    .from("oauth_states")
    .insert({ state, platform: "line", line_user_id: store.line_user_id });
  const url = buildAuthUrl(state);
  await reply(replyToken, t(lang, "welcome"), [{ label: t(lang, "connect_google"), url }]);
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
