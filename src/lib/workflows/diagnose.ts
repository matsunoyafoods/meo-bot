import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { StoreRow } from "@/lib/supabase/database.types";
import { findPlaceId, getPlaceSnapshot } from "@/lib/google/places";
import { diagnoseMeo, type MeoDiagnosis } from "@/lib/gemini/client";
import { toStoreContext } from "@/lib/store-context";
import { sendMessage } from "@/lib/telegram/client";
import { t } from "@/lib/telegram/i18n";

const IMPACT_MARK: Record<string, string> = { high: "🔴", medium: "🟡", low: "⚪" };

/**
 * 機能⑦: MEO診断。
 * 店舗の Google マップ現状（Places API）を取得 → Gemini が改善提案 → Telegram 配信。
 */
export async function runDiagnosis(store: StoreRow): Promise<void> {
  if (!store.telegram_chat_id) return;
  const chatId = store.telegram_chat_id;
  const lang = store.owner_lang;

  await sendMessage(chatId, t(lang, "diagnose_running"));

  // 1) place_id を解決（キャッシュ優先。無ければ店名＋地域でテキスト検索）
  let placeId = store.google_place_id;
  if (!placeId) {
    const query = `${store.name ?? ""} Phnom Penh Cambodia`.trim();
    placeId = await findPlaceId(query);
    if (placeId) {
      const supabase = createSupabaseAdminClient();
      await supabase.from("stores").update({ google_place_id: placeId }).eq("id", store.id);
    }
  }
  if (!placeId) {
    await sendMessage(chatId, t(lang, "diagnose_not_found"));
    return;
  }

  // 2) 現状スナップショット取得 → 3) Gemini 診断
  const snapshot = await getPlaceSnapshot(placeId);
  const diag = await diagnoseMeo(toStoreContext(store), snapshot, lang);

  await sendMessage(chatId, formatDiagnosis(lang, diag, snapshot.name));
}

function formatDiagnosis(
  lang: StoreRow["owner_lang"],
  d: MeoDiagnosis,
  placeName: string,
): string {
  const lines: string[] = [
    `<b>${t(lang, "diagnose_title")}</b>`,
    placeName ? `<i>${escapeHtml(placeName)}</i>` : "",
    `${t(lang, "diagnose_score")}: <b>${d.score}/100</b>`,
    `${escapeHtml(d.headline ?? "")}`,
    "",
  ];

  if (d.good?.length) {
    lines.push(`<b>${t(lang, "diagnose_good")}</b>`);
    for (const g of d.good) lines.push(`• ${escapeHtml(g)}`);
    lines.push("");
  }

  if (d.improve?.length) {
    lines.push(`<b>${t(lang, "diagnose_improve")}</b>`);
    for (const im of d.improve) {
      const mark = IMPACT_MARK[im.impact] ?? "•";
      lines.push(`${mark} <b>${escapeHtml(im.title)}</b>`);
      lines.push(`   ${escapeHtml(im.action)}`);
    }
  }

  return lines.filter((l) => l !== undefined).join("\n");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
