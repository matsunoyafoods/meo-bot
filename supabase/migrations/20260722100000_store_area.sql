-- 店舗のエリア（市区町村・地域名）。記事生成・MEOで地域名として使う。
-- 未設定（NULL）の場合は、AIに都市名を創作させない（プロンプト側でガード済み）。
alter table stores add column if not exists area text;
