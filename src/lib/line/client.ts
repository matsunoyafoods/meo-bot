import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/**
 * LINE Messaging API クライアント（サーバー専用）。
 * Telegram の client.ts と同じ責務: 署名検証 + メッセージ送信 + 型。
 */

const API = "https://api.line.me/v2/bot";

export function lineConfigured(): boolean {
  return Boolean(env.lineChannelAccessToken() && env.lineChannelSecret());
}

/** Webhook 署名検証（X-Line-Signature = HMAC-SHA256(body, channelSecret) を base64） */
export function verifyLineSignature(rawBody: string, signature: string | null): boolean {
  const secret = env.lineChannelSecret();
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/* ---------- メッセージ型 ---------- */
export interface LineQuickAction {
  /** タップで送られる表示テキスト or postback データ */
  label: string;
  /** postback 用データ（Telegram の callback_data 相当）。 */
  data?: string;
  /** message アクションのとき実際に送るテキスト（省略時は label） */
  text?: string;
  /** uri アクション（リンクを開く。Google連携リンク等） */
  url?: string;
}
export interface LineTextMessage {
  type: "text";
  text: string;
  quickReply?: {
    items: Array<{
      type: "action";
      action:
        | { type: "message"; label: string; text: string }
        | { type: "postback"; label: string; data: string; displayText?: string }
        | { type: "uri"; label: string; uri: string };
    }>;
  };
}

/** テキスト（＋任意でクイックリプライ・ボタン）を組み立てる */
export function textMessage(text: string, quick?: LineQuickAction[]): LineTextMessage {
  const msg: LineTextMessage = { type: "text", text };
  if (quick?.length) {
    msg.quickReply = {
      items: quick.slice(0, 13).map((q) => {
        const label = q.label.slice(0, 20);
        if (q.url) return { type: "action" as const, action: { type: "uri" as const, label, uri: q.url } };
        if (q.data)
          return {
            type: "action" as const,
            action: { type: "postback" as const, label, data: q.data, displayText: q.label },
          };
        return { type: "action" as const, action: { type: "message" as const, label, text: q.text ?? q.label } };
      }),
    };
  }
  return msg;
}

async function call(path: string, body: unknown): Promise<boolean> {
  const token = env.lineChannelAccessToken();
  if (!token) return false;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${API}${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (res.ok) return true;
      // 4xx はリトライしても直らない
      if (res.status >= 400 && res.status < 500) {
        const t = await res.text().catch(() => "");
        console.error("[line] call failed", path, res.status, t);
        return false;
      }
    } catch (e) {
      if (attempt < 2) await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      else console.error("[line] call error", path, e);
    }
  }
  return false;
}

/** 受信イベントへの返信（replyToken は一度きり・短時間有効・無料） */
export function lineReply(replyToken: string, messages: LineTextMessage[]): Promise<boolean> {
  return call("/message/reply", { replyToken, messages: messages.slice(0, 5) });
}

/** こちらから能動送信（to = userId。プッシュ通知は月間上限あり） */
export function linePush(to: string, messages: LineTextMessage[]): Promise<boolean> {
  return call("/message/push", { to, messages: messages.slice(0, 5) });
}

/* ---------- Webhook イベントの最小型 ---------- */
export interface LineWebhookEvent {
  type: string; // "message" | "follow" | "postback" | "join" | ...
  replyToken?: string;
  source?: { type: string; userId?: string; groupId?: string };
  message?: { type: string; text?: string };
  postback?: { data: string };
}
export interface LineWebhookBody {
  destination?: string;
  events?: LineWebhookEvent[];
}
