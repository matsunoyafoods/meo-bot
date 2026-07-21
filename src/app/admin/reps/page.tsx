"use client";

import { useEffect, useState } from "react";

export const dynamic = "force-dynamic";

interface RepView {
  id: string;
  name: string;
  code: string;
  referral_url: string | null;
  active_contracts: number;
  one_time_total: number;
  recurring_monthly: number;
  created_at: string;
}

const box: React.CSSProperties = {
  border: "1px solid #E3E3E3",
  borderRadius: 10,
  padding: 16,
  marginBottom: 12,
  background: "#fff",
};

export default function RepsPage() {
  const [reps, setReps] = useState<RepView[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(true);
  const [msg, setMsg] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/reps", { credentials: "same-origin" });
    if (res.status === 401) {
      setAuthed(false);
      setLoading(false);
      return;
    }
    const data = await res.json();
    setReps(data.reps ?? []);
    setAuthed(true);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addRep() {
    if (!name.trim()) return;
    const res = await fetch("/api/admin/reps", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ name: name.trim() }),
    });
    if (res.ok) {
      setName("");
      await load();
    }
  }

  async function removeRep(id: string, repName: string) {
    if (!confirm(`「${repName}」を削除しますか？（担当の紐づけは外れます）`)) return;
    await fetch(`/api/admin/reps/${id}`, { method: "DELETE", credentials: "same-origin" });
    await load();
  }

  function copy(url: string) {
    navigator.clipboard?.writeText(url);
    setMsg("リンクをコピーしました / Copied");
    setTimeout(() => setMsg(""), 1500);
  }

  const totalRecurring = reps.reduce((a, r) => a + r.recurring_monthly, 0);

  if (loading)
    return <main style={{ fontFamily: "system-ui", padding: 24 }}>読み込み中…</main>;

  if (!authed)
    return (
      <main style={{ fontFamily: "system-ui", padding: 24 }}>
        <p>管理画面でログインしてください。</p>
        <a href="/admin" style={{ color: "#0F5257" }}>
          → ログインへ
        </a>
      </main>
    );

  return (
    <main
      style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        maxWidth: 860,
        margin: "0 auto",
        padding: "24px 16px 80px",
        color: "#1D2E2E",
      }}
    >
      <p style={{ margin: 0 }}>
        <a href="/admin" style={{ color: "#0F5257" }}>
          ← 店舗一覧へ / Stores
        </a>
      </p>
      <h1 style={{ fontSize: 26 }}>営業マン・報酬 / Sales reps</h1>
      <p style={{ color: "#5F7373", fontSize: 14 }}>
        報酬: 1〜20件目は1件 $20（一時）／21件目以降は1件 $5/月（継続）。稼働中(active)の契約のみ集計。
      </p>

      <div style={{ ...box, background: "#0F5257", color: "#fff" }}>
        継続報酬 月額合計 / Total recurring:{" "}
        <b style={{ fontSize: 20 }}>${totalRecurring.toLocaleString()}</b> / 月
      </div>

      <div style={{ ...box, display: "flex", gap: 8, alignItems: "center" }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="営業マンの名前 / Rep name"
          style={{ flex: 1, padding: 8, borderRadius: 6, border: "1px solid #ccc" }}
        />
        <button
          onClick={addRep}
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            border: "none",
            background: "#0F5257",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          ＋ 追加 / Add
        </button>
      </div>

      {msg && <p style={{ color: "#0F5257" }}>{msg}</p>}

      {reps.length === 0 && <p>まだ営業マンがいません。上のフォームから追加してください。</p>}

      {reps.map((r) => (
        <div key={r.id} style={box}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <b style={{ fontSize: 18 }}>{r.name}</b>
            <button
              onClick={() => removeRep(r.id, r.name)}
              style={{ border: "none", background: "none", color: "#c0392b", cursor: "pointer" }}
            >
              削除
            </button>
          </div>
          <div style={{ fontSize: 14, color: "#5F7373", marginTop: 6 }}>
            稼働中契約: <b>{r.active_contracts}</b> 件　｜　一時報酬(累計対象): <b>${r.one_time_total}</b>
            　｜　継続報酬: <b>${r.recurring_monthly}/月</b>
          </div>
          {r.referral_url && (
            <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
              <code
                style={{
                  flex: 1,
                  background: "#F1ECE1",
                  padding: "6px 8px",
                  borderRadius: 6,
                  fontSize: 13,
                  overflowX: "auto",
                  whiteSpace: "nowrap",
                }}
              >
                {r.referral_url}
              </code>
              <button
                onClick={() => copy(r.referral_url!)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "1px solid #0F5257",
                  background: "#fff",
                  color: "#0F5257",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                コピー
              </button>
            </div>
          )}
        </div>
      ))}
    </main>
  );
}
