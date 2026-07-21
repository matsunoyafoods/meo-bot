import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { StoreRow } from "@/lib/supabase/database.types";
import { listAccounts, listLocations } from "@/lib/google/business";
import { sendMessage } from "@/lib/telegram/client";
import { t } from "@/lib/telegram/i18n";

/**
 * GBP APIクォータ承認後の自動接続。
 * 「Google連携済み（トークンあり）だが、まだ店舗データ未接続(onboarded=false)」の
 * 店舗を毎日チェックし、承認が下りていればアカウント/ロケーションを取得して
 * 接続完了 + Telegram通知する（オーナーの手間ゼロ）。
 *
 * クォータ未承認の間は listAccounts が 429/403 になるので、そのままスキップ（再試行）。
 * onboarded=true になった店舗は次回以降の対象から自動的に外れる（通知は一度きり）。
 */
export async function linkPendingStores(): Promise<{ checked: number; linked: number }> {
  const supabase = createSupabaseAdminClient();

  // トークンを持つ store_id 一覧（＝一度はGoogle連携した店舗）
  const { data: tokens } = await supabase
    .from("google_tokens")
    .select("store_id")
    .returns<{ store_id: string }[]>();
  const tokenStoreIds = new Set((tokens ?? []).map((r) => r.store_id));
  if (tokenStoreIds.size === 0) return { checked: 0, linked: 0 };

  // まだ未接続の店舗
  const { data: stores } = await supabase
    .from("stores")
    .select("*")
    .eq("onboarded", false)
    .returns<StoreRow[]>();

  let checked = 0;
  let linked = 0;
  for (const store of stores ?? []) {
    if (!store.telegram_chat_id) continue;
    if (!tokenStoreIds.has(store.id)) continue; // 連携していない店舗は対象外
    checked++;
    try {
      const accounts = await listAccounts(store.id);
      const account = accounts[0];
      if (!account) continue;
      const locations = await listLocations(store.id, account.name);
      const loc = locations[0];
      if (!loc) continue;

      await supabase
        .from("stores")
        .update({
          google_account_id: account.name,
          google_location_id: loc.name,
          name: loc.title ?? store.name,
          onboarded: true,
        })
        .eq("id", store.id);
      linked++;

      try {
        await sendMessage(store.telegram_chat_id, t(store.owner_lang, "connection_ready"));
      } catch (e) {
        console.error(`[reconcile] notify ${store.id} failed`, e);
      }
    } catch (e) {
      // クォータ未承認 or 一時的エラー → スキップ（翌日再試行）
      console.warn(`[reconcile] store ${store.id} still pending`, (e as Error).message);
    }
  }
  return { checked, linked };
}
