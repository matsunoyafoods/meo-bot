import type { StoreRow } from "@/lib/supabase/database.types";
import { sendMessage, type InlineKeyboard } from "@/lib/telegram/client";
import { linePush, textMessage, type LineQuickAction } from "@/lib/line/client";

/**
 * チャネル共通の配信レイヤー。
 * 各ワークフロー/コールバックは deliverToStore(store, text, buttons) を呼ぶだけで、
 * store.platform に応じて Telegram / LINE の正しい宛先へ届く。
 *
 * text は Telegram の HTML 記法（<b> 等）で書いてよい。
 * LINE 宛のときは HTML を除去してプレーンテキストにする（LINEはリッチテキスト非対応）。
 */

export interface DeliverButton {
  text: string;
  data?: string; // Telegram: callback_data / LINE: postback data
  url?: string; // リンクボタン
}
export type DeliverButtons = DeliverButton[][];

/** この店舗に配信先チャネルがあるか */
export function storeHasChannel(store: StoreRow): boolean {
  return store.platform === "line"
    ? Boolean(store.line_user_id)
    : store.telegram_chat_id != null;
}

function stripHtml(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

export async function deliverToStore(
  store: StoreRow,
  text: string,
  buttons?: DeliverButtons,
): Promise<void> {
  if (store.platform === "line") {
    if (!store.line_user_id) return;
    const quick: LineQuickAction[] = (buttons ?? [])
      .flat()
      .slice(0, 13)
      .map((b) => (b.url ? { label: b.text, url: b.url } : { label: b.text, data: b.data }));
    await linePush(store.line_user_id, [
      textMessage(stripHtml(text), quick.length ? quick : undefined),
    ]);
    return;
  }
  // Telegram
  if (store.telegram_chat_id == null) return;
  const kb: InlineKeyboard | undefined = buttons?.map((row) =>
    row.map((b) => (b.url ? { text: b.text, url: b.url } : { text: b.text, callback_data: b.data! })),
  );
  await sendMessage(store.telegram_chat_id, text, kb);
}
