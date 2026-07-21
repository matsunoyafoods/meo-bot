import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { deleteRepForAdmin } from "@/lib/admin-reps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 営業マンを削除（担当店舗の紐づけは自動で外れる） */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await deleteRepForAdmin(id);
  return NextResponse.json({ ok: true });
}
