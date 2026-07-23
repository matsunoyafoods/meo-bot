import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ReviewRow, StoreRow } from "@/lib/supabase/database.types";
import {
  listReviews,
  replyToReview,
  starToNumber,
} from "@/lib/google/business";
import { generateReviewReply, translateReviewForOwner } from "@/lib/gemini/client";
import { toStoreContext } from "@/lib/store-context";
import { deliverToStore, storeHasChannel } from "@/lib/messaging/deliver";
import { notifyOwnerLowStar } from "@/lib/workflows/review-router";
import { t } from "@/lib/telegram/i18n";

/** 1回の実行で生成する上限（Vercel 60s / API 時間対策） */
const HIGH_CAP = 12;
const LOW_CAP = 8;

/**
 * 機能: 未返信口コミの一括処理（バックログ）。
 * /reviews → 未返信を取得・集計して、ハイブリッド処理の入口を出す。
 */
export async function startBacklog(store: StoreRow): Promise<void> {
  if (!storeHasChannel(store)) return;
  const lang = store.owner_lang;

  if (!store.google_account_id || !store.google_location_id) {
    return void (await deliverToStore(store, t(lang, "not_connected")));
  }

  const reviews = await listReviews(
    store.id,
    store.google_account_id,
    store.google_location_id,
  );
  const unreplied = reviews.filter((r) => !r.reviewReply && (r.reviewId || r.name));

  // 未返信を pending として登録（既存行は触らない）
  const supabase = createSupabaseAdminClient();
  for (const r of unreplied) {
    await supabase.from("reviews").upsert(
      {
        store_id: store.id,
        google_review_id: r.reviewId || r.name,
        reviewer_name: r.reviewer?.displayName ?? null,
        star_rating: starToNumber(r.starRating) || 1,
        comment: r.comment ?? null,
        status: "pending",
      },
      { onConflict: "store_id,google_review_id", ignoreDuplicates: true },
    );
  }

  const { high, low } = await countPending(store.id);
  if (high + low === 0) {
    return void (await deliverToStore(store, t(lang, "backlog_none")));
  }

  const buttons: { text: string; data: string }[][] = [];
  if (high > 0)
    buttons.push([{ text: t(lang, "backlog_btn_high", { n: high }), data: "bk_high" }]);
  if (low > 0)
    buttons.push([{ text: t(lang, "backlog_btn_low", { n: low }), data: "bk_low" }]);

  await deliverToStore(
    store,
    t(lang, "backlog_summary", { total: high + low, high, low }),
    buttons,
  );
}

/** 4-5★: 返信案をまとめて生成し、プレビュー＋「まとめて送信」を出す */
export async function generateHighStarDrafts(store: StoreRow): Promise<void> {
  const lang = store.owner_lang;
  const ctx = toStoreContext(store);
  const supabase = createSupabaseAdminClient();

  const { data: rows } = await supabase
    .from("reviews")
    .select("*")
    .eq("store_id", store.id)
    .eq("status", "pending")
    .gte("star_rating", 4)
    .limit(HIGH_CAP)
    .returns<ReviewRow[]>();
  const pend = rows ?? [];
  if (pend.length === 0) return void (await deliverToStore(store, t(lang, "backlog_none")));

  const done: ReviewRow[] = [];
  for (const rv of pend) {
    const { review_lang, reply } = await generateReviewReply(ctx, {
      starRating: rv.star_rating,
      reviewerName: rv.reviewer_name,
      comment: rv.comment,
    });
    const { data: updated } = await supabase
      .from("reviews")
      .update({ draft_reply: reply, review_lang, status: "awaiting_approval" })
      .eq("id", rv.id)
      .select("*")
      .single<ReviewRow>();
    if (updated) done.push(updated);
  }

  // プレビュー（最大8件）
  const preview = done
    .slice(0, 8)
    .map(
      (rv) =>
        `⭐${rv.star_rating} ${escapeHtml(rv.reviewer_name ?? "-")}: ${escapeHtml(
          (rv.draft_reply ?? "").slice(0, 80),
        )}`,
    )
    .join("\n");
  const more = done.length > 8 ? "\n…(+" + (done.length - 8) + ")" : "";

  await deliverToStore(
    store,
    `${t(lang, "backlog_high_ready", { n: done.length })}\n\n${preview}${more}`,
    [
      [{ text: t(lang, "backlog_btn_sendall"), data: "bk_sendall" }],
      [{ text: t(lang, "backlog_btn_oneby"), data: "bk_one" }],
    ],
  );
}

