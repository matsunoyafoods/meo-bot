import { randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  answerCallbackQuery,
  editMessageText,
  sendMessage,
  type TgUpdate,
  type TgCallbackQuery,
  type TgMessage,
  type InlineKeyboard,
} from "@/lib/telegram/client";
import { t, langName } from "@/lib/telegram/i18n";
import { langLabel } from "@/lib/gemini/prompts";
import type { OwnerLang, StoreRow, ReviewRow } from "@/lib/supabase/database.types";
import {
  ensureStoreForChat,
  getStoreByChatId,
  getStoreByInviteToken,
  addReportChat,
  updateStore,
  getOwnerState,
  setOwnerState,
  clearOwnerState,
  getReview,
} from "@/lib/repo";
import { buildAuthUrl } from "@/lib/google/oauth";
import { bindStoreByInvite } from "@/lib/admin-stores";
import { attributeStoreToRep } from "@/lib/admin-reps";
import { replyToReview } from "@/lib/google/business";
import { translateOwnerEditToReply } from "@/lib/gemini/client";
import { toStoreContext } from "@/lib/store-context";
import { publishPost, proposeArticle, reviseArticlePost } from "@/lib/workflows/article";
import { runDiagnosis } from "@/lib/workflows/diagnose";
import {
  startBacklog,
  generateHighStarDrafts,
  bulkSendHighStar,
  highStarOneByOne,
  pushLowStarQueue,
} from "@/lib/workflows/backlog";

/** webhook のエントリーポイント */
export async function handleUpdate(update: TgUpdate): Promise<void> {
  try {
    if (update.callback_query) {
      await handleCallback(update.callback_query);
    } else if (update.message) {
      await handleMessage(update.message);
    }
  } catch (err) {
    console.error("[telegram] handleUpdate error", err);
  }
}

/* ============================================================
 * メッセージ（コマンド + 自由入力）
 * ============================================================ */
async function handleMessage(msg: TgMessage): Promise<void> {
  const chatId = msg.chat.id;
  const text = (msg.text ?? "").trim();
  const chatType = msg.chat.type ?? "private";
  const isGroup = chatType === "group" || chatType === "supergroup";

  // グループ内では、招待トークン付き /start（レポート配信先の登録）だけ処理
  if (isGroup) {
    if (text.startsWith("/start")) return cmdStartGroup(msg, text);
    return;
  }

  if (text.startsWith("/start")) return cmdStart(chatId, text);
  if (text.startsWith("/settings")) return cmdSettings(chatId);
  if (text.startsWith("/post")) return cmdPost(chatId);
  if (text.startsWith("/diagnose")) return cmdDiagnose(chatId);
  if (text.startsWith("/reviews")) return cmdReviews(chatId);
  if (text.startsWith("/menu")) return cmdMenu(chatId);

  // コマンド以外 → 会話状態に応じて処理（編集フロー / 客単価入力 / 投稿キーワード）
  const store = await getStoreByChatId(chatId);
  if (!store) return void sendMessage(chatId, t("ja", "not_connected"));

  const state = await getOwnerState(store.id);
  if (state?.mode === "awaiting_review_edit") {
    return handleReviewEditText(store, state.context.review_id as string, text);
  }
  if (state?.mode === "awaiting_ticket_amount") {
    return handleTicketText(store, text);
  }
  if (state?.mode === "awaiting_post_keyword") {
    return handlePostKeywordText(store, text);
  }
  if (state?.mode === "awaiting_post_edit") {
    return handlePostEditText(store, state.context.post_id as string, text);
  }
  if (state?.mode === "awaiting_category") {
    return handleCategoryText(store, text);
  }
  if (state?.mode === "awaiting_keywords") {
    return handleKeywordsText(store, text);
  }
  // 状態が無ければ軽くヘルプ
  await sendMessage(chatId, t(store.owner_lang, "settings_title"));
}

