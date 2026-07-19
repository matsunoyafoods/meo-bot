# MEO Bot — Google Business Profile × Gemini × Telegram（カンボジア市場 PoC）

店舗オーナーが **PCの管理画面を開かず、Telegram だけ** で
「多言語口コミ返信」「日常記事の自動生成」「売上連動KPIの確認」を完結できる
MEO自動化システムのプロトタイプ（PoC）。

- **スタック**: Next.js 15 (App Router / Route Handlers) + TypeScript
- **DB**: Supabase (PostgreSQL, service_role アクセス)
- **AI**: Gemini 2.5 Flash (`@google/generative-ai`)
- **外部API**: Google Business Profile API / Telegram Bot API
- **デプロイ**: Vercel（Cron 同梱）+ GitHub

---

## 1. ディレクトリ構成

```
meo-bot/
├─ vercel.json                     # Cron 3本の定義
├─ .env.example                    # 必要な環境変数
├─ supabase/migrations/            # DBスキーマ（SQL）
├─ scripts/set-telegram-webhook.ts # webhook 登録スクリプト
└─ src/
   ├─ lib/
   │  ├─ env.ts                    # 環境変数の一元管理
   │  ├─ supabase/                 # admin クライアント + DB型
   │  ├─ gemini/
   │  │   ├─ prompts.ts            # ★ システムプロンプト集（MEO/多言語）
   │  │   └─ client.ts             # Gemini 呼び出しラッパ（JSON強制）
   │  ├─ google/
   │  │   ├─ oauth.ts              # OAuth2 + トークン更新
   │  │   └─ business.ts           # GBP: 口コミ/返信/投稿/インサイト
   │  ├─ telegram/
   │  │   ├─ client.ts             # sendMessage / inline keyboard 等
   │  │   ├─ i18n.ts               # ja / en / km / zh の4言語文言
   │  │   └─ handlers.ts           # ★ コマンド・コールバック・編集フロー
   │  ├─ repo.ts                   # 店舗/状態/口コミの DB アクセス
   │  ├─ store-context.ts          # 店舗→プロンプト用コンテキスト
   │  └─ workflows/
   │      ├─ review-router.ts      # ★ 星4自動 / 星3以下 承認フロー
   │      ├─ article.ts            # 週3回の記事生成・投稿
   │      └─ kpi-report.ts         # 週報KPI（推定売上貢献額）
   └─ app/api/
      ├─ telegram/webhook/route.ts       # Bot webhook
      ├─ oauth/google/callback/route.ts  # OAuth コールバック
      └─ cron/
         ├─ poll-reviews/route.ts        # 口コミ検知
         ├─ weekly-article/route.ts      # 記事下書き
         └─ weekly-report/route.ts       # 週報配信
```

---

## 2. データベース設計

`supabase/migrations/20260719000000_init.sql` に全定義。要点のみ：

| テーブル | 役割 | 主なカラム |
|---|---|---|
| **stores** | 店舗マスタ（1店舗 = 1 Telegramチャット） | `id`, `telegram_chat_id`(unique), `owner_lang`(ja/km/en/zh), `avg_ticket_amount`, `avg_ticket_currency`, `google_account_id`, `google_location_id`, `onboarded` |
| **google_tokens** | OAuthトークン（stores と 1:1） | `store_id`(PK/FK), `access_token`, `refresh_token`, `scope`, `expiry` |
| **oauth_states** | OAuthのstate（CSRF対策 + chat突合） | `state`(PK), `telegram_chat_id` |
| **reviews** | 口コミと返信状態 | `store_id`, `google_review_id`, `star_rating`, `comment`, `review_lang`, `status`, `draft_reply`, `owner_translation`, `replied_at` |
| **owner_states** | Telegram会話状態（編集/客単価入力） | `store_id`(PK), `mode`, `context`(jsonb) |
| **posts** | 日常記事（GBP最新情報） | `store_id`, `topic`, `body_km`, `body_en`, `status`, `google_post_name`, `published_at` |
| **kpi_reports** | 週報KPI | `store_id`, `week_start`, `route_requests`, `phone_calls`, `conversion_rate`, `avg_ticket_amount`, `estimated_revenue`, `summary_text` |

**`reviews.status` の状態遷移**
`pending → auto_replied`（星4以上・自動）
`pending → awaiting_approval →（承認 or 編集）→ replied`（星3以下）
`→ skipped`（オーナーがスキップ）

**セキュリティ方針**: 全テーブルで RLS を有効化し、ポリシーは作らない（= anon/authenticated は全拒否）。
バックエンドは service_role で操作するため RLS を bypass する。個人情報（トークン等）が anon key で読まれない構成。

---

## 3. ワークフロー

### 機能①: Google連携（OAuth 2.0）
`/start` → 店舗レコード作成 + `oauth_states` に state 発行 → 「Google連携」ボタン（認証URL）を送信。
オーナーが許可 → `/api/oauth/google/callback` が `code` をトークン交換して保存し、
アカウント/ロケーションを取得して店舗に紐づけ → Telegram に完了通知。

### 機能②: 星4以上（完全自動）
`poll-reviews` Cron が新着を検知 → `generateReviewReply()` が
**口コミの言語を判定し、その言語で** MEOキーワードを自然に織り込んだ返信を生成 → GBPへ即時返信 → `auto_replied`。

