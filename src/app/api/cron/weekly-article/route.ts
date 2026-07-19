import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { assertCron } from "@/lib/cron-auth";
import { generateAndProposeArticle } from "@/lib/workflows/article";
import type { StoreRow } from "@/lib/supabase/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** 機能④: 週3回の記事下書き生成（Cron: 月/水/金） */
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
      await generateAndProposeArticle(store);
      results[store.id] = "ok";
    } catch (e) {
      console.error(`[cron/weekly-article] store ${store.id}`, e);
      results[store.id] = `error: ${(e as Error).message}`;
    }
  }
  return NextResponse.json({ ok: true, results });
}