/** 4-5★: 生成済みドラフトを一括送信 */
export async function bulkSendHighStar(store: StoreRow): Promise<void> {
  const lang = store.owner_lang;
  const supabase = createSupabaseAdminClient();

  const { data: rows } = await supabase
    .from("reviews")
    .select("*")
    .eq("store_id", store.id)
    .eq("status", "awaiting_approval")
    .gte("star_rating", 4)
    .not("draft_reply", "is", null)
    .returns<ReviewRow[]>();
  const drafts = rows ?? [];

  let sent = 0;
  for (const rv of drafts) {
    try {
      await replyToReview(store.id, resolveReviewName(store, rv), rv.draft_reply!);
      await supabase
        .from("reviews")
        .update({ status: "replied", replied_at: new Date().toISOString() })
        .eq("id", rv.id);
      sent++;
    } catch (e) {
      console.error(`[backlog] send review ${rv.id} failed`, e);
    }
  }
  await deliverToStore(store, t(lang, "backlog_sent", { n: sent }));
}

/** 4-5★: 一括ではなく1件ずつ確認に切り替え */
export async function highStarOneByOne(store: StoreRow): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { data: rows } = await supabase
    .from("reviews")
    .select("*")
    .eq("store_id", store.id)
    .eq("status", "awaiting_approval")
    .gte("star_rating", 4)
    .not("draft_reply", "is", null)
    .returns<ReviewRow[]>();
  for (const rv of rows ?? []) {
    await notifyOwnerLowStar(
      store,
      rv,
      rv.draft_reply ?? "",
      rv.owner_translation ?? "",
      rv.review_lang ?? "en",
    );
  }
}

/** 1-3★: 1件ずつ（翻訳＋返信案＋[送信][編集][スキップ]）を順に表示 */
export async function pushLowStarQueue(store: StoreRow): Promise<void> {
  const lang = store.owner_lang;
  const ctx = toStoreContext(store);
  const supabase = createSupabaseAdminClient();

  const { data: rows } = await supabase
    .from("reviews")
    .select("*")
    .eq("store_id", store.id)
    .eq("status", "pending")
    .lte("star_rating", 3)
    .limit(LOW_CAP)
    .returns<ReviewRow[]>();
  const pend = rows ?? [];
  if (pend.length === 0) return void (await deliverToStore(store, t(lang, "backlog_none")));

  await deliverToStore(store, t(lang, "backlog_low_intro", { n: pend.length }));

  for (const rv of pend) {
    const [{ review_lang, reply }, translation] = await Promise.all([
      generateReviewReply(ctx, {
        starRating: rv.star_rating,
        reviewerName: rv.reviewer_name,
        comment: rv.comment,
      }),
      rv.comment ? translateReviewForOwner(rv.comment, lang) : Promise.resolve(""),
    ]);
    const { data: updated } = await supabase
      .from("reviews")
      .update({
        draft_reply: reply,
        review_lang,
        owner_translation: translation,
        status: "awaiting_approval",
      })
      .eq("id", rv.id)
      .select("*")
      .single<ReviewRow>();
    if (updated) await notifyOwnerLowStar(store, updated, reply, translation, review_lang);
  }

  const { low } = await countPending(store.id);
  if (low > 0) await deliverToStore(store, t(lang, "backlog_more", { n: low }));
}

/* ---------- helpers ---------- */
async function countPending(storeId: string): Promise<{ high: number; low: number }> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("reviews")
    .select("star_rating")
    .eq("store_id", storeId)
    .eq("status", "pending")
    .returns<{ star_rating: number }[]>();
  const rows = data ?? [];
  const high = rows.filter((r) => r.star_rating >= 4).length;
  return { high, low: rows.length - high };
}

function resolveReviewName(store: StoreRow, review: ReviewRow): string {
  if (review.google_review_id.startsWith("accounts/")) return review.google_review_id;
  const acc = store.google_account_id!.startsWith("accounts/")
    ? store.google_account_id!
    : `accounts/${store.google_account_id}`;
  const loc = store.google_location_id!.startsWith("locations/")
    ? store.google_location_id!
    : `locations/${store.google_location_id}`;
  return `${acc}/${loc}/reviews/${review.google_review_id}`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
