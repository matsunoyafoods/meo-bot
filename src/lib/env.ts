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
} as const;
