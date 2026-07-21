-- 営業マン（コミッション管理）: 専用リンクで店舗を自動紐づけ
create table if not exists public.sales_reps (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  created_at timestamptz not null default now()
);

alter table public.stores
  add column if not exists sales_rep_id uuid references public.sales_reps (id) on delete set null;

create index if not exists stores_sales_rep_id_idx on public.stores (sales_rep_id);

-- RLS: 有効化のみ（ポリシー無し = anon 拒否。service_role はバイパス）
alter table public.sales_reps enable row level security;
