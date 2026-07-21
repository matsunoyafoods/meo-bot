import { OAuth2Client } from "google-auth-library";
import { env } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { encryptSecret, decryptSecret, isEncrypted } from "@/lib/crypto";
import type { GoogleTokenRow } from "@/lib/supabase/database.types";

/**
 * Google Business Profile を操作するのに必要なスコープ。
 * 口コミ返信・投稿・インサイトはすべて "business.manage" 配下。
 */
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/business.manage",
  "openid",
  "email",
];

export function oauthClient(): OAuth2Client {
  return new OAuth2Client({
    clientId: env.googleClientId(),
    clientSecret: env.googleClientSecret(),
    redirectUri: env.googleOAuthRedirectUri(),
  });
}

/** 認証URLを生成（state で Telegram chat と突き合わせる） */
export function buildAuthUrl(state: string): string {
  return oauthClient().generateAuthUrl({
    access_type: "offline", // refresh_token を得るために必須
    prompt: "consent", // 毎回 refresh_token を確実に得る
    scope: GOOGLE_SCOPES,
    state,
    include_granted_scopes: true,
  });
}

/** 認可コード → トークン。DB へ保存して store_id を返す。 */
export async function exchangeCodeAndStore(
  code: string,
  storeId: string,
): Promise<void> {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);

  const supabase = createSupabaseAdminClient();
  const row: Partial<GoogleTokenRow> = {
    store_id: storeId,
    access_token: encryptSecret(tokens.access_token ?? ""),
    // refresh_token は初回同意時のみ返る。既存があれば維持する。
    ...(tokens.refresh_token ? { refresh_token: encryptSecret(tokens.refresh_token) } : {}),
    scope: tokens.scope ?? GOOGLE_SCOPES.join(" "),
    token_type: tokens.token_type ?? "Bearer",
    expiry: new Date(tokens.expiry_date ?? Date.now() + 3300 * 1000).toISOString(),
  };

  await supabase.from("google_tokens").upsert(row, { onConflict: "store_id" });
}

/**
 * store の access_token を返す。失効していれば refresh_token で更新して保存。
 */
export async function getFreshAccessToken(storeId: string): Promise<string> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("google_tokens")
    .select("*")
    .eq("store_id", storeId)
    .single<GoogleTokenRow>();

  if (error || !data) {
    throw new Error(`No Google token for store ${storeId}`);
  }

  // 保存値は暗号化されている場合がある（平文の旧データはそのまま返る）
  const accessToken = decryptSecret(data.access_token ?? "");
  const refreshToken = data.refresh_token ? decryptSecret(data.refresh_token) : "";

  const notExpired = new Date(data.expiry).getTime() - 60_000 > Date.now();
  if (notExpired && accessToken) {
    // 旧・平文の refresh_token が残っていれば、この機会に暗号化へ移行しておく
    if (data.refresh_token && !isEncrypted(data.refresh_token)) {
      await supabase
        .from("google_tokens")
        .update({ refresh_token: encryptSecret(refreshToken) })
        .eq("store_id", storeId);
    }
    return accessToken;
  }

  if (!refreshToken) {
    throw new Error(`Access token expired and no refresh_token for store ${storeId}`);
  }

  const client = oauthClient();
  client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await client.refreshAccessToken();

  const newToken = credentials.access_token;
  if (!newToken) throw new Error("Failed to refresh Google access token");

  await supabase
    .from("google_tokens")
    .update({
      access_token: encryptSecret(newToken),
      // 平文だった refresh_token もここで暗号化に揃える
      refresh_token: encryptSecret(refreshToken),
      expiry: new Date(credentials.expiry_date ?? Date.now() + 3300 * 1000).toISOString(),
    })
    .eq("store_id", storeId);

  return newToken;
}
