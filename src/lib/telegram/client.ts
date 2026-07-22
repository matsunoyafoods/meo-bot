import { env } from "@/lib/env";

const API = () => `https://api.telegram.org/bot${env.telegramBotToken()}`;

export interface InlineButton {
  text: string;
  /** callback_data（64バイト以内） or url のどちらか */
  callback_data?: string;
  url?: string;
}

export type InlineKeyboard = InlineButton[][];

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function call<T = unknown>(method: string, body: unknown): Promise<T> {
  // Telegramへの接続は稀に ETIMEDOUT で失敗するので、ネットワーク失敗時のみ数回リトライする。
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${API()}/${method}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (e) {
      // 接続失敗（fetch failed / ETIMEDOUT など）→ 少し待って再試行
      lastErr = e;
      if (attempt < 2) await sleep(400 * (attempt + 1));
      continue;
    }
    const json = (await res.json()) as { ok: boolean; result?: T; description?: string };
    if (!json.ok) {
      // API側のエラー（400等）はリトライしても直らないので即throw
      throw new Error(`Telegram ${method} failed: ${json.description ?? res.status}`);
    }
    return json.result as T;
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error(`Telegram ${method} failed after retries`);
}

export async function sendMessage(
  chatId: number,
  text: string,
  keyboard?: InlineKeyboard,
): Promise<{ message_id: number }> {
  // 送信は「投げっぱなし(void)」で呼ばれる箇所が多いため、失敗しても例外を投げず
  // ログに残して握りつぶす（未処理エラーで関数がクラッシュするのを防ぐ）。
  try {
    return await call("sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
    });
  } catch (e) {
    console.error("[telegram] sendMessage failed", e);
    return { message_id: 0 };
  }
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
/** setMyCommands のスコープ（省略時は全チャット既定） */
export type BotCommandScope =
  | { type: "default" }
  | { type: "all_private_chats" }
  | { type: "all_group_chats" }
  | { type: "all_chat_administrators" };

/**
 * コマンドメニュー（/ を押すと出る一覧）を登録。
 * グループには「メニュー」ボタンが無いため、all_group_chats スコープで登録すると
 * グループで「/」を押したときにコマンド候補が出るようになる。
 */
export function setMyCommands(
  commands: BotCommand[],
  scope?: BotCommandScope,
): Promise<unknown> {
  return call("setMyCommands", scope ? { commands, scope } : { commands });
}

/** メニューボタン（プライベートチャット左下）を「コマンド一覧」表示にする */
export function setChatMenuButton(): Promise<unknown> {
  return call("setChatMenuButton", { menu_button: { type: "commands" } });
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
