"use client";

import { useCallback, useEffect, useState } from "react";

export const dynamic = "force-dynamic";

interface RepView {
  id: string;
  name: string;
  code: string;
  referral_url: string | null;
  active_contracts: number;
  month: string;
  one_time_count: number;
  one_time_amount: number;
  recurring_count: number;
  recurring_amount: number;
  month_total: number;
  created_at: string;
}

const box: React.CSSProperties = {
  border: "1px solid #E3E3E3",
  borderRadius: 10,
  padding: 16,
  marginBottom: 12,
  background: "#fff",
};

function thisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function RepsPage() {
  const [reps, setReps] = useState<RepView[]>([]);
  const [name, setName] = useState("");
  const [month, setMonth] = useState(thisMonth());
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(true);
  const [msg, setMsg] = useState("");

  const load = useCallback(async (m: string) => {
    setLoading(true);
    const res = await fetch(`/api/admin/reps?month=${m}`, { credentials: "same-origin" });
    if (res.status === 401) {
      setAuthed(false);
      setLoading(false);
      return;
    }
    const data = await res.json();
    setReps(data.reps ?? []);
    setAuthed(true);
    setLoading(false);
  }, []);

  useEffect(() => {
    load(month);
  }, [month, load]);

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
      await load(month);
    }
  }

  async function removeRep(id: string, repName: string) {
    if (!confirm(`「${repName}」を削除しますか？（担当の紐づけは外れます）`)) return;
    await fetch(`/api/admin/reps/${id}`, { method: "DELETE", credentials: "same-origin" });
    await load(month);
  }

  function copy(url: string) {
    navigator.clipboard?.writeText(url);
    setMsg("リンクをコピーしました / Copied");
    setTimeout(() => setMsg(""), 1500);
  }

  const grandTotal = reps.reduce((a, r) => a + r.month_total, 0);

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
        maxWidth: 900,
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
        報酬: 1〜20件目は1件 $20（一時・契約した月に支払い）／21件目以降は1件 $5/月（継続・稼働中のみ）。
      </p>

      <div style={{ ...box, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ fontWeight: 600 }}>対象月 / Month:</label>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value || thisMonth())}
          style={{ padding: 8, borderRadius: 6, border: "1px solid #ccc", fontSize: 15 }}
        />
        <div style={{ marginLeft: "auto", fontSize: 15 }}>
          {month} の支払額合計 / Total:{" "}
          <b style={{ fontSize: 22, color: "#0F5257" }}>${grandTotal.toLocaleString()}</b>
        </div>
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
      {loading && <p>読み込み中…</p>}
      {!loading && reps.length === 0 && (
        <p>まだ営業マンがいません。上のフォームから追加してください。</p>
      )}

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

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginTop: 10,
            }}
          >
            <Stat label="稼働中契約" value={`${r.active_contracts} 件`} />
            <Stat
              label={`今月の一時報酬 (${r.one_time_count}件)`}
              value={`$${r.one_time_amount}`}
              accent="#E8963B"
            />
            <Stat
              label={`今月の継続報酬 (${r.recurring_count}件)`}
              value={`$${r.recurring_amount}`}
              accent="#0F5257"
            />
            <Stat label="今月の支払額" value={`$${r.month_total}`} accent="#E1633C" big />
          </div>

          {r.referral_url && (
            <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
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

function Stat({
  label,
  value,
  accent = "#1D2E2E",
  big = false,
}: {
  label: string;
  value: string;
  accent?: string;
  big?: boolean;
}) {
  return (
    <div
      style={{
        flex: "1 1 160px",
        background: "#FBF8F2",
        borderRadius: 8,
        padding: "8px 12px",
      }}
    >
      <div style={{ fontSize: 12, color: "#5F7373" }}>{label}</div>
      <div style={{ fontSize: big ? 22 : 18, fontWeight: 700, color: accent }}>{value}</div>
    </div>
  );
}
