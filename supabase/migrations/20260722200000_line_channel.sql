-- マルチチャネル対応: Telegram に加えて LINE でも店舗を運用できるようにする。
-- 既存店舗はすべて 'telegram'（デフォルト）。LINE の店舗は platform='line' + line_user_id を持つ。
alter table public.stores
  add column if not exists platform text not null default 'telegram'
    check (platform in ('telegram', 'line'));

alter table public.stores
  add column if not exists line_user_id text;

-- LINE ユーザーIDで店舗を一意に引けるように（NULL は重複可）
create unique index if not exists stores_line_user_id_key
  on public.stores (line_user_id)
  where line_user_id is not null;

-- OAuth state もチャネルを覚えておく（連携完了通知を正しいチャネルへ返すため）
alter table public.oauth_states
  add column if not exists platform text not null default 'telegram'
    check (platform in ('telegram', 'line'));

alter table public.oauth_states
  add column if not exists line_user_id text;
