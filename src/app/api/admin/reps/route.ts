import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { listRepsForAdmin, createRepForAdmin } from "@/lib/admin-reps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 営業マン一覧（担当件数・報酬計算つき） */
export async function GET(): Promise<NextResponse> {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const reps = await listRepsForAdmin();
  return NextResponse.json({ ok: true, reps });
}

/** 営業マンを新規作成（専用リンク発行） */
export async function POST(req: Request): Promise<NextResponse> {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  let body: { name?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ ok: false, error: "name required" }, { status: 400 });
  }
  const rep = await createRepForAdmin(name);
  return NextResponse.json({ ok: true, rep });
}
