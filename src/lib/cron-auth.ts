import { NextResponse } from "next/server";
import { env } from "@/lib/env";

/**
 * Vercel Cron は CRON_SECRET が設定されていると
 * `Authorization: Bearer <CRON_SECRET>` を付けて呼ぶ。
 * 手動実行時も同じヘッダ、または ?key= で許可。
 */
export function assertCron(req: Request): NextResponse | null {
  const secret = env.cronSecret();
  const auth = req.headers.get("authorization");
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  if (auth === `Bearer ${secret}` || key === secret) return null;
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
