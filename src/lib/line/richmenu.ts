import { env } from "@/lib/env";
import { RICH_MENU_PNG_BASE64 } from "@/lib/line/richmenu-image";

/**
 * LINE リッチメニュー（1対1トーク下部の常設メニュー）のセットアップ。
 * - 2500x1686 の画像を 3列×2行=6ボタンに分割し、各領域を postback に割り当てる。
 * - postback の data は既存の handleLinePostback と同じ（menu_post 等）。
 * ※ リッチメニューは1対1トーク専用（グループには出ない。グループはクイックリプライで操作）。
 */

const API = "https://api.line.me/v2/bot";
const API_DATA = "https://api-data.line.me/v2/bot";

const WIDTH = 2500;
const HEIGHT = 1686;
const CW = Math.round(WIDTH / 3); // 833
const CH = Math.round(HEIGHT / 2); // 843

interface RichMenuArea {
  bounds: { x: number; y: number; width: number; height: number };
  action: { type: "postback"; data: string; displayText?: string };
}

/** 3×2 グリッド。左上→右下の順で mainMenu と同じ並び。 */
function areas(): RichMenuArea[] {
  const cells: { data: string; display: string }[] = [
    { data: "menu_post", display: "投稿を作る" },
    { data: "menu_diagnose", display: "MEO診断" },
    { data: "menu_reviews", display: "口コミ返信" },
    { data: "menu_settings", display: "設定" },
    { data: "subscribe", display: "お申し込み" },
    { data: "contact", display: "問い合わせ" },
  ];
  return cells.map((c, i) => {
    const col = i % 3;
    const rowIsBottom = i >= 3;
    return {
      bounds: {
        x: col * CW,
        y: rowIsBottom ? CH : 0,
        width: CW,
        height: CH,
      },
      action: { type: "postback" as const, data: c.data, displayText: c.display },
    };
  });
}

function richMenuObject() {
  return {
    size: { width: WIDTH, height: HEIGHT },
    selected: true, // 既定で開いた状態にする
    name: "MapBoost main menu",
    chatBarText: "メニュー",
    areas: areas(),
  };
}

async function authHeader(): Promise<Record<string, string>> {
  const token = env.lineChannelAccessToken();
  if (!token) throw new Error("LINE token not configured");
  return { authorization: `Bearer ${token}` };
}

/** 既存のリッチメニューを全削除（作り直し時のクリーンアップ） */
export async function deleteAllRichMenus(): Promise<number> {
  const headers = await authHeader();
  const res = await fetch(`${API}/richmenu/list`, { headers });
  if (!res.ok) return 0;
  const json = (await res.json()) as { richmenus?: { richMenuId: string }[] };
  const list = json.richmenus ?? [];
  let deleted = 0;
  for (const m of list) {
    const d = await fetch(`${API}/richmenu/${m.richMenuId}`, { method: "DELETE", headers });
    if (d.ok) deleted++;
  }
  return deleted;
}

/**
 * リッチメニューを作成 → 画像アップロード → 既定メニューに設定。
 * 成功で richMenuId を返す。CRON_SECRET 保護のルートから1回だけ叩く想定。
 */
export async function setupRichMenu(): Promise<{ richMenuId: string }> {
  const headers = await authHeader();

  // 1) 作り直しのため既存を削除
  await deleteAllRichMenus();

  // 2) リッチメニュー本体を作成
  const createRes = await fetch(`${API}/richmenu`, {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify(richMenuObject()),
  });
  if (!createRes.ok) {
    throw new Error(`create richmenu failed: ${createRes.status} ${await createRes.text()}`);
  }
  const { richMenuId } = (await createRes.json()) as { richMenuId: string };

  // 3) 画像アップロード（api-data ホスト・binary）
  const png = Buffer.from(RICH_MENU_PNG_BASE64, "base64");
  const imgRes = await fetch(`${API_DATA}/richmenu/${richMenuId}/content`, {
    method: "POST",
    headers: { ...headers, "content-type": "image/png" },
    body: png,
  });
  if (!imgRes.ok) {
    throw new Error(`upload image failed: ${imgRes.status} ${await imgRes.text()}`);
  }

  // 4) 全ユーザーの既定リッチメニューに設定
  const defRes = await fetch(`${API}/user/all/richmenu/${richMenuId}`, {
    method: "POST",
    headers,
  });
  if (!defRes.ok) {
    throw new Error(`set default failed: ${defRes.status} ${await defRes.text()}`);
  }

  return { richMenuId };
}
