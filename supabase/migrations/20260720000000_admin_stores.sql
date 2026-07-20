-- =====================================================================
-- 管理画面 & トライアル対応：stores に列を追加
--  - trial_ends_at : 無料期間の終了日時（表示用。今は機能停止しない）
--  - invite_token  : 招待用トークン（/start invite_<token> で店舗に紐づけ）
--  - status        : active / suspended（将来の課金停止用の器）
-- =====================================================================

alter table public.stores
  add column if not exists trial_ends_at timestamptz,
  add column if not exists invite_token  text,
  add column if not exists status        text not null default 'active';

-- status の値を制約（既存行は 'active' なので安全）
do $$
begin
  if not exists (
    select 1 from information_schema.constraint_column_usage
    where table_name = 'stores' and constraint_name = 'stores_status_check'
  ) then
    alter table public.stores
      add constraint stores_status_check check (status in ('active','suspended'));
  end if;
end $$;

-- invite_token は NULL 以外で一意
create unique index if not exists stores_invite_token_key
  on public.stores(invite_token)
  where invite_token is not null;