### 機能③: 星3以下（承認フロー）— 中核
`review-router.ts` の `handleLowStar()`:
1. 返信案（相手の言語）＋ オーナー母国語への翻訳を **並行生成**（`Promise.all`）
2. `awaiting_approval` で保存し、Telegramへ「原文 / 翻訳 / 返信案 + 🟢このまま送信 / ✍️編集する」を送信
3. **🟢このまま送信** → `rev_send:<id>` コールバック → GBPへ返信 → `replied`
4. **✍️編集する** → `owner_states.mode='awaiting_review_edit'` にセット → 次のテキスト入力を
   `translateOwnerEditToReply()` で相手の言語に翻訳して返信案を差し替え → 再度承認ボタン提示

### 機能④: 日常記事（週3回）
`weekly-article` Cron（月/水/金）→ `generateArticle()` が
**クメール語＋英語** の投稿文を生成 → Telegramに下書き + 「🟢投稿する / ⏭見送る」→
🟢で `createLocalPost()` によりGBP「最新情報」へ投稿。

### 機能⑤: 店舗設定（チャット内完結）
`/settings` → インラインメニュー。
「🌐母国語」= ja/km/en/zh から選択、「💵客単価」= `10 USD` 形式で入力（`owner_states` で会話状態管理）。

### 機能⑥: 週報KPI（毎週月曜）
`weekly-report` Cron → `getInsights()` で先週の **ルート検索数・電話数** を取得 →
`(ルート検索 + 電話) × 0.40 × 客単価 = 推定売上貢献額` を計算 →
`summarizeKpi()` がオーナー母国語で「先週の成果＋今週のアドバイス」を数行に要約 → Telegram配信。

---

## 4. Gemini システムプロンプト（`src/lib/gemini/prompts.ts`）

全て **JSON固定出力**（`responseMimeType: "application/json"`）でパースを安定化。要旨：

- **口コミ返信** (`reviewReplySystemPrompt`): ①レビューアの言語を判定 → ②**同じ言語**で返信、
  ③店名・地域・料理キーワードを *不自然にならない範囲で* 織り込む（キーワード詰め込み禁止）、
  ④星に応じてトーン切替（4–5=感謝/再来店、1–3=誠実な謝罪・言い訳しない）、⑤2–4文、⑥事実の捏造禁止。
- **口コミ翻訳** (`translateReviewSystemPrompt`): オーナー母国語へ。**ネガティブな内容も和らげず**正確に。
- **編集→返信** (`ownerEditToReplySystemPrompt`): オーナーの言葉を相手の言語の公開返信に整える。
- **記事生成** (`articleSystemPrompt`): 日常の切り口を1つ選び、**km/en 2言語**で投稿文。1言語あたり2–4文。
- **KPI要約** (`kpiSummarySystemPrompt`): 母国語で3–5行。推定売上には「あくまで推定」の注記を付ける。

> MEO 対応の肝は「店名・地域・カテゴリを1回だけ自然に入れる」指示と「相手の言語で返す」指示の両立。
> キーワードの詰め込みは Google のスパム判定リスクになるため、プロンプトで明示的に禁じている。

---

## 5. セットアップ

### 5.1 前提
- Supabase プロジェクト（Postgres）
- Google Cloud プロジェクト（OAuth同意画面 + Business Profile API 有効化）
- Telegram Bot（@BotFather でトークン発行）
- Gemini API キー（Google AI Studio）

### 5.2 環境変数
`.env.example` を `.env`（ローカル）/ Vercel の環境変数にコピーして設定。

### 5.3 DBマイグレーション
Supabase Dashboard → SQL Editor で `supabase/migrations/20260719000000_init.sql` を実行。

### 5.4 デプロイ
```bash
npm install
npm run build      # ローカル検証
# GitHub に push → Vercel が自動デプロイ
```

### 5.5 Webhook 登録（デプロイ後1回）
```bash
npx tsx scripts/set-telegram-webhook.ts
```
`https://<your-domain>/api/telegram/webhook` が登録される。

### 5.6 Google OAuth リダイレクトURI
Google Cloud の OAuth クライアントに
`https://<your-domain>/api/oauth/google/callback` を追加。

---

## 6. 重要な注意点（PoC → 本番の前に）

1. **Vercel Cron の頻度制限**: Hobby プランの Cron は基本 **1日1回** まで。
   `poll-reviews` の15分間隔は **Pro プラン**が必要。Hobby のままなら
   外部スケジューラ（cron-job.org / GitHub Actions）や Supabase `pg_cron` から
   `/api/cron/*?key=$CRON_SECRET` を叩く構成に切り替える。
2. **Cron のタイムゾーンは UTC**。現在の設定は
   週報 `30 1 * * 1`（= プノンペン月曜 08:30）、記事 `0 2 * * 1,3,5`（= 月/水/金 09:00 プノンペン）。
3. **Google Business Profile の口コミ/投稿 API（レガシー v4）は Google の承認申請（allowlist）が必要**。
   承認前は開発者自身のGBPアカウントで動作。申請には数日〜かかる。
4. **口コミの Webhook は Google 非提供** のため、本 PoC は Cron ポーリング方式。
5. **Telegram への即時性**: webhook は重い処理でも 200 を返すが、
   本番では処理をキュー（例: Supabase 経由 or QStash）に逃がすとより堅牢。
6. `avg_ticket` の通貨は USD/KHR/JPY/CNY を緩くパース。厳密なバリデーションは本番で強化を。

---

## 7. 動作確認の順序
1. Vercel デプロイ完了（ダッシュボードで `Ready`）を確認
2. Supabase でマイグレーション実行
3. `set-telegram-webhook` 実行
4. Bot に `/start` → Google連携 → `/settings` で言語・客単価
5. `poll-reviews` を手動起動して確認:
   `curl "https://<domain>/api/cron/poll-reviews?key=<CRON_SECRET>"`
