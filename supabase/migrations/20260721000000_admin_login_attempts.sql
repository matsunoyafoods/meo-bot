-- 管理画面ログインのレート制限用（総当たり対策）
-- 失敗試行をIP単位で記録し、直近ウィンドウ内の失敗回数が閾値を超えたらブロックする。

create table if not exists public.admin_login_attempts (
  id uuid primary key default gen_random_uuid(),
  ip text not null,
  success boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_login_attempts_ip_time
  on public.admin_login_attempts (ip, created_at desc);

-- RLS: 有効化のみ（ポリシー無し = anon 拒否。service_role はバイパス）
alter table public.admin_login_attempts enable row level security;
