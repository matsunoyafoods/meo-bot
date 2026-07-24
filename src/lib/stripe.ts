import Stripe from "stripe";
import { env } from "@/lib/env";
import type { StoreRow, OwnerLang } from "@/lib/supabase/database.types";

/** 店舗の言語 → Stripe Checkout の表示言語（クメール語は未対応のため auto） */
function checkoutLocale(lang: OwnerLang): Stripe.Checkout.SessionCreateParams.Locale {
  switch (lang) {
    case "ja":
      return "ja";
    case "zh":
      return "zh";
    case "en":
      return "en";
    default:
      return "auto";
  }
}

let cached: Stripe | null = null;

/** Stripe クライアント（サーバー専用） */
export function stripe(): Stripe {
  if (!cached) cached = new Stripe(env.stripeSecretKey());
  return cached;
}

/** Stripe が設定済みか（未設定なら課金機能は無効にする） */
export function stripeConfigured(): boolean {
  return Boolean(env.stripeSecretKey() && env.stripePriceId());
}

/**
 * 店舗用の Checkout（月額サブスク）URLを作成。
 * 既存の無料期限が未来なら、その日まで無料（Stripeのtrial_end）にして二重無料を防ぐ。
 */
export async function createSubscribeUrl(store: StoreRow): Promise<string | null> {
  // Telegram / LINE どちらのチャネルでも可（宛先は store.id で紐付け）
  if (!stripeConfigured() || (!store.telegram_chat_id && !store.line_user_id)) return null;
  const s = stripe();

  const nowSec = Math.floor(Date.now() / 1000);
  const trialEndSec = store.trial_ends_at
    ? Math.floor(new Date(store.trial_ends_at).getTime() / 1000)
    : 0;
  // 無料期間が2日以上残っている場合のみ Stripe 側のトライアルを設定（残りをそのまま無料に）
  const useTrial = trialEndSec > nowSec + 2 * 86400;

  // 店舗の言語が日本語（owner_lang === "ja"）なら円建て価格を使う（未設定ならUSD価格にフォールバック）
  const priceId =
    store.owner_lang === "ja" && env.stripePriceIdJpy()
      ? env.stripePriceIdJpy()
      : env.stripePriceId();

  const session = await s.checkout.sessions.create({
    mode: "subscription",
    locale: checkoutLocale(store.owner_lang),
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: store.id,
    ...(store.stripe_customer_id ? { customer: store.stripe_customer_id } : {}),
    subscription_data: {
      metadata: { store_id: store.id },
      ...(useTrial ? { trial_end: trialEndSec } : {}),
    },
    metadata: { store_id: store.id },
    allow_promotion_codes: true,
    success_url: `${env.appUrl}/api/stripe/done`,
    cancel_url: `${env.appUrl}/api/stripe/done?canceled=1`,
  });
  return session.url;
}

/**
 * 契約管理（解約・カード変更）用の Customer Portal URL を作成。
 * まだ顧客IDが無ければ null。
 */
export async function createPortalUrl(store: StoreRow): Promise<string | null> {
  if (!stripeConfigured() || !store.stripe_customer_id) return null;
  const s = stripe();
  const session = await s.billingPortal.sessions.create({
    customer: store.stripe_customer_id,
    return_url: `${env.appUrl}/api/stripe/done`,
  });
  return session.url;
}
