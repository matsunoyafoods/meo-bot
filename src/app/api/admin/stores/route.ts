import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import {
  listStoresForAdmin,
  createStoreForAdmin,
} from "@/lib/admin-stores";
import type { OwnerLang } from "@/lib/supabase/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 店舗一覧 */
export async function GET(): Promise<NextResponse> {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const stores = await listStoresForAdmin();
  return NextResponse.json({ ok: true, stores });
}

/** 店舗を新規作成（招待リンク発行） */
export async function POST(req: Request): Promise<NextResponse> {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  let body: {
    name?: string;
    trialDays?: number;
    ownerLang?: OwnerLang;
    avgTicketAmount?: number;
    avgTicketCurrency?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ ok: false, error: "name required" }, { status: 400 });
  }
  const store = await createStoreForAdmin({
    name,
    trialDays: Number.isFinite(body.trialDays) ? Number(body.trialDays) : 60,
    ownerLang: body.ownerLang,
    avgTicketAmount: body.avgTicketAmount,
    avgTicketCurrency: body.avgTicketCurrency,
  });
  return NextResponse.json({ ok: true, store });
}
