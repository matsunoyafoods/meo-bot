import { env } from "@/lib/env";

const API = () => `https://api.telegram.org/bot${env.telegramBotToken()}`;

export interface InlineButton {
  text: string;
  /** callback_data（64バイト以内） or url のどちらか */
  callback_data?: string;
  url?: string;
}

export type InlineKeyboard = InlineButton[][];

async function call<T = unknown>(method: string, body: unknown): Promise<T> {
  const res = await fetch(`${API()}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { ok: boolean; result?: T; description?: string };
  if (!json.ok) {
    throw new Error(`Telegram ${method} failed: ${json.description ?? res.status}`);
  }
  return json.result as T;
}

export function sendMessage(
  chatId: number,
  text: string,
  keyboard?: InlineKeyboard,
): Promise<{ message_id: number }> {
  return call("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
  });
}

export function editMessageText(
  chatId: number,
  messageId: number,
  text: string,
  keyboard?: InlineKeyboard,
): Promise<unknown> {
  return call("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: keyboard ? { inline_keyboard: keyboard } : { inline_keyboard: [] },
  });
}

export function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
): Promise<unknown> {
  return call("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    ...(text ? { text } : {}),
  });
}

let cachedUsername: string | null = null;
/** Bot の @username を取得（招待リンク t.me/<username>?start=... 用にキャッシュ） */
export async function getBotUsername(): Promise<string> {
  if (cachedUsername) return cachedUsername;
  const me = await call<{ username: string }>("getMe", {});
  cachedUsername = me.username;
  return cachedUsername;
}

export function setWebhook(url: string, secretToken: string): Promise<unknown> {
  return call("setWebhook", {
    url,
    secret_token: secretToken,
    allowed_updates: ["message", "callback_query"],
  });
}

export interface BotCommand {
  command: string;
  description: string;
}
/** コマンドメニュー（/ を押すと出る一覧）を登録 */
export function setMyCommands(commands: BotCommand[]): Promise<unknown> {
  return call("setMyCommands", { commands });
}

/* --------- Telegram Update の最小型 --------- */
export interface TgUser {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  language_code?: string;
}
export interface TgChat {
  id: number;
  /** "private" | "group" | "supergroup" | "channel" */
  type?: string;
  title?: string;
}
export interface TgMessage {
  message_id: number;
  from?: TgUser;
  chat: TgChat;
  text?: string;
  /** グループにメンバー（Bot含む）が追加されたときのサービスメッセージ */
  new_chat_members?: TgUser[];
}
export interface TgCallbackQuery {
  id: string;
  from: TgUser;
  message?: TgMessage;
  data?: string;
}
export interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  callback_query?: TgCallbackQuery;
}
