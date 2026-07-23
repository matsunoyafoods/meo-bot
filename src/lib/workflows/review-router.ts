import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  ReviewRow,
  ReviewInsert,
  StoreRow,
} from "@/lib/supabase/database.types";
import {
  listReviews,
  replyToReview,
  starToNumber,
  type GbpReview,
} from "@/lib/google/business";
import {
  generateReviewReply,
  translateReviewForOwner,
  translateOwnerEditToReply,
} from "@/lib/gemini/client";
import { toStoreContext } from "@/lib/store-context";
import { getReview } from "@/lib/repo";
import { deliverToStore, storeHasChannel } from "@/lib/messaging/deliver";
import { t, langName } from "@/lib/telegram/i18n";
import { langLabel } from "@/lib/gemini/prompts";

/**
 * 機能②③ の中核。
 * 新着口コミを取得 → 星に関わらず、全てオーナー承認フロー（確認/編集/送信）へ。
 */
export async function processNewReviews(store: StoreRow): Promise<void> {
  if (!store.google_account_id || !store.google_location_id) return;

  const supabase = createSupabaseAdminClient();
  const reviews = await listReviews(
    store.id,
    store.google_account_id,
    store.google_location_id,
  );

  // 既知の口コミIDを除外
  const { data: known } = await supabase
    .from("reviews")
    .select("google_review_id")
    .eq("store_id", store.id);
  const knownIds = new Set((known ?? []).map((r) => r.google_review_id));

  for (const r of reviews) {
    const gid = r.reviewId || r.name;
    if (!gid || knownIds.has(gid)) continue;
    // すでに返信済み(reviewReply あり)の古い口コミは記録だけして飛ばす
    if (r.reviewReply) {
      await insertReview(store.id, r, "skipped");
      continue;
    }
    const stars = starToNumber(r.starRating);
    // 星に関わらず全ての口コミをオーナー承認フロー（確認/編集/送信）へ
    await handleReviewApproval(store, r, gid, stars);
  }
}

/* ---------- 全口コミ: オーナー承認フロー（確認/編集/送信） ---------- */
async function handleReviewApproval(
  store: StoreRow,
  r: GbpReview,
  gid: string,
  stars: number,
): Promise<void> {
  const ctx = toStoreContext(store);

  // 返信案（相手の言語）と、オーナー母国語への翻訳を並行生成
  const [{ review_lang, reply }, ownerTranslation] = await Promise.all([
    generateReviewReply(ctx, {
      starRating: stars,
      reviewerName: r.reviewer?.displayName,
      comment: r.comment,
    }),
    r.comment ? translateReviewForOwner(r.comment, store.owner_lang) : Promise.resolve(""),
  ]);

  const review = await insertReview(store.id, r, "awaiting_approval", {
    review_lang,
    draft_reply: reply,
    owner_translation: ownerTranslation,
    star_rating: stars,
  });

  if (storeHasChannel(store)) {
    await notifyOwnerLowStar(store, review, reply, ownerTranslation, review_lang);
  }
}

/** 星3以下の通知（原文 / 翻訳 / 返信案 + インラインボタン） */
export async function notifyOwnerLowStar(
  store: StoreRow,
  review: ReviewRow,
  reply: string,
  ownerTranslation: string,
  reviewLang: string,
): Promise<void> {
  const lang = store.owner_lang;
  const titleEmoji = review.star_rating >= 4 ? "⭐" : "⚠️";
  const text = [
    `<b>${titleEmoji} ${t(lang, "low_review_title", { stars: review.star_rating })}</b>`,
    "",
    `<b>${t(lang, "original")}:</b>`,
    escapeHtml(review.comment ?? "(no text)"),
    "",
    `<b>${t(lang, "translation", { lang: langName(lang) })}:</b>`,
    escapeHtml(ownerTranslation || "-"),
    "",
    `<b>${t(lang, "draft_reply", { lang: langLabel(reviewLang) })}:</b>`,
    escapeHtml(reply),
  ].join("\n");

  await deliverToStore(store, text, [
    [
      { text: t(lang, "btn_send"), data: `rev_send:${review.id}` },
      { text: t(lang, "btn_edit"), data: `rev_edit:${review.id}` },
    ],
    [{ text: t(lang, "btn_skip_review"), data: `rev_skip:${review.id}` }],
  ]);
}

