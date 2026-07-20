/**
 * DB 型定義。supabase/migrations と必ず同期させること。
 * （PoC 用に手書き。本番では `supabase gen types typescript` に置き換え可）
 */

export type OwnerLang = "ja" | "km" | "en" | "zh";

export type ReviewStatus =
  | "pending"
  | "auto_replied"
  | "awaiting_approval"
  | "replied"
  | "skipped";

export type PostStatus = "draft" | "published" | "skipped";

export type OwnerStateMode =
  | "awaiting_review_edit"
  | "awaiting_ticket_amount"
  | null;

export interface StoreRow {
  id: string;
  name: string;
  telegram_chat_id: number | null;
  owner_lang: OwnerLang;
  avg_ticket_amount: number;
  avg_ticket_currency: string;
  google_account_id: string | null;
  google_location_id: string | null;
  onboarded: boolean;
  trial_ends_at: string | null;
  invite_token: string | null;
  status: "active" | "suspended";
  created_at: string;
  updated_at: string;
}
export type StoreInsert = Partial<StoreRow> & { telegram_chat_id?: number | null };
export type StoreUpdate = Partial<StoreRow>;

export interface GoogleTokenRow {
  store_id: string;
  access_token: string;
  refresh_token: string | null;
  scope: string | null;
  token_type: string | null;
  expiry: string;
  updated_at: string;
}
export type GoogleTokenInsert = Omit<GoogleTokenRow, "updated_at"> & {
  updated_at?: string;
};
export type GoogleTokenUpdate = Partial<GoogleTokenRow>;

export interface OAuthStateRow {
  state: string;
  telegram_chat_id: number;
  created_at: string;
}
export type OAuthStateInsert = Omit<OAuthStateRow, "created_at"> & {
  created_at?: string;
};

export interface ReviewRow {
  id: string;
  store_id: string;
  google_review_id: string;
  reviewer_name: string | null;
  star_rating: number;
  comment: string | null;
  review_lang: string | null;
  status: ReviewStatus;
  draft_reply: string | null;
  owner_translation: string | null;
  replied_at: string | null;
  created_at: string;
}
export type ReviewInsert = Omit<ReviewRow, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};
export type ReviewUpdate = Partial<ReviewRow>;

export interface OwnerStateRow {
  store_id: string;
  mode: OwnerStateMode;
  context: Record<string, unknown>;
  updated_at: string;
}
export type OwnerStateInsert = Omit<OwnerStateRow, "updated_at"> & {
  updated_at?: string;
};
export type OwnerStateUpdate = Partial<OwnerStateRow>;

export interface PostRow {
  id: string;
  store_id: string;
  topic: string | null;
  body_km: string | null;
  body_en: string | null;
  status: PostStatus;
  google_post_name: string | null;
  published_at: string | null;
  created_at: string;
}
export type PostInsert = Omit<PostRow, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};
export type PostUpdate = Partial<PostRow>;

export interface KpiReportRow {
  id: string;
  store_id: string;
  week_start: string;
  route_requests: number;
  phone_calls: number;
  conversion_rate: number;
  avg_ticket_amount: number;
  avg_ticket_currency: string;
  estimated_revenue: number;
  summary_text: string | null;
  created_at: string;
}
export type KpiReportInsert = Omit<KpiReportRow, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};
export type KpiReportUpdate = Partial<KpiReportRow>;
