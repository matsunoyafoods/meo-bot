-- LINE 連携では oauth_states.telegram_chat_id を使わない（line_user_id を使う）。
-- NOT NULL のままだと LINE の OAuth セッション保存が失敗するため、NULL 許可にする。
alter table public.oauth_states alter column telegram_chat_id drop not null;
