import type { StoreRow } from "@/lib/supabase/database.types";

/**
 * 無料期間（トライアル）の判定ロジック。
 * trial_ends_at を「利用できる期限」として使う（決済連携が入るまではこれを延長＝再開）。
 */

type TrialFields = Pick<StoreRow, "status" | "trial_ends_at">;

/** 店舗が今使えるか（停止中でなく、かつ期限内 or 期限なし）。 */
export function isStoreUsable(store: TrialFields): boolean {
  if (store.status !== "active") return false;
  if (!store.trial_ends_at) return true; // 期限なし = 無制限
  return new Date(store.trial_ends_at).getTime() > Date.now();
}

/** 期限までの残り日数（切り上げ）。期限なしは null。 */
export function trialDaysLeft(store: Pick<StoreRow, "trial_ends_at">): number | null {
  if (!store.trial_ends_at) return null;
  return Math.ceil((new Date(store.trial_ends_at).getTime() - Date.now()) / 86_400_000);
}

/**
 * 予告通知のステージ目標。
 * 0=通知不要, 1=7日前, 2=3日前, 3=前日, 4=終了。
 */
export function trialNotifyTarget(daysLeft: number | null): number {
  if (daysLeft === null) return 0;
  if (daysLeft <= 0) return 4;
  if (daysLeft <= 1) return 3;
  if (daysLeft <= 3) return 2;
  if (daysLeft <= 7) return 1;
  return 0;
}

/** 期限を YYYY/MM/DD で表示（カンボジア時間 UTC+7）。 */
export function formatTrialDate(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 7 * 3600 * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}
