import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { exchangeCodeAndStore } from "@/lib/google/oauth";
import { listAccounts, listLocations } from "@/lib/google/business";
import { ensureStoreForChat } from "@/lib/repo";
import { sendMessage } from "@/lib/telegram/client";
import { t } from "@/lib/telegram/i18n";
import type { StoreRow } from "@/lib/supabase/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Google OAuth のリダイレクト先 */
export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) return html(`連携がキャンセルされました (${error})。Telegramに戻ってやり直してください。`);
  if (!code || !state) return html("不正なリクエストです。");

  const supabase = createSupabaseAdminClient();

  // state → chat_id
  const { data: st } = await supabase
    .from("oauth_states")
    .select("telegram_chat_id")
    .eq("state", state)
    .maybeSingle<{ telegram_chat_id: number }>();
  if (!st) return html("認証セッションが無効か期限切れです。/start からやり直してください。");

  const chatId = st.telegram_chat_id;
  const store = await ensureStoreForChat(chatId);

  try {
    // 1) トークン交換 + 保存
    await exchangeCodeAndStore(code, store.id);

    // 2) アカウント/ロケーションを取得して先頭を紐づけ（PoC）
    const accounts = await listAccounts(store.id);
    const account = accounts[0];
    let locationName: string | null = null;
    let storeName = store.name;
    if (account) {
      const locations = await listLocations(store.id, account.name);
      const loc = locations[0];
      if (loc) {
        locationName = loc.name;
        storeName = loc.title ?? storeName;
      }
    }

    const patch: Partial<StoreRow> = {
      google_account_id: account?.name ?? null,
      google_location_id: locationName,
      name: storeName || store.name,
      onboarded: Boolean(account && locationName),
    };
    await supabase.from("stores").update(patch).eq("id", store.id);

    // 3) 使い終わった state を削除
    await supabase.from("oauth_states").delete().eq("state", state);

    // 4) Telegram に完了通知
    await sendMessage(chatId, t(store.owner_lang, "connected"));

    return html("✅ 連携が完了しました。Telegramに戻ってください。");
  } catch (e) {
    console.error("[oauth] callback error", e);
    return html("連携処理でエラーが発生しました。時間をおいて /start からやり直してください。");
  }
}

function html(message: string): NextResponse {
  return new NextResponse(
    `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MEO Bot</title></head><body style="font-family:sans-serif;max-width:480px;margin:40px auto;padding:0 16px;text-align:center"><p style="font-size:18px">${message}</p></body></html>`,
    { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}
