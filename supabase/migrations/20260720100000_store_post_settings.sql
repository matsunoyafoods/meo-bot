-- =====================================================================
-- 投稿設定：stores に商品ジャンル / キーワードを追加
--  - category : 店舗のジャンル・主な商品（例: ラーメン店 / カフェ / 焼肉）
--  - keywords : MEO用の自由入力キーワード（カンマや空白区切り）
--  記事の自動生成・キーワード投稿でこの2つを Gemini に渡す。
-- =====================================================================

alter table public.stores
  add column if not exists category text,
  add column if not exists keywords text;
