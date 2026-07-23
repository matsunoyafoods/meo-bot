import { NextResponse } from "next/server";
import { assertCron } from "@/lib/cron-auth";
import { setupRichMenu, deleteAllRichMenus } from "@/lib/line/richmenu";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * LINE リッチメニューのセットアップ（?key=CRON_SECRET で保護）。
 * - POST/GET: 作成 → 画像アップロード → 既定メニューに設定。
 * - ?action=delete: 既存を全削除（リッチメニューを外したいとき）。
 * 1回叩けば全ユーザーの1対1トークに常設メニューが出る。
 */
async function handle(req: Request): Promise<NextResponse> {
  const denied = assertCron(req);
  if (denied) return denied;

  const url = new URL(req.url);
  if (url.searchParams.get("action") === "delete") {
    const deleted = await deleteAllRichMenus();
    return NextResponse.json({ ok: true, deleted });
  }

  try {
    const { richMenuId } = await setupRichMenu();
    return NextResponse.json({ ok: true, richMenuId });
  } catch (e) {
    console.error("[line] richmenu setup failed", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
