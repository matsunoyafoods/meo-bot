-- 日次cronの「1回で処理する店舗数の上限＋公平なローテーション」用。
-- last_cron_at が古い（または未処理=NULL）店舗から順に処理し、処理後に now() を記録する。
-- これにより、店舗数が上限を超えても毎回同じ店舗ばかり処理されず、順番に回る。

alter table public.stores add column if not exists last_cron_at timestamptz;

create index if not exists idx_stores_last_cron
  on public.stores (last_cron_at nulls first);
