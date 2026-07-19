import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { handleUpdate } from "@/lib/telegram/handlers";
import type { TgUpdate } from "@/lib/telegram/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  // setWebhook で登録した secret_token と照合
  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  if (secret !== env.telegramWebhookSecret()) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: TgUpdate;
  try {
    update = (await req.json()) as TgUpdate;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Telegram には即 200 を返しつつ処理する（重い処理でもタイムアウトさせない）
  await handleUpdate(update);
  return NextResponse.json({ ok: true });
}
