-- =====================================================================
-- MEO 自動化 PoC — 初期スキーマ
-- Google Business Profile x Gemini x Telegram（カンボジア市場向け）
--
-- 方針:
--  - すべてサーバー(service_role)からのみ操作する。
--  - よって全テーブルで RLS を有効化し、ポリシーを一切作らない = anon/authenticated からは deny all。
--  - service_role は RLS を bypass するのでバックエンドは通常通り読み書きできる。
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- stores : 店舗マスタ（1店舗 = 1 Telegram チャット）
-- ---------------------------------------------------------------------
create table if not exists public.stores (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null default '',
  -- Telegram: オーナーの chat_id（DM）。/start 時に紐づけ。
  telegram_chat_id      bigint unique,
  -- オーナーの母国語（通知・翻訳に使用）: 'ja' | 'km' | 'en' | 'zh'
  owner_lang            text not null default 'ja'
                          check (owner_lang in ('ja','km','en','zh')),
  -- 客単価（KPI 計算に使用）
  avg_ticket_amount     numeric(12,2) not null default 10,
  avg_ticket_currency   text not null default 'USD',
  -- Google Business Profile の識別子
  google_account_id     text,           -- accounts/{accountId}
  google_location_id    text,           -- locations/{locationId}
  onboarded             boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- google_tokens : OAuth トークン（機微情報。stores と 1:1）
-- ---------------------------------------------------------------------
create table if not exists public.google_tokens (
  store_id       uuid primary key references public.stores(id) on delete cascade,
  access_token   text not null,
  refresh_token  text,                    -- 初回同意でのみ返る。必ず保存する。
  scope          text,
  token_type     text default 'Bearer',
  expiry         timestamptz not null,    -- access_token の失効時刻
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- oauth_states : OAuth の state（CSRF 対策 + chat_id との突き合わせ）
-- ---------------------------------------------------------------------
create table if not exists public.oauth_states (
  state             text primary key,
  telegram_chat_id  bigint not null,
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- reviews : 取得した口コミと返信の状態
-- ---------------------------------------------------------------------
create table if not exists public.reviews (
  id                uuid primary key default gen_random_uuid(),
  store_id          uuid not null references public.stores(id) on delete cascade,
  google_review_id  text not null,               -- GBP の review name（末尾ID）
  reviewer_name     text,
  star_rating       int not null check (star_rating between 1 and 5),
  comment           text,                          -- 口コミ原文
  review_lang       text,                          -- 判定した言語コード（例: km, en, zh）
  -- pending          : 取得直後（未処理）
  -- auto_replied     : 星4以上で自動返信済み
  -- awaiting_approval: 星3以下でオーナー承認待ち
  -- replied          : 承認/編集後に返信済み
  -- skipped          : オーナーがスキップ
  status            text not null default 'pending'
                      check (status in ('pending','auto_replied','awaiting_approval','replied','skipped')),
  draft_reply       text,                          -- 相手の言語での返信案（Gemini生成 or 編集後）
  owner_translation text,                          -- オーナー母国語への口コミ翻訳
  replied_at        timestamptz,
  created_at        timestamptz not null default now(),
  unique (store_id, google_review_id)
);

create index if not exists reviews_store_status_idx
  on public.reviews (store_id, status);

-- ---------------------------------------------------------------------
-- owner_states : Telegram の会話状態（編集フロー等）
-- ---------------------------------------------------------------------
create table if not exists public.owner_states (
  store_id    uuid primary key references public.stores(id) on delete cascade,
  -- null | 'awaiting_review_edit' | 'awaiting_ticket_amount'
  mode        text,
  -- 追加情報（例: { "review_id": "..." }）
  context     jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- posts : 日常記事（Googleビジネスプロフィール「最新情報」投稿）
-- ---------------------------------------------------------------------
create table if not exists public.posts (
  id                uuid primary key default gen_random_uuid(),
  store_id          uuid not null references public.stores(id) on delete cascade,
  topic             text,                          -- 記事テーマ（スープ/チャーシュー等）
  body_km           text,                          -- クメール語本文
  body_en           text,                          -- 英語本文
  -- draft | published | skipped
  status            text not null default 'draft'
                      check (status in ('draft','published','skipped')),
  google_post_name  text,                          -- 投稿後の localPosts/{id}
  published_at      timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists posts_store_status_idx
  on public.posts (store_id, status);

-- ---------------------------------------------------------------------
-- kpi_reports : 週報KPI（推定売上貢献額）
-- ---------------------------------------------------------------------
create table if not exists public.kpi_reports (
  id                 uuid primary key default gen_random_uuid(),
  store_id           uuid not null references public.stores(id) on delete cascade,
  week_start         date not null,                -- 対象週の月曜
  route_requests     int not null default 0,       -- ルート検索数
  phone_calls        int not null default 0,       -- 電話数
  conversion_rate    numeric(4,3) not null default 0.400,  -- 来店転換率（既定40%）
  avg_ticket_amount  numeric(12,2) not null default 0,
  avg_ticket_currency text not null default 'USD',
  estimated_revenue  numeric(14,2) not null default 0,
  summary_text       text,                          -- Gemini要約
  created_at         timestamptz not null default now(),
  unique (store_id, week_start)
);

-- ---------------------------------------------------------------------
-- RLS: 全テーブル有効化（ポリシー無し = anon/authenticated は全拒否）
-- ---------------------------------------------------------------------
alter table public.stores        enable row level security;
alter table public.google_tokens enable row level security;
alter table public.oauth_states  enable row level security;
alter table public.reviews       enable row level security;
alter table public.owner_states  enable row level security;
alter table public.posts         enable row level security;
alter table public.kpi_reports   enable row level security;

-- updated_at 自動更新
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists stores_touch on public.stores;
create trigger stores_touch before update on public.stores
  for each row execute function public.touch_updated_at();

drop trigger if exists google_tokens_touch on public.google_tokens;
create trigger google_tokens_touch before update on public.google_tokens
  for each row execute function public.touch_updated_at();

drop trigger if exists owner_states_touch on public.owner_states;
create trigger owner_states_touch before update on public.owner_states
  for each row execute function public.touch_updated_at();