/* ---------- /start : 店舗作成/招待紐づけ + OAuth URL ---------- */
async function cmdStart(chatId: number, text = "/start"): Promise<void> {
  // "/start invite_<token>" のディープリンクを解釈
  const param = text.split(/\s+/)[1] ?? "";
  let store = null as Awaited<ReturnType<typeof ensureStoreForChat>> | null;
  if (param.startsWith("invite_")) {
    const inviteToken = param.slice("invite_".length);
    store = await bindStoreByInvite(chatId, inviteToken);
  }
  // 招待が無効/未指定なら通常フロー（chat に紐づく店舗を用意）
  if (!store) store = await ensureStoreForChat(chatId);

  // "/start rep_<code>" : 営業マン専用リンク → 担当を自動紐づけ（初回のみ）
  if (param.startsWith("rep_")) {
    await attributeStoreToRep(store, param.slice("rep_".length));
  }
  const lang = store.owner_lang;

  // OAuth state を発行して chat と紐づけ
  const state = randomUUID();
  const supabase = createSupabaseAdminClient();
  await supabase.from("oauth_states").insert({ state, telegram_chat_id: chatId });
  const url = buildAuthUrl(state);

  // 未接続（初期設定がまだ）の店舗 → 初期設定を先に案内する
  //   ① まず母国語を選んでもらう（以降のメッセージを母国語で表示するため）
  //   ② Google 連携ボタン付きのウェルカム
  //   ③ 初期設定メニュー（言語・ジャンル・キーワード・客単価）
  // ※ メインメニューは、設定・連携が済んだ店舗にだけ表示する
  if (!store.onboarded) {
    await sendLanguageChooser(chatId, lang);
    await sendMessage(chatId, t(lang, "welcome"), [
      [{ text: t(lang, "connect_google"), url }],
    ]);
    await sendSettingsMenu(chatId, lang, t(lang, "setup_prompt"));
    return;
  }

  // 設定・連携が済んだ店舗 → メインメニュー（タップ操作）
  await sendMainMenu(chatId, lang);
}

/* ---------- グループに追加されたとき: レポート配信先として登録 ---------- */
async function cmdStartGroup(msg: TgMessage, text: string): Promise<void> {
  const chatId = msg.chat.id;
  // "/start invite_<token>" / "/start@Bot invite_<token>"
  const param = text.split(/\s+/)[1] ?? "";
  if (!param.startsWith("invite_")) {
    return void sendMessage(chatId, t("ja", "group_invalid"));
  }
  const token = param.slice("invite_".length);
  const store = await getStoreByInviteToken(token);
  if (!store) {
    return void sendMessage(chatId, t("ja", "group_invalid"));
  }
  await addReportChat(store.id, chatId, msg.chat.title ?? null);
  await sendMessage(
    chatId,
    t(store.owner_lang, "group_linked", { name: store.name || "" }),
  );
}

/* ---------- /diagnose : MEO診断 ---------- */
async function cmdDiagnose(chatId: number): Promise<void> {
  const store = await getStoreByChatId(chatId);
  if (!store) return void sendMessage(chatId, t("ja", "not_connected"));
  try {
    await runDiagnosis(store);
  } catch (e) {
    console.error("[telegram] diagnose error", e);
    await sendMessage(chatId, t(store.owner_lang, "error"));
  }
}

/* ---------- /reviews : 未返信口コミの一括処理（バックログ） ---------- */
async function cmdReviews(chatId: number): Promise<void> {
  const store = await getStoreByChatId(chatId);
  if (!store) return void sendMessage(chatId, t("ja", "not_connected"));
  try {
    await startBacklog(store);
  } catch (e) {
    console.error("[telegram] backlog error", e);
    await sendMessage(chatId, t(store.owner_lang, "error"));
  }
}

/* ---------- /menu : メインメニュー（タップ操作） ---------- */
async function cmdMenu(chatId: number): Promise<void> {
  const store = await getStoreByChatId(chatId);
  await sendMainMenu(chatId, store?.owner_lang ?? "en");
}

/** メインメニュー（投稿・診断・口コミ・設定） */
async function sendMainMenu(chatId: number, lang: OwnerLang): Promise<void> {
  await sendMessage(chatId, t(lang, "menu_title"), [
    [
      { text: t(lang, "menu_post"), callback_data: "menu_post" },
      { text: t(lang, "menu_diagnose"), callback_data: "menu_diagnose" },
    ],
    [
      { text: t(lang, "menu_reviews"), callback_data: "menu_reviews" },
      { text: t(lang, "menu_settings"), callback_data: "menu_settings" },
    ],
  ]);
}

/* ---------- /settings : インラインメニュー ---------- */
async function cmdSettings(chatId: number): Promise<void> {
  const store = await getStoreByChatId(chatId);
  if (!store) return void sendMessage(chatId, t("ja", "not_connected"));
  const lang = store.owner_lang;
  await sendSettingsMenu(store.telegram_chat_id ?? chatId, lang);
}

