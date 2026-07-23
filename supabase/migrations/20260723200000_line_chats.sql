-- LINE のチャット(1対1 userId / グループ groupId)を「1つの店舗」に集約するための対応表。
-- これにより、オーナーの1対1トークと、そのオーナーのグループが同じ店舗(設定・課金)を共有する。
-- 1対1(userId)は従来どおり stores.line_user_id を主キーに使い、
-- グループ(groupId)はこの line_chats で store_id を参照する（別店舗を作らない）。

create table if not exists public.line_chats (
  line_id text primary key,                 -- LINE の groupId（将来 userId も格納可）
  store_id uuid not null references public.stores(id) on delete cascade,
  kind text not null default 'group',       -- 'group' | 'user'
  created_at timestamptz not null default now()
);

create index if not exists line_chats_store_idx on public.line_chats(store_id);

alter table public.line_chats enable row level security;
