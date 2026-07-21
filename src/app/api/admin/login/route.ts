import { NextResponse } from "next/server";
import {
  verifyPassword,
  setAdminCookie,
  isLoginRateLimited,
  recordLoginAttempt,
} from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** リバースプロキシ(Vercel)経由のクライアントIPを取得 */
function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  return xff?.split(",")[0]?.trim() || "unknown";
}

export async function POST(req: Request): Promise<NextResponse> {
  const ip = clientIp(req);

  // 総当たり対策: 直近で失敗が多いIPはブロック
  if (await isLoginRateLimited(ip)) {
    return NextResponse.json(
      { ok: false, error: "too many attempts, try again later" },
      { status: 429 },
    );
  }

  let password = "";
  try {
    const body = (await req.json()) as { password?: string };
    password = body.password ?? "";
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const ok = verifyPassword(password);
  await recordLoginAttempt(ip, ok);
  if (!ok) {
    return NextResponse.json({ ok: false, error: "invalid password" }, { status: 401 });
  }
  await setAdminCookie();
  return NextResponse.json({ ok: true });
}
