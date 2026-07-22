import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Checkout / Portal からの戻り先。Telegram に戻るよう案内するだけの簡易ページ。 */
export async function GET(req: Request): Promise<NextResponse> {
  const canceled = new URL(req.url).searchParams.get("canceled");
  const msg = canceled
    ? "お手続きはキャンセルされました。Telegramに戻ってやり直せます。"
    : "✅ お手続きありがとうございます。Telegramに戻ってください。";
  return new NextResponse(
    `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MapBoost</title></head><body style="font-family:sans-serif;max-width:480px;margin:48px auto;padding:0 16px;text-align:center"><p style="font-size:18px">${msg}</p></body></html>`,
    { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}
