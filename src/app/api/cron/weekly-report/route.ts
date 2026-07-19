import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { assertCron } from "@/lib/cron-auth";
import { buildAndSendWeeklyReport } from "@/lib/workflows/kpi-report";
import type { StoreRow } from "@/lib/supabase/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** 機能⑥: 毎週月曜の週報KPI配信 */
export async function GET(req: Request): Promise<NextResponse> {
  const denied = assertCron(req);
  if (denied) return denied;

  const supabase = createSupabaseAdminClient();
  const { data: stores } = await supabase
    .from("stores")
    .select("*")
    .eq("onboarded", true)
    .returns<StoreRow[]>();

  const results: Record<string, string> = {};
  for (const store of stores ?? []) {
    try {
      await buildAndSendWeeklyReport(store);
      results[store.id] = "ok";
    } catch (e) {
      console.error(`[cron/weekly-report] store ${store.id}`, e);
      results[store.id] = `error: ${(e as Error).message}`;
    }
  }
  return NextResponse.json({ ok: true, results });
}