/* ---------- 口コミ返信アクション（Telegram/LINE 共通） ---------- */

/** GBP のフルパスを組み立てる（reviews.google_review_id が末尾のみの場合に対応） */
export function resolveReviewName(store: StoreRow, review: ReviewRow): string {
  if (review.google_review_id.startsWith("accounts/")) return review.google_review_id;
  const acc = store.google_account_id!.startsWith("accounts/")
    ? store.google_account_id!
    : `accounts/${store.google_account_id}`;
  const loc = store.google_location_id!.startsWith("locations/")
    ? store.google_location_id!
    : `locations/${store.google_location_id}`;
  return `${acc}/${loc}/reviews/${review.google_review_id}`;
}

/** 下書き返信をGoogleへ送信し、status を replied に更新。成功なら true。 */
export async function sendReviewReply(
  store: StoreRow,
  reviewId: string,
): Promise<boolean> {
  const review = await getReview(reviewId);
  if (!review || !review.draft_reply) return false;
  try {
    await replyToReview(store.id, resolveReviewName(store, review), review.draft_reply);
  } catch (e) {
    console.error("[reviews] sendReviewReply failed", e);
    return false;
  }
  const supabase = createSupabaseAdminClient();
  await supabase
    .from("reviews")
    .update({ status: "replied", replied_at: new Date().toISOString() })
    .eq("id", reviewId);
  return true;
}

/**
 * オーナーの編集文を相手の言語の返信に変換して下書きを差し替え、
 * 編集後プレビュー＋[送信][編集] ボタンを配信する（Telegram/LINE 共通）。
 */
export async function reviseReviewAndPreview(
  store: StoreRow,
  reviewId: string,
  ownerText: string,
): Promise<void> {
  const lang = store.owner_lang;
  const review = await getReview(reviewId);
  if (!review) {
    await deliverToStore(store, t(lang, "error"));
    return;
  }
  const reviewerLang = review.review_lang ?? "en";
  const reply = await translateOwnerEditToReply(
    toStoreContext(store),
    ownerText,
    reviewerLang,
  );

  const supabase = createSupabaseAdminClient();
  await supabase.from("reviews").update({ draft_reply: reply }).eq("id", reviewId);

  const preview = [
    `<b>${t(lang, "edit_preview", { lang: langLabel(reviewerLang) })}:</b>`,
    escapeHtml(reply),
  ].join("\n");
  await deliverToStore(store, preview, [
    [
      { text: t(lang, "btn_send"), data: `rev_send:${reviewId}` },
      { text: t(lang, "btn_edit"), data: `rev_edit:${reviewId}` },
    ],
  ]);
}

/* ---------- DB ヘルパ ---------- */
async function insertReview(
  storeId: string,
  r: GbpReview,
  status: ReviewRow["status"],
  extra: Partial<ReviewInsert> = {},
): Promise<ReviewRow> {
  const supabase = createSupabaseAdminClient();
  const insert: ReviewInsert = {
    store_id: storeId,
    google_review_id: r.reviewId || r.name,
    reviewer_name: r.reviewer?.displayName ?? null,
    star_rating: starToNumber(r.starRating) || 1,
    comment: r.comment ?? null,
    review_lang: null,
    status,
    draft_reply: null,
    owner_translation: null,
    replied_at: null,
    ...extra,
  };
  const { data, error } = await supabase
    .from("reviews")
    .upsert(insert, { onConflict: "store_id,google_review_id" })
    .select("*")
    .single<ReviewRow>();
  if (error || !data) throw new Error(`insertReview failed: ${error?.message}`);
  return data;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
