import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import {
  updateStoreForAdmin,
  deleteStoreForAdmin,
} from "@/lib/admin-stores";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 店舗の更新（トライアル終了日・名前・状態） */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  let body: {
    name?: string;
    trial_ends_at?: string | null;
    status?: "active" | "suspended";
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  await updateStoreForAdmin(id, body);
  return NextResponse.json({ ok: true });
}

/** 店舗を削除 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await deleteStoreForAdmin(id);
  return NextResponse.json({ ok: true });
}
