import { env } from "@/lib/env";

/**
 * Google Places API (New) ラッパー — MEO診断用。
 * GBP API（承認待ち）とは別サービスなので、Places API を有効化すれば即利用可。
 *  - Text Search:  POST https://places.googleapis.com/v1/places:searchText
 *  - Place Details: GET  https://places.googleapis.com/v1/places/{placeId}
 * 認証は API キー（X-Goog-Api-Key）。取得フィールドは FieldMask で明示指定。
 */

const BASE = "https://places.googleapis.com/v1";

export interface PlaceSnapshot {
  placeId: string;
  name: string;
  rating: number | null;
  reviewCount: number;
  photoCount: number;
  hasHours: boolean;
  hasPhone: boolean;
  hasWebsite: boolean;
  primaryType: string | null;
  businessStatus: string | null;
  hasDescription: boolean;
  priceLevel: string | null;
  mapsUri: string | null;
  attributes: string[];
}

/** 店名（＋地域）から place_id を検索。最上位の候補を返す。 */
export async function findPlaceId(
  query: string,
): Promise<string | null> {
  const res = await fetch(`${BASE}/places:searchText`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Goog-Api-Key": env.googleMapsApiKey(),
      "X-Goog-FieldMask": "places.id,places.displayName",
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: 1 }),
  });
  if (!res.ok) {
    throw new Error(`Places searchText ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { places?: { id: string }[] };
  return data.places?.[0]?.id ?? null;
}

/** place_id から MEO診断に必要な現状スナップショットを取得。 */
export async function getPlaceSnapshot(placeId: string): Promise<PlaceSnapshot> {
  const fields = [
    "id",
    "displayName",
    "rating",
    "userRatingCount",
    "photos",
    "regularOpeningHours",
    "nationalPhoneNumber",
    "internationalPhoneNumber",
    "websiteUri",
    "primaryTypeDisplayName",
    "businessStatus",
    "editorialSummary",
    "priceLevel",
    "googleMapsUri",
    "dineIn",
    "takeout",
    "delivery",
    "servesLunch",
    "servesDinner",
    "reservable",
  ].join(",");

  const res = await fetch(`${BASE}/places/${encodeURIComponent(placeId)}`, {
    headers: {
      "X-Goog-Api-Key": env.googleMapsApiKey(),
      "X-Goog-FieldMask": fields,
    },
  });
  if (!res.ok) {
    throw new Error(`Places details ${res.status}: ${await res.text()}`);
  }
  interface Details {
    id: string;
    displayName?: { text?: string };
    rating?: number;
    userRatingCount?: number;
    photos?: unknown[];
    regularOpeningHours?: unknown;
    nationalPhoneNumber?: string;
    internationalPhoneNumber?: string;
    websiteUri?: string;
    primaryTypeDisplayName?: { text?: string };
    businessStatus?: string;
    editorialSummary?: { text?: string };
    priceLevel?: string;
    googleMapsUri?: string;
    dineIn?: boolean;
    takeout?: boolean;
    delivery?: boolean;
    servesLunch?: boolean;
    servesDinner?: boolean;
    reservable?: boolean;
  }
  const d = (await res.json()) as Details;

  const attributes: string[] = [];
  if (d.dineIn) attributes.push("dine-in");
  if (d.takeout) attributes.push("takeout");
  if (d.delivery) attributes.push("delivery");
  if (d.servesLunch) attributes.push("serves lunch");
  if (d.servesDinner) attributes.push("serves dinner");
  if (d.reservable) attributes.push("reservable");

  return {
    placeId: d.id,
    name: d.displayName?.text ?? "",
    rating: typeof d.rating === "number" ? d.rating : null,
    reviewCount: d.userRatingCount ?? 0,
    photoCount: Array.isArray(d.photos) ? d.photos.length : 0,
    hasHours: d.regularOpeningHours != null,
    hasPhone: Boolean(d.nationalPhoneNumber || d.internationalPhoneNumber),
    hasWebsite: Boolean(d.websiteUri),
    primaryType: d.primaryTypeDisplayName?.text ?? null,
    businessStatus: d.businessStatus ?? null,
    hasDescription: Boolean(d.editorialSummary?.text),
    priceLevel: d.priceLevel ?? null,
    mapsUri: d.googleMapsUri ?? null,
    attributes,
  };
}