/** 設定メニュー（言語・ジャンル・キーワード・客単価） */
async function sendSettingsMenu(chatId: number, lang: OwnerLang, header?: string): Promise<void> {
  await sendMessage(chatId, header ?? t(lang, "settings_title"), [
    [{ text: t(lang, "set_language"), callback_data: "set_lang_menu" }],
    [{ text: t(lang, "set_category"), callback_data: "set_category" }],
    [{ text: t(lang, "set_keywords"), callback_data: "set_keywords" }],
    [{ text: t(lang, "set_ticket"), callback_data: "set_ticket" }],
  ]);
}

/* ---------- /post : キーワード指定のオンデマンド投稿 ---------- */
async function cmdPost(chatId: number): Promise<void> {
  const store = await getStoreByChatId(chatId);
  if (!store) return void sendMessage(chatId, t("ja", "not_connected"));
  await setOwnerState(store.id, "awaiting_post_keyword", {});
  await sendMessage(chatId, t(store.owner_lang, "ask_post_keyword"));
}

/** オーナーが入力したキーワード/内容から投稿下書きを生成して送る */
async function handlePostKeywordText(store: StoreRow, text: string): Promise<void> {
  await clearOwnerState(store.id);
  if (!text.trim()) return;
  try {
    // 入力内容をテーマとして記事を生成 → 下書き＋投稿ボタンが届く
    await proposeArticle(store, text.trim());
  } catch (e) {
    console.error("[telegram] custom post error", e);
    await sendMessage(store.telegram_chat_id!, t(store.owner_lang, "error"));
  }
}

/** オーナーの編集指示で下書きを作り直す */
async function handlePostEditText(
  store: StoreRow,
  postId: string,
  text: string,
): Promise<void> {
  await clearOwnerState(store.id);
  if (!text.trim()) return;
  try {
    await reviseArticlePost(store, postId, text.trim());
  } catch (e) {
    console.error("[telegram] post edit error", e);
    await sendMessage(store.telegram_chat_id!, t(store.owner_lang, "error"));
  }
}

/* ---------- ジャンル・キーワード テキスト入力 ---------- */
async function handleCategoryText(store: StoreRow, text: string): Promise<void> {
  const lang = store.owner_lang;
  await updateStore(store.id, { category: text.trim() });
  await clearOwnerState(store.id);
  await sendMessage(store.telegram_chat_id!, t(lang, "category_saved", { v: text.trim() }));
}

async function handleKeywordsText(store: StoreRow, text: string): Promise<void> {
  const lang = store.owner_lang;
  await updateStore(store.id, { keywords: text.trim() });
  await clearOwnerState(store.id);
  await sendMessage(store.telegram_chat_id!, t(lang, "keywords_saved"));
}

/* ---------- 客単価テキスト入力 ---------- */
async function handleTicketText(store: StoreRow, text: string): Promise<void> {
  const lang = store.owner_lang;
  // "10 USD" / "40000 KHR" / "$10" などを緩くパース
  const m = text.match(/([\d.,]+)\s*([A-Za-z$￥¥]{1,4})?/);
  if (!m) {
    return void sendMessage(store.telegram_chat_id!, t(lang, "ticket_invalid"));
  }
  const amount = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) {
    return void sendMessage(store.telegram_chat_id!, t(lang, "ticket_invalid"));
  }
  const currency = normalizeCurrency(m[2]);
  await updateStore(store.id, {
    avg_ticket_amount: amount,
    avg_ticket_currency: currency,
  });
  await clearOwnerState(store.id);
  await sendMessage(
    store.telegram_chat_id!,
    t(lang, "ticket_saved", { amount, currency }),
  );
}

function normalizeCurrency(raw?: string): string {
  if (!raw) return "USD";
  const c = raw.toUpperCase().replace("$", "USD").replace(/[￥¥]/, "JPY");
  return ["USD", "KHR", "JPY", "CNY"].includes(c) ? c : "USD";
}

/* ---------- 編集フロー: オーナー入力 → 相手言語へ翻訳 ---------- */
async function handleReviewEditText(
  store: StoreRow,
  reviewId: string,
  text: string,
): Promise<void> {
  const lang = store.owner_lang;
  const review = await getReview(reviewId);
  if (!review) {
    await clearOwnerState(store.id);
    return void sendMessage(store.telegram_chat_id!, t(lang, "error"));
  }

  const reviewerLang = review.review_lang ?? "en";
  const reply = await translateOwnerEditToReply(
    toStoreContext(store),
    text,
    reviewerLang,
  );

  // 返信案を差し替えて保存
  const supabase = createSupabaseAdminClient();
  await supabase.from("reviews").update({ draft_reply: reply }).eq("id", reviewId);
  await clearOwnerState(store.id);

  const preview = [
    `<b>${t(lang, "edit_preview", { lang: langLabel(reviewerLang) })}:</b>`,
    escapeHtml(reply),
  ].join("\n");
  await sendMessage(store.telegram_chat_id!, preview, [
    [
      { text: t(lang, "btn_send"), callback_data: `rev_send:${reviewId}` },
      { text: t(lang, "btn_edit"), callback_data: `rev_edit:${reviewId}` },
    ],
  ]);
}

