-- 無料期間（trial_ends_at）の予告通知の進捗ステージ。
-- 0=未通知, 1=7日前通知済, 2=3日前, 3=前日, 4=終了通知済。
-- 期限を延長（>7日先）にすると 0 に戻り、次回以降また予告が届く。

alter table public.stores add column if not exists trial_notify_stage smallint not null default 0;
