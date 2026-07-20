-- MEO診断（Places API の place_id キャッシュ） + グループ用レポート配信先
alter table public.stores
  add column if not exists google_place_id text;

create table if not exists public.report_chats (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  chat_id bigint not null,
  title text,
  created_at timestamptz not null default now(),
  unique (store_id, chat_id)
);

create index if not exists report_chats_store_id_idx on public.report_chats (store_id);

-- RLS: 有効化のみ（ポリシー無し = anon 拒否。service_role はバイパス）
alter table public.report_chats enable row level security;