/* ============================================================
 * コールバック（インラインボタン）
 * ============================================================ */
async function handleCallback(cb: TgCallbackQuery): Promise<void> {
  const data = cb.data ?? "";
  const chatId = cb.message?.chat.id;
  if (!chatId) return void answerCallbackQuery(cb.id);

  const store = await getStoreByChatId(chatId);
  if (!store) {
    await answerCallbackQuery(cb.id);
    return void sendMessage(chatId, t("ja", "not_connected"));
  }

  // --- 設定: 言語メニュー ---
  if (data === "set_lang_menu") {
    await answerCallbackQuery(cb.id);
    return showLanguageMenu(store, cb);
  }
  if (data.startsWith("set_lang:")) {
    const lang = data.split(":")[1] as OwnerLang;
    await updateStore(store.id, { owner_lang: lang });
    await answerCallbackQuery(cb.id);
    await sendMessage(chatId, t(lang, "lang_saved", { lang: langName(lang) }));
    // 初期設定中（未接続）なら、選んだ言語で初期設定メニューを出し直す
    if (!store.onboarded) {
      await sendSettingsMenu(chatId, lang, t(lang, "setup_prompt"));
    }
    return;
  }
  if (data === "set_ticket") {
    await setOwnerState(store.id, "awaiting_ticket_amount", {});
    await answerCallbackQuery(cb.id);
    return void sendMessage(chatId, t(store.owner_lang, "ask_ticket"));
  }
  if (data === "set_category") {
    await setOwnerState(store.id, "awaiting_category", {});
    await answerCallbackQuery(cb.id);
    return void sendMessage(chatId, t(store.owner_lang, "ask_category"));
  }
  if (data === "set_keywords") {
    await setOwnerState(store.id, "awaiting_keywords", {});
    await answerCallbackQuery(cb.id);
    return void sendMessage(chatId, t(store.owner_lang, "ask_keywords"));
  }

  // --- メインメニュー ---
  if (data === "menu_settings") {
    await answerCallbackQuery(cb.id);
    return sendSettingsMenu(chatId, store.owner_lang);
  }
  if (data === "menu_post") {
    await setOwnerState(store.id, "awaiting_post_keyword", {});
    await answerCallbackQuery(cb.id);
    return void sendMessage(chatId, t(store.owner_lang, "ask_post_keyword"));
  }
  if (data === "menu_diagnose" || data === "menu_reviews") {
    await answerCallbackQuery(cb.id);
    try {
      if (data === "menu_diagnose") await runDiagnosis(store);
      else await startBacklog(store);
    } catch (e) {
      console.error("[telegram] menu cb error", e);
      await sendMessage(chatId, t(store.owner_lang, "error"));
    }
    return;
  }

  // --- バックログ: 未返信口コミの一括処理 ---
  if (data === "bk_high" || data === "bk_low" || data === "bk_sendall" || data === "bk_one") {
    await answerCallbackQuery(cb.id);
    try {
      if (data === "bk_high") await generateHighStarDrafts(store);
      else if (data === "bk_low") await pushLowStarQueue(store);
      else if (data === "bk_sendall") await bulkSendHighStar(store);
      else await highStarOneByOne(store);
    } catch (e) {
      console.error("[telegram] backlog cb error", e);
      await sendMessage(chatId, t(store.owner_lang, "error"));
    }
    return;
  }

  // --- 口コミ: 送信 / 編集 / スキップ ---
  if (data.startsWith("rev_send:")) {
    return sendReviewNow(store, data.split(":")[1], cb);
  }
  if (data.startsWith("rev_skip:")) {
    const supabase = createSupabaseAdminClient();
    await supabase.from("reviews").update({ status: "skipped" }).eq("id", data.split(":")[1]);
    await answerCallbackQuery(cb.id, t(store.owner_lang, "skipped"));
    if (cb.message) await stripButtons(chatId, cb.message.message_id, cb.message.text);
    return;
  }
  if (data.startsWith("rev_edit:")) {
    const reviewId = data.split(":")[1];
    await setOwnerState(store.id, "awaiting_review_edit", { review_id: reviewId });
    await answerCallbackQuery(cb.id);
    const review = await getReview(reviewId);
    const reviewerLang = review?.review_lang ?? "en";
    return void sendMessage(
      chatId,
      t(store.owner_lang, "ask_edit", { lang: langLabel(reviewerLang) }),
    );
  }

  // --- 記事: 投稿 / 編集 / 見送り ---
  if (data.startsWith("post_pub:")) {
    return publishNow(store, data.split(":")[1], cb);
  }
  if (data.startsWith("post_edit:")) {
    const postId = data.split(":")[1];
    await setOwnerState(store.id, "awaiting_post_edit", { post_id: postId });
    await answerCallbackQuery(cb.id);
    return void sendMessage(chatId, t(store.owner_lang, "ask_post_edit"));
  }
  if (data.startsWith("post_skip:")) {
    const supabase = createSupabaseAdminClient();
    await supabase.from("posts").update({ status: "skipped" }).eq("id", data.split(":")[1]);
    await answerCallbackQuery(cb.id, t(store.owner_lang, "skipped"));
    if (cb.message) await stripButtons(chatId, cb.message.message_id, cb.message.text);
    return;
  }

  await answerCallbackQuery(cb.id);
}

