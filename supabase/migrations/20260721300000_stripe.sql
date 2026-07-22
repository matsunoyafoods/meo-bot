-- Stripe サブスク連携。
-- 店舗に Stripe の顧客ID/サブスクIDを保持し、Webhookイベントの二重処理を防ぐ。

alter table public.stores add column if not exists stripe_customer_id text;
alter table public.stores add column if not exists stripe_subscription_id text;

create index if not exists idx_stores_stripe_sub on public.stores (stripe_subscription_id);

-- 冪等性: 処理済みStripeイベントID（同じイベントの二重処理を防ぐ）
create table if not exists public.processed_stripe_events (
  event_id text primary key,
  created_at timestamptz not null default now()
);

-- RLS: 有効化のみ（ポリシー無し = anon 拒否。service_role はバイパス）
alter table public.processed_stripe_events enable row level security;
