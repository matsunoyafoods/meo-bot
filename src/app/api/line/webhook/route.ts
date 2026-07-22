import { NextResponse } from "next/server";
import { verifyLineSignature, type LineWebhookBody } from "@/lib/line/client";
import { handleLineEvent } from "@/lib/line/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * LINE Messaging API の Webhook。
 * 署名（X-Line-Signature）を検証してから各イベントを処理する。
 * LINE の検証（Verify）ボタン対策として、常に 200 を返す。
 */
export async function POST(req: Request): Promise<NextResponse> {
  const raw = await req.text();
  const signature = req.headers.get("x-line-signature");

  if (!verifyLineSignature(raw, signature)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let body: LineWebhookBody;
  try {
    body = JSON.parse(raw) as LineWebhookBody;
  } catch {
    return NextResponse.json({ ok: true }); // 検証用の空POST等
  }

  for (const event of body.events ?? []) {
    try {
      await handleLineEvent(event);
    } catch (e) {
      console.error("[line] handle event error", event.type, e);
    }
  }

  return NextResponse.json({ ok: true });
}