/** 言語選択メニュー（4言語のボタン）を送る */
async function sendLanguageChooser(chatId: number, lang: OwnerLang): Promise<void> {
  const kb: InlineKeyboard = [
    [
      { text: "日本語", callback_data: "set_lang:ja" },
      { text: "ភាសាខ្មែរ", callback_data: "set_lang:km" },
    ],
    [
      { text: "English", callback_data: "set_lang:en" },
      { text: "中文", callback_data: "set_lang:zh" },
    ],
  ];
  await sendMessage(chatId, t(lang, "choose_language"), kb);
}

async function showLanguageMenu(store: StoreRow, cb: TgCallbackQuery): Promise<void> {
  await sendLanguageChooser(store.telegram_chat_id!, store.owner_lang);
}

async function sendReviewNow(
  store: StoreRow,
  reviewId: string,
  cb: TgCallbackQuery,
): Promise<void> {
  const lang = store.owner_lang;
  const review = await getReview(reviewId);
  if (!review || !review.draft_reply) {
    return void answerCallbackQuery(cb.id, t(lang, "error"));
  }
  const reviewName = await resolveReviewName(store, review);
  await replyToReview(store.id, reviewName, review.draft_reply);

  const supabase = createSupabaseAdminClient();
  await supabase
    .from("reviews")
    .update({ status: "replied", replied_at: new Date().toISOString() })
    .eq("id", reviewId);

  await clearOwnerState(store.id);
  await answerCallbackQuery(cb.id, t(lang, "sent"));
  if (cb.message) await stripButtons(cb.message.chat.id, cb.message.message_id, cb.message.text);
  await sendMessage(store.telegram_chat_id!, t(lang, "sent"));
}

async function publishNow(
  store: StoreRow,
  postId: string,
  cb: TgCallbackQuery,
): Promise<void> {
  const lang = store.owner_lang;
  try {
    await publishPost(postId);
    await answerCallbackQuery(cb.id, t(lang, "published"));
    if (cb.message) await stripButtons(cb.message.chat.id, cb.message.message_id, cb.message.text);
    await sendMessage(store.telegram_chat_id!, t(lang, "published"));
  } catch (err) {
    console.error("[telegram] publish error", err);
    await answerCallbackQuery(cb.id, t(lang, "error"));
  }
}

/**
 * reviews.google_review_id には reviewId 末尾のみ保存している場合があるため、
 * GBP の PUT に必要なフルパスを組み立てる。
 */
async function resolveReviewName(store: StoreRow, review: ReviewRow): Promise<string> {
  if (review.google_review_id.startsWith("accounts/")) return review.google_review_id;
  const acc = store.google_account_id!.startsWith("accounts/")
    ? store.google_account_id!
    : `accounts/${store.google_account_id}`;
  const loc = store.google_location_id!.startsWith("locations/")
    ? store.google_location_id!
    : `locations/${store.google_location_id}`;
  return `${acc}/${loc}/reviews/${review.google_review_id}`;
}

/** 押下済みボタンを消す（二重送信防止） */
async function stripButtons(
  chatId: number,
  messageId: number,
  text?: string,
): Promise<void> {
  try {
    await editMessageText(chatId, messageId, text ?? "✔️");
  } catch {
    /* 変更なしエラー等は無視 */
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
