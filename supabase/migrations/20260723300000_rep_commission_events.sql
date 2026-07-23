-- 営業マン報酬の確定記録（Stripeの実際の支払い成功イベントごとに1行、後から変わらない台帳）
-- Webhook(invoice.paid)から記録する。stripe_invoice_id で重複防止。
--
-- 集計ルール（アプリ側 src/lib/admin-reps.ts で実装）:
--  - one_time($20): 新規契約成立の月に必ず1回（billing_reason = subscription_create）
--  - recurring($5): その営業マンにとって21件目以降の契約のみ、実際に引き落としが
--    成功した月ごとに加算（1〜20件目は継続報酬の対象外）
--  - 支払サイクル: 前月26日〜当月25日(カンボジア時間)の分を当月末に支払う
create table if not exists public.rep_commission_events (
  id                uuid primary key default gen_random_uuid(),
  store_id          uuid not null references public.stores(id) on delete cascade,
  sales_rep_id      uuid not null references public.sales_reps(id) on delete cascade,
  stripe_invoice_id text not null unique,
  kind              text not null check (kind in ('one_time','recurring')),
  amount            numeric(12,2) not null,
  paid_at           timestamptz not null,
  created_at        timestamptz not null default now()
);

create index if not exists rep_commission_events_rep_idx
  on public.rep_commission_events (sales_rep_id, paid_at);

create index if not exists rep_commission_events_store_idx
  on public.rep_commission_events (store_id);

-- RLS: 有効化のみ（ポリシー無し = anon 拒否。service_role はバイパス）
alter table public.rep_commission_events enable row level security;
