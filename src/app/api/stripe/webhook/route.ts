import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { deliverToStore, storeHasChannel } from "@/lib/messaging/deliver";
import { t } from "@/lib/telegram/i18n";
import type { StoreRow } from "@/lib/supabase/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Supa = ReturnType<typeof createSupabaseAdminClient>;

export async function POST(req: Request): Promise<NextResponse> {
  const secret = env.stripeWebhookSecret();
  const sig = req.headers.get("stripe-signature");
  if (!secret || !sig) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // 署名検証には「生ボディ」が必須（パース前の文字列）
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(raw, sig, secret);
  } catch (e) {
    console.error("[stripe] signature verify failed", (e as Error).message);
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  // 冪等性: 既に処理済みなら何もしない（重複配信対策）
  const { data: seen } = await supabase
    .from("processed_stripe_events")
    .select("event_id")
    .eq("event_id", event.id)
    .maybeSingle<{ event_id: string }>();
  if (seen) return NextResponse.json({ ok: true, duplicate: true });

  try {
    await handleEvent(event, supabase);
  } catch (e) {
    // 失敗時はマークせず 500 を返す → Stripe が再送（各処理は冪等なので再実行OK）
    console.error("[stripe] handle event error", event.type, e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  await supabase.from("processed_stripe_events").insert({ event_id: event.id });
  return NextResponse.json({ ok: true });
}

async function handleEvent(event: Stripe.Event, supabase: Supa): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const storeId = session.client_reference_id || session.metadata?.store_id;
      if (!storeId) return;
      const customerId = idOf(session.customer);
      const subId = idOf(session.subscription);
      const patch: Partial<StoreRow> = { status: "active" };
      if (customerId) patch.stripe_customer_id = customerId;
      if (subId) patch.stripe_subscription_id = subId;
      if (subId) {
        const sub = await stripe().subscriptions.retrieve(subId);
        patch.trial_ends_at = new Date(subPeriodEnd(sub) * 1000).toISOString();
        patch.trial_notify_stage = 0;
      }
      await supabase.from("stores").update(patch).eq("id", storeId);
      await notify(supabase, storeId, "subscribed_ok");
      return;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = invoiceSubId(invoice);
      if (subId) await syncSubscription(subId, supabase, true);
      return;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      await syncSubscription(sub.id, supabase, false);
      return;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      // 解約: 支払い済み期間の末日まで利用可（その後は自動停止）
      await supabase
        .from("stores")
        .update({ trial_ends_at: new Date(subPeriodEnd(sub) * 1000).toISOString() })
        .eq("stripe_subscription_id", sub.id);
      return;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = invoiceSubId(invoice);
      if (subId) {
        const { data: store } = await supabase
          .from("stores")
          .select("*")
          .eq("stripe_subscription_id", subId)
          .maybeSingle<StoreRow>();
        if (store && storeHasChannel(store)) {
          try {
            await deliverToStore(store, t(store.owner_lang, "payment_failed"));
          } catch (e) {
            console.error("[stripe] payment_failed notify", e);
          }
        }
      }
      return;
    }
  }
}

/** サブスクの現在の期間末を店舗の利用期限に反映する */
async function syncSubscription(subId: string, supabase: Supa, notifyStore: boolean): Promise<void> {
  const sub = await stripe().subscriptions.retrieve(subId);
  const untilIso = new Date(subPeriodEnd(sub) * 1000).toISOString();
  const active = sub.status === "active" || sub.status === "trialing";
  const { data: store } = await supabase
    .from("stores")
    .select("*")
    .eq("stripe_subscription_id", subId)
    .maybeSingle<StoreRow>();
  if (!store) return;
  await supabase
    .from("stores")
    .update({
      trial_ends_at: untilIso,
      trial_notify_stage: 0,
      ...(active ? { status: "active" as const } : {}),
    })
    .eq("id", store.id);
  if (notifyStore && storeHasChannel(store)) {
    try {
      await deliverToStore(store, t(store.owner_lang, "payment_ok"));
    } catch (e) {
      console.error("[stripe] payment_ok notify", e);
    }
  }
}

async function notify(supabase: Supa, storeId: string, key: string): Promise<void> {
  const { data: store } = await supabase
    .from("stores")
    .select("*")
    .eq("id", storeId)
    .maybeSingle<StoreRow>();
  if (store && storeHasChannel(store)) {
    try {
      await deliverToStore(store, t(store.owner_lang, key));
    } catch (e) {
      console.error("[stripe] notify", e);
    }
  }
}

function idOf(v: string | { id: string } | null | undefined): string | undefined {
  if (!v) return undefined;
  return typeof v === "string" ? v : v.id;
}

/** サブスクの現在の期間末（unix秒）。新旧APIの両形（top-level / items）に対応。 */
function subPeriodEnd(sub: Stripe.Subscription): number {
  const s = sub as unknown as {
    current_period_end?: number;
    items?: { data?: Array<{ current_period_end?: number }> };
  };
  if (typeof s.current_period_end === "number") return s.current_period_end;
  const item = s.items?.data?.[0];
  if (item && typeof item.current_period_end === "number") return item.current_period_end;
  return Math.floor(Date.now() / 1000) + 30 * 86400;
}

/** invoice からサブスクIDを取得（新旧APIの両形に対応）。 */
function invoiceSubId(inv: Stripe.Invoice): string | undefined {
  const i = inv as unknown as {
    subscription?: string | { id: string } | null;
    parent?: { subscription_details?: { subscription?: string | { id: string } | null } };
  };
  return idOf(i.subscription ?? i.parent?.subscription_details?.subscription ?? null);
}
