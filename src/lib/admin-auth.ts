import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * 管理画面の簡易認証（パイロット向け・管理者パスワード1つ）。
 * ログイン時に ADMIN_PASSWORD と照合し、httpOnly Cookie にトークンを保存する。
 * 将来 Supabase 認証へ差し替え可能。
 */
const COOKIE = "meo_admin";

/** 長さ非依存の定数時間比較（タイミング攻撃対策） */
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function token(): string {
  return createHash("sha256")
    .update(`meo-admin::${env.adminPassword()}`)
    .digest("hex");
}

export function verifyPassword(input: string): boolean {
  return input.length > 0 && safeEqual(input, env.adminPassword());
}

/* ---------- ログインのレート制限（総当たり対策） ---------- */
const MAX_FAILS = 8; // このウィンドウ内の失敗上限
const WINDOW_MIN = 10; // ウィンドウ（分）

/** 直近ウィンドウ内の失敗回数が上限を超えていればブロック。
 *  テーブル未作成などのエラー時は「制限なし」として通す（可用性優先・fail-open）。 */
export async function isLoginRateLimited(ip: string): Promise<boolean> {
  try {
    const supabase = createSupabaseAdminClient();
    const since = new Date(Date.now() - WINDOW_MIN * 60_000).toISOString();
    const { count, error } = await supabase
      .from("admin_login_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .eq("success", false)
      .gte("created_at", since);
    if (error) return false;
    return (count ?? 0) >= MAX_FAILS;
  } catch {
    return false;
  }
}

/** ログイン試行を記録。成功時はそのIPの失敗履歴を消す（自己ロック回避）。 */
export async function recordLoginAttempt(ip: string, success: boolean): Promise<void> {
  try {
    const supabase = createSupabaseAdminClient();
    await supabase.from("admin_login_attempts").insert({ ip, success });
    if (success) {
      await supabase
        .from("admin_login_attempts")
        .delete()
        .eq("ip", ip)
        .eq("success", false);
    }
  } catch (e) {
    console.error("[admin-auth] recordLoginAttempt failed", e);
  }
}

export async function setAdminCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, token(), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30日
  });
}

export async function clearAdminCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  const v = jar.get(COOKIE)?.value;
  return v !== undefined && safeEqual(v, token());
}
