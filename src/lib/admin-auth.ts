import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

/**
 * 管理画面の簡易認証（パイロット向け・管理者パスワード1つ）。
 * ログイン時に ADMIN_PASSWORD と照合し、httpOnly Cookie にトークンを保存する。
 * 将来 Supabase 認証へ差し替え可能。
 */
const COOKIE = "meo_admin";

function token(): string {
  return createHash("sha256")
    .update(`meo-admin::${env.adminPassword()}`)
    .digest("hex");
}

export function verifyPassword(input: string): boolean {
  return input.length > 0 && input === env.adminPassword();
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
  return jar.get(COOKIE)?.value === token();
}
