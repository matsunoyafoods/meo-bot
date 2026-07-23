import { NextResponse } from "next/server";
import { assertCron } from "@/lib/cron-auth";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * LINE 設定の診断（?key=CRON_SECRET で保護）。
 * デプロイ中のサーバーが持つトークン/シークレットの「長さ」と、
 * トークンが LINE に受理されるか（/v2/bot/info）だけを返す。
 * ※ 値そのものは返さない（安全）。401の原因切り分け用。
 */
export async function GET(req: Request): Promise<NextResponse> {
  const denied = assertCron(req);
  if (denied) return denied;

  const token = env.lineChannelAccessToken();
  const secret = env.lineChannelSecret();

  let botInfo: unknown = null;
  let botError: string | null = null;
  if (token) {
    try {
      const r = await fetch("https://api.line.me/v2/bot/info", {
        headers: { authorization: `Bearer ${token}` },
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) botInfo = j;
      else botError = `${r.status} ${JSON.stringify(j)}`;
    } catch (e) {
      botError = String(e);
    }
  }

  return NextResponse.json({
    configured: Boolean(token && secret),
    tokenLength: token.length, // 長期トークンは通常150〜180前後。32ならシークレット誤入力の疑い。0なら未設定。
    tokenHasWhitespace: /\s/.test(token),
    secretLength: secret.length, // 通常32
    tokenValidOnLine: botInfo !== null, // true ならトークンは有効
    botInfo, // 有効なら basicId(@135skpbd 等) が入る
    botError, // 無効ならLINEのエラー内容
  });
}
