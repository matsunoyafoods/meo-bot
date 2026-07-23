import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PostRow, PostInsert, StoreRow } from "@/lib/supabase/database.types";
import { generateArticle, reviseArticle } from "@/lib/gemini/client";
import { langLabel } from "@/lib/gemini/prompts";
import { toStoreContext } from "@/lib/store-context";
import { createLocalPost } from "@/lib/google/business";
import { deliverToStore, storeHasChannel } from "@/lib/messaging/deliver";
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

interface PostLangConfig {
  /** 生成する言語 */
  langs: string[];
  /**
   * true = 全言語を1つの投稿にまとめて公開（国旗見出し付き）。body_km に結合文を格納。
   * false = 言語ごとに別スロット（body_km=主, body_en=副）。
   */
  combined: boolean;
}

/**
 * 店舗の市場に応じた「Google公開言語」設定を返す。
 * - LINE（日本市場）: 日本語・英語・中国語・韓国語を1投稿に併記（国旗で区切る）
 * - Telegram（カンボジア市場）: クメール語 + 英語（言語ごとに別スロット）
 */
export function postConfigForStore(store: Pick<StoreRow, "platform">): PostLangConfig {
  return store.platform === "line"
    ? { langs: ["ja", "en", "zh", "ko"], combined: true }
    : { langs: ["km", "en"], combined: false };
}

const LANG_FLAG: Record<string, string> = {
  ja: "🇯🇵",
  en: "🇺🇸",
  zh: "🇨🇳",
  ko: "🇰🇷",
  km: "🇰🇭",
};
const LANG_NATIVE: Record<string, string> = {
  ja: "日本語",
  en: "English",
  zh: "中文",
  ko: "한국어",
  km: "ភាសាខ្មែរ",
};

/** 各言語版を国旗見出し＋改行で1つの投稿本文に結合（そのままGoogleへ公開） */
function assembleCombined(posts: Record<string, string>, langs: string[]): string {
  return langs
    .map(
      (l) =>
        `${LANG_FLAG[l] ?? ""} ${LANG_NATIVE[l] ?? l}\n${(posts[l] ?? "").trim()}`,
    )
    .join("\n\n");
}

/** 生成結果(posts)を DBの2スロットへ割り当てる（combinedなら body_km に結合投稿） */
function bodiesFromPosts(
  posts: Record<string, string>,
  cfg: PostLangConfig,
): { body_km: string; body_en: string | null } {
  if (cfg.combined) {
    return { body_km: assembleCombined(posts, cfg.langs), body_en: null };
  }
  return {
    body_km: posts[cfg.langs[0]] ?? "",
    body_en: cfg.langs[1] ? (posts[cfg.langs[1]] ?? "") : null,
  };
}

/** 既存下書き（DBの2スロット）を、編集プロンプトに渡す current_posts へ復元 */
function currentPostsFor(post: PostRow, cfg: PostLangConfig): Record<string, string> {
  if (cfg.combined) {
    // 結合文には全言語が含まれるので、そのまま現状として渡す。
    return { current: post.body_km ?? "" };
  }
  const cur: Record<string, string> = {};
  cur[cfg.langs[0]] = post.body_km ?? "";
  if (cfg.langs[1]) cur[cfg.langs[1]] = post.body_en ?? "";
  return cur;
}

/**
 * 機能④: 週3回、記事下書きを生成して Telegram に送る（テーマは自動ローテーション）。
 */
export async function generateAndProposeArticle(store: StoreRow): Promise<void> {
  const dayOfYear = Math.floor(Date.now() / 86_400_000);
  await proposeArticle(store, pickTheme(dayOfYear));
}

/**
 * 指定テーマ/キーワードで記事下書きを生成して Telegram に送る（共通処理）。
 * - 定期投稿（ローテーションテーマ）
 * - オンデマンド投稿（オーナーが入力したキーワード）
 * の両方で使う。
 */
export async function proposeArticle(store: StoreRow, theme: string): Promise<void> {
  if (!storeHasChannel(store)) return;

  const supabase = createSupabaseAdminClient();
  const ctx = toStoreContext(store);
  const lang = store.owner_lang;
  const cfg = postConfigForStore(store);

  const { topic, posts, body_owner } = await generateArticle(
    ctx,
    theme,
    lang,
    cfg.langs,
  );
  const { body_km, body_en } = bodiesFromPosts(posts, cfg);

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

  await sendPostDraft(store, post, body_owner);
}

/**
 * ④-b: オーナーの編集指示で既存の下書きを作り直し、再度確認を送る。
 */
export async function reviseArticlePost(
  store: StoreRow,
  postId: string,
  instruction: string,
): Promise<void> {
  if (!storeHasChannel(store)) return;
  const supabase = createSupabaseAdminClient();
  const { data: post } = await supabase
    .from("posts")
    .select("*")
    .eq("id", postId)
    .single<PostRow>();
  if (!post) throw new Error(`post ${postId} not found`);

  const ctx = toStoreContext(store);
  const cfg = postConfigForStore(store);
  const currentPosts = currentPostsFor(post, cfg);

  const { topic, posts, body_owner } = await reviseArticle(
    ctx,
    { currentPosts, instruction },
    store.owner_lang,
    cfg.langs,
  );
  const { body_km, body_en } = bodiesFromPosts(posts, cfg);

  const { data: updated } = await supabase
    .from("posts")
    .update({ topic, body_km, body_en, status: "draft" })
    .eq("id", postId)
    .select("*")
    .single<PostRow>();

  await sendPostDraft(store, updated ?? post, body_owner);
}

/** 下書き本文（母国語＋km＋en）＋確認ボタンを Telegram に送る共通処理 */
async function sendPostDraft(
  store: StoreRow,
  post: PostRow,
  bodyOwner: string,
): Promise<void> {
  if (!storeHasChannel(store)) return;
  const lang = store.owner_lang;
  const cfg = postConfigForStore(store);

  let bodyBlocks: string[];
  let ownerBlock: string[] = [];

  if (cfg.combined) {
    // body_km に国旗見出し付きの結合投稿が入っている。公開される内容そのままを表示。
    bodyBlocks = [escapeHtml(post.body_km ?? "")];
  } else {
    // 言語ごとにラベル付きで表示（body_km=主, body_en=副）。
    const bodies = [post.body_km, post.body_en];
    bodyBlocks = [];
    cfg.langs.forEach((code, i) => {
      const body = bodies[i];
      if (!body) return;
      bodyBlocks.push(`<b>${langLabel(code)}:</b>`, escapeHtml(body), "");
    });
    // オーナー母国語版：公開言語に含まれない場合のみ確認用に先頭表示。
    if (bodyOwner && !cfg.langs.includes(lang)) {
      ownerBlock = [`<b>${langLabel(lang)}:</b>`, escapeHtml(bodyOwner), ""];
    }
  }

  const text = [
    `<b>${t(lang, "article_title")}</b>`,
    `<i>${escapeHtml(post.topic ?? "")}</i>`,
    "",
    ...ownerBlock,
    ...bodyBlocks,
  ]
    .join("\n")
    .trimEnd();

  await deliverToStore(store, text, [
    [{ text: t(lang, "btn_publish"), data: `post_pub:${post.id}` }],
    [
      { text: t(lang, "btn_edit"), data: `post_edit:${post.id}` },
      { text: t(lang, "btn_skip"), data: `post_skip:${post.id}` },
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
