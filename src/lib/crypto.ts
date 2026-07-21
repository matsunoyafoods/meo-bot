import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

/**
 * 機微データ（Googleトークン等）のアプリ側暗号化。
 *
 * - AES-256-GCM（認証付き暗号）を使用。
 * - 鍵は ENCRYPTION_KEY（任意長）から SHA-256 で 32byte に導出。
 * - 暗号文は "enc:v1:" プレフィックス付き base64（iv12 + tag16 + 本体）。
 * - ENCRYPTION_KEY 未設定なら暗号化は無効（平文のまま）→ アプリは壊れない。
 * - 復号は平文（プレフィックス無し）をそのまま返す＝旧データの自動移行に対応。
 */

const PREFIX = "enc:v1:";

function keyMaterial(): string {
  return env.encryptionKey();
}

function key(): Buffer {
  return createHash("sha256").update(keyMaterial()).digest();
}

/** 暗号化済みか（"enc:v1:" プレフィックスを持つか） */
export function isEncrypted(value: string): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

/** 文字列を暗号化。鍵未設定 or 空文字ならそのまま返す。 */
export function encryptSecret(plain: string): string {
  if (!plain || !keyMaterial()) return plain;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, enc]).toString("base64");
}

/** 文字列を復号。平文（プレフィックス無し）はそのまま返す＝旧データ互換。 */
export function decryptSecret(stored: string): string {
  if (!stored || !isEncrypted(stored)) return stored;
  if (!keyMaterial()) {
    // 鍵が無いのに暗号化データ → 復号できないが例外は投げず、そのまま返す
    return stored;
  }
  const raw = Buffer.from(stored.slice(PREFIX.length), "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const data = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
