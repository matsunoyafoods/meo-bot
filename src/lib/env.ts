/**
 * 環境変数の一元管理。
 * サーバー専用の値ばかりなので、クライアントからは import しないこと。
 */

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.length === 0) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const env = {
  appUrl: optional("NEXT_PUBLIC_APP_URL", "http://localhost:3000").replace(/\/$/, ""),

  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseServiceRoleKey: () => required("SUPABASE_SERVICE_ROLE_KEY"),

  telegramBotToken: () => required("TELEGRAM_BOT_TOKEN"),
  telegramWebhookSecret: () => required("TELEGRAM_WEBHOOK_SECRET"),

  googleClientId: () => required("GOOGLE_CLIENT_ID"),
  googleClientSecret: () => required("GOOGLE_CLIENT_SECRET"),
  googleOAuthRedirectUri: () =>
    optional("GOOGLE_OAUTH_REDIRECT_URI", `${env.appUrl}/api/oauth/google/callback`),

  geminiApiKey: () => required("GEMINI_API_KEY"),
  geminiModel: () => optional("GEMINI_MODEL", "gemini-2.5-flash"),

  cronSecret: () => required("CRON_SECRET"),

  adminPassword: () => required("ADMIN_PASSWORD"),

  // Googleトークン等の機微データをアプリ側で暗号化する鍵。
  // 未設定でもアプリは動く（暗号化は無効・平文のまま）が、本番では必ず設定する。
  // ※一度設定したら変更・削除しないこと（既存の暗号化データが復号できなくなる）。
  encryptionKey: () => optional("ENCRYPTION_KEY", ""),

  // MEO診断: Places API (New) 用のAPIキー
  googleMapsApiKey: () => required("GOOGLE_MAPS_API_KEY"),

  // 運用アラートの通知先（管理者=TomのTelegram chat_id）。
  // 未設定なら通知は送らない。/id コマンドで自分のIDを確認できる。
  adminTelegramChatId: () => optional("ADMIN_TELEGRAM_CHAT_ID", ""),

  // Stripe（サブスク課金）。未設定でもアプリは動く（課金機能だけ無効）。
  stripeSecretKey: () => optional("STRIPE_SECRET_KEY", ""),
  stripeWebhookSecret: () => optional("STRIPE_WEBHOOK_SECRET", ""),
  stripePriceId: () => optional("STRIPE_PRICE_ID", ""),

  // LINE（Messaging API）。未設定でもアプリは動く（LINE連携だけ無効）。
  // 日本市場向けにTelegramと並行提供する。
  // 貼り付け時に混入しがちな空白・改行を除去（Authorizationヘッダで空白があると401になるため）。
  lineChannelAccessToken: () => optional("LINE_CHANNEL_ACCESS_TOKEN", "").replace(/\s+/g, ""),
  lineChannelSecret: () => optional("LINE_CHANNEL_SECRET", "").replace(/\s+/g, ""),
} as const;
