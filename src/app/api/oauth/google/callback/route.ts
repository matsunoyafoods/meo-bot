import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { exchangeCodeAndStore } from "@/lib/google/oauth";
import { listAccounts, listLocations } from "@/lib/google/business";
import { ensureStoreForChat, ensureStoreForLineUser } from "@/lib/repo";
import { deliverToStore } from "@/lib/messaging/deliver";
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

  if (error) {
    // error はクエリ由来（攻撃者が操作可能）なので、安全な文字だけに制限してから表示（反射型XSS対策）
    const safeError = error.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
    return html(`連携がキャンセルされました (${safeError})。Telegramに戻ってやり直してください。`);
  }
  if (!code || !state) return html("不正なリクエストです。");

  const supabase = createSupabaseAdminClient();

  // state → チャネル（Telegram / LINE）
  const { data: st } = await supabase
    .from("oauth_states")
    .select("telegram_chat_id, platform, line_user_id")
    .eq("state", state)
    .maybeSingle<{ telegram_chat_id: number | null; platform: string | null; line_user_id: string | null }>();
  if (!st) return html("認証セッションが無効か期限切れです。連携をやり直してください。");

  const store =
    st.platform === "line" && st.line_user_id
      ? await ensureStoreForLineUser(st.line_user_id)
      : await ensureStoreForChat(st.telegram_chat_id as number);

  // 1) トークン交換 + 保存（必須。ここが失敗したら本当のエラー）
  try {
    await exchangeCodeAndStore(code, store.id);
  } catch (e) {
    console.error("[oauth] token exchange error", e);
    return html("連携処理でエラーが発生しました。時間をおいて /start からやり直してください。");
  }

  // 使い終わった state は削除（トークンは保存済みなので、この先で失敗しても再連携は /start から可）
  await supabase.from("oauth_states").delete().eq("state", state);

  // 2) アカウント/ロケーション取得（Google Business Profile API の割り当てが必要）
  //    quota 未承認だと 429/403 になる。その場合でもトークンは保存済みなので
  //    「ログイン完了・店舗接続は承認後」として成功扱いにする（承認後に再連携で店舗が付く）。
  let locationLinked = false;
  try {
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
    if (account && locationName) {
      const patch: Partial<StoreRow> = {
        google_account_id: account.name,
        google_location_id: locationName,
        name: storeName || store.name,
        onboarded: true,
      };
      await supabase.from("stores").update(patch).eq("id", store.id);
      locationLinked = true;
    }
  } catch (e) {
    console.warn(
      "[oauth] listAccounts/listLocations skipped (likely GBP quota not granted yet)",
      e,
    );
  }

  // 3) チャネルへ通知（Telegram / LINE）
  try {
    await deliverToStore(
      store,
      locationLinked
        ? t(store.owner_lang, "connected")
        : "✅ Googleログインが完了しました。\n店舗データの接続は、Google Business Profile API の利用が承認され次第、自動で有効になります（現在は申請/審査待ちの状態です）。",
    );
  } catch (e) {
    console.error("[oauth] notify error", e);
  }

  return html(
    locationLinked
      ? "✅ 連携が完了しました。Telegramに戻ってください。"
      : "✅ Googleログイン完了。店舗接続はAPI利用承認後に有効になります。Telegramに戻ってください。",
  );
}

function html(message: string): NextResponse {
  return new NextResponse(
    `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MEO Bot</title></head><body style="font-family:sans-serif;max-width:480px;margin:40px auto;padding:0 16px;text-align:center"><p style="font-size:18px">${message}</p></body></html>`,
    { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}
