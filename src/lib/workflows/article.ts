import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PostRow, PostInsert, StoreRow } from "@/lib/supabase/database.types";
import { generateArticle } from "@/lib/gemini/client";
import { toStoreContext } from "@/lib/store-context";
import { createLocalPost } from "@/lib/google/business";
import { sendMessage } from "@/lib/telegram/client";
import { t } from "@/lib/telegram/i18n";

/** 記事テーマのローテーション（週3回ぶんの引き出し） */
const THEMES = [
  "the broth (スープ) simmered for hours",
  "the char siu / toppings (チャーシュー・具材) and how they are prepared",
  "the hospitality and atmosphere (接客・雰囲気)",
  "a seasonal or limited menu item",
  "the story behind a signature dish",
];

/** 曜日ベースで安定的にテーマを選ぶ（ランダム非依存） */
function pickTheme(seed: number): string {
  return THEMES[seed % THEMES.length];
}

/**
 * 機能④: 週3回、記事下書きを生成して Telegram に送る。
 */
export async function generateAndProposeArticle(store: StoreRow): Promise<void> {
  if (!store.telegram_chat_id) return;

  const supabase = createSupabaseAdminClient();
  const ctx = toStoreContext(store);

  const dayOfYear = Math.floor(Date.now() / 86_400_000);
  const theme = pickTheme(dayOfYear);

  const { topic, body_km, body_en } = await generateArticle(ctx, theme);

  const insert: PostInsert = {
    store_id: store.id,
    topic,
    body_km,
    body_en,
    status: "draft",
    google_post_name: null,
    published_at: null,
  };
  const { data: post, error } = await supabase
    .from("posts")
    .insert(insert)
    .select("*")
    .single<PostRow>();
  if (error || !post) throw new Error(`insert post failed: ${error?.message}`);

  const lang = store.owner_lang;
  const text = [
    `<b>${t(lang, "article_title")}</b>`,
    `<i>${escapeHtml(topic)}</i>`,
    "",
    "<b>ភាសាខ្មែរ (Khmer):</b>",
    escapeHtml(body_km),
    "",
    "<b>English:</b>",
    escapeHtml(body_en),
  ].join("\n");

  await sendMessage(store.telegram_chat_id, text, [
    [
      { text: t(lang, "btn_publish"), callback_data: `post_pub:${post.id}` },
      { text: t(lang, "btn_skip"), callback_data: `post_skip:${post.id}` },
    ],
  ]);
}

/** オーナーが「投稿する」を押したときに呼ぶ */
export async function publishPost(postId: string): Promise<PostRow> {
  const supabase = createSupabaseAdminClient();
  const { data: post } = await supabase
    .from("posts")
    .select("*")
    .eq("id", postId)
    .single<PostRow>();
  if (!post) throw new Error(`post ${postId} not found`);

  const { data: store } = await supabase
    .from("stores")
    .select("*")
    .eq("id", post.store_id)
    .single<StoreRow>();
  if (!store?.google_account_id || !store.google_location_id) {
    throw new Error("store not connected to Google");
  }

  // クメール語本文を優先して投稿（英語併記でも可。PoC は1言語投稿）
  const summary = post.body_km || post.body_en || post.topic || "";
  const created = await createLocalPost(
    store.id,
    store.google_account_id,
    store.google_location_id,
    summary,
  );

  const { data: updated } = await supabase
    .from("posts")
    .update({
      status: "published",
      google_post_name: created.name,
      published_at: new Date().toISOString(),
    })
    .eq("id", postId)
    .select("*")
    .single<PostRow>();
  return updated!;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
