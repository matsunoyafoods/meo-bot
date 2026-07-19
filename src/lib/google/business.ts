import { getFreshAccessToken } from "@/lib/google/oauth";

/**
 * Google Business Profile API ラッパー。
 *
 * 注意（PoC の現実）:
 *  - 口コミ(reviews)・投稿(localPosts) は「レガシー v4」= mybusiness.googleapis.com/v4。
 *    このAPIは Google の承認申請（allowlist）が必要。承認までは developer 自身の
 *    アカウントで動作する。
 *  - アカウント/ロケーション列挙は新しい
 *    mybusinessaccountmanagement / mybusinessbusinessinformation。
 *  - インサイトは Business Profile Performance API
 *    (businessprofileperformance.googleapis.com/v1)。
 *  エンドポイントは変わりやすいので、本番前に公式ドキュメントで最終確認すること。
 */

const ACCOUNT_MGMT = "https://mybusinessaccountmanagement.googleapis.com/v1";
const BUSINESS_INFO = "https://mybusinessbusinessinformation.googleapis.com/v1";
const LEGACY_V4 = "https://mybusiness.googleapis.com/v4";
const PERFORMANCE = "https://businessprofileperformance.googleapis.com/v1";

async function gfetch<T>(
  storeId: string,
  url: string,
  init?: RequestInit,
): Promise<T> {
  const token = await getFreshAccessToken(storeId);
  const res = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GBP ${res.status} ${url}\n${body}`);
  }
  return (await res.json()) as T;
}

/* ---------- アカウント / ロケーション ---------- */

export interface GbpAccount {
  name: string; // accounts/{id}
  accountName?: string;
}
export async function listAccounts(storeId: string): Promise<GbpAccount[]> {
  const data = await gfetch<{ accounts?: GbpAccount[] }>(
    storeId,
    `${ACCOUNT_MGMT}/accounts`,
  );
  return data.accounts ?? [];
}

export interface GbpLocation {
  name: string; // locations/{id}
  title?: string;
}
export async function listLocations(
  storeId: string,
  accountName: string,
): Promise<GbpLocation[]> {
  const data = await gfetch<{ locations?: GbpLocation[] }>(
    storeId,
    `${BUSINESS_INFO}/${accountName}/locations?readMask=name,title`,
  );
  return data.locations ?? [];
}

/* ---------- 口コミ（レガシー v4） ---------- */

export interface GbpReview {
  reviewId: string;
  name: string; // accounts/{a}/locations/{l}/reviews/{r}
  reviewer?: { displayName?: string };
  starRating?: "ONE" | "TWO" | "THREE" | "FOUR" | "FIVE";
  comment?: string;
  createTime?: string;
  reviewReply?: { comment: string; updateTime: string };
}

const STAR_MAP: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};
export function starToNumber(star?: string): number {
  return star ? STAR_MAP[star] ?? 0 : 0;
}

export async function listReviews(
  storeId: string,
  accountId: string,
  locationId: string,
): Promise<GbpReview[]> {
  // accountId/locationId は "accounts/123"/"locations/456" の末尾IDでも name でも可。
  const acc = accountId.startsWith("accounts/") ? accountId : `accounts/${accountId}`;
  const loc = locationId.startsWith("locations/") ? locationId : `locations/${locationId}`;
  const data = await gfetch<{ reviews?: GbpReview[] }>(
    storeId,
    `${LEGACY_V4}/${acc}/${loc}/reviews?orderBy=updateTime desc&pageSize=50`,
  );
  return data.reviews ?? [];
}

/** 口コミへ返信（新規/更新どちらも PUT） */
export async function replyToReview(
  storeId: string,
  reviewName: string, // review.name（フルパス）
  comment: string,
): Promise<void> {
  await gfetch(storeId, `${LEGACY_V4}/${reviewName}/reply`, {
    method: "PUT",
    body: JSON.stringify({ comment }),
  });
}

/* ---------- 最新情報の投稿（レガシー v4 localPosts） ---------- */

export async function createLocalPost(
  storeId: string,
  accountId: string,
  locationId: string,
  summary: string,
): Promise<{ name: string }> {
  const acc = accountId.startsWith("accounts/") ? accountId : `accounts/${accountId}`;
  const loc = locationId.startsWith("locations/") ? locationId : `locations/${locationId}`;
  return gfetch<{ name: string }>(
    storeId,
    `${LEGACY_V4}/${acc}/${loc}/localPosts`,
    {
      method: "POST",
      body: JSON.stringify({
        languageCode: "en",
        summary,
        topicType: "STANDARD",
      }),
    },
  );
}

/* ---------- インサイト（Performance API） ---------- */

/**
 * 指定期間の「ルート検索数」「電話数」を取得。
 * multiDailyMetricsTimeSeries で複数メトリクスを一括取得する。
 */
export async function getInsights(
  storeId: string,
  locationId: string,
  start: Date,
  end: Date,
): Promise<{ routeRequests: number; phoneCalls: number }> {
  const loc = locationId.startsWith("locations/")
    ? locationId
    : `locations/${locationId}`;

  const params = new URLSearchParams();
  params.append("dailyMetrics", "BUSINESS_DIRECTION_REQUESTS");
  params.append("dailyMetrics", "CALL_CLICKS");
  params.append("dailyRange.start_date.year", String(start.getUTCFullYear()));
  params.append("dailyRange.start_date.month", String(start.getUTCMonth() + 1));
  params.append("dailyRange.start_date.day", String(start.getUTCDate()));
  params.append("dailyRange.end_date.year", String(end.getUTCFullYear()));
  params.append("dailyRange.end_date.month", String(end.getUTCMonth() + 1));
  params.append("dailyRange.end_date.day", String(end.getUTCDate()));

  interface TS {
    dailyMetric?: string;
    timeSeries?: { datedValues?: { value?: string }[] };
  }
  const data = await gfetch<{ multiDailyMetricTimeSeries?: { dailyMetricTimeSeries?: TS[] }[] }>(
    storeId,
    `${PERFORMANCE}/${loc}:fetchMultiDailyMetricsTimeSeries?${params.toString()}`,
  );

  let routeRequests = 0;
  let phoneCalls = 0;
  const groups = data.multiDailyMetricTimeSeries ?? [];
  for (const g of groups) {
    for (const s of g.dailyMetricTimeSeries ?? []) {
      const sum = (s.timeSeries?.datedValues ?? []).reduce(
        (acc, v) => acc + Number(v.value ?? 0),
        0,
      );
      if (s.dailyMetric === "BUSINESS_DIRECTION_REQUESTS") routeRequests += sum;
      if (s.dailyMetric === "CALL_CLICKS") phoneCalls += sum;
    }
  }
  return { routeRequests, phoneCalls };
}
