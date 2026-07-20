"use client";

import { useEffect, useState, useCallback } from "react";

interface StoreView {
  id: string;
  name: string;
  linked: boolean;
  onboarded: boolean;
  status: "active" | "suspended";
  owner_lang: string;
  avg_ticket_amount: number;
  avg_ticket_currency: string;
  trial_ends_at: string | null;
  trial_days_left: number | null;
  invite_url: string | null;
  created_at: string;
}

const box: React.CSSProperties = {
  fontFamily: "system-ui, sans-serif",
  maxWidth: 960,
  margin: "0 auto",
  padding: "24px 16px",
};

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [stores, setStores] = useState<StoreView[]>([]);
  const [name, setName] = useState("");
  const [trialDays, setTrialDays] = useState(60);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/stores");
    if (res.status === 401) {
      setAuthed(false);
      return;
    }
    const json = await res.json();
    setStores(json.stores ?? []);
    setAuthed(true);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function login() {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (res.ok) {
      setPassword("");
      void load();
    } else {
      setMsg("パスワードが違います");
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthed(false);
    setStores([]);
  }

  async function addStore() {
    if (!name.trim()) return;
    setBusy(true);
    const res = await fetch("/api/admin/stores", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name.trim(), trialDays }),
    });
    setBusy(false);
    if (res.ok) {
      setName("");
      void load();
    } else {
      setMsg("追加に失敗しました");
    }
  }

  async function removeStore(id: string, label: string) {
    if (!confirm(`「${label}」を削除しますか？（口コミ履歴・トークンも削除されます）`)) return;
    await fetch(`/api/admin/stores/${id}`, { method: "DELETE" });
    void load();
  }

  async function extendTrial(id: string, days: number) {
    const until = new Date(Date.now() + days * 86_400_000).toISOString();
    await fetch(`/api/admin/stores/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ trial_ends_at: until }),
    });
    void load();
  }

  function copy(text: string) {
    void navigator.clipboard.writeText(text);
    setMsg("招待リンクをコピーしました");
    setTimeout(() => setMsg(""), 1500);
  }

  if (authed === null) {
    return <main style={box}>読み込み中…</main>;
  }

  if (!authed) {
    return (
      <main style={box}>
        <h1>MEO 管理画面</h1>
        <p>管理者パスワードを入力してください。</p>
        <div style={{ display: "flex", gap: 8, maxWidth: 360 }}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
            placeholder="パスワード"
            style={{ flex: 1, padding: 8, fontSize: 16 }}
          />
          <button onClick={login} disabled={busy} style={btn}>
            ログイン
          </button>
        </div>
        {msg && <p style={{ color: "crimson" }}>{msg}</p>}
      </main>
    );
  }

  return (
    <main style={box}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>MEO 管理画面</h1>
        <button onClick={logout} style={btnGhost}>
          ログアウト
        </button>
      </div>

      <section style={card}>
        <h2 style={{ marginTop: 0 }}>店舗を追加</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="店舗名（例: I'm Hungry Phnom Penh）"
            style={{ flex: 1, minWidth: 220, padding: 8, fontSize: 16 }}
          />
          <label style={{ fontSize: 14 }}>
            無料日数{" "}
            <input
              type="number"
              value={trialDays}
              onChange={(e) => setTrialDays(Number(e.target.value))}
              style={{ width: 72, padding: 6 }}
            />{" "}
            日
          </label>
          <button onClick={addStore} disabled={busy} style={btn}>
            追加して招待リンク発行
          </button>
        </div>
        <p style={{ fontSize: 13, color: "#666" }}>
          追加すると招待リンクが発行されます。下の表からリンクをコピーして、店舗オーナーに
          Telegram で転送してください。オーナーがリンクを開いて「開始」を押すと、その店舗に紐づきます。
        </p>
      </section>

      {msg && <p style={{ color: "#0a7" }}>{msg}</p>}

      <section style={card}>
        <h2 style={{ marginTop: 0 }}>店舗一覧（{stores.length}）</h2>
        {stores.length === 0 && <p>まだ店舗がありません。</p>}
        <div style={{ display: "grid", gap: 12 }}>
          {stores.map((s) => (
            <div key={s.id} style={row}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ fontWeight: 600, fontSize: 16 }}>{s.name || "(名称未設定)"}</div>
                <div style={{ fontSize: 13, color: "#555", marginTop: 4 }}>
                  {s.linked ? "🟢 Telegram紐づけ済" : "⚪ 未紐づけ"} ・{" "}
                  {s.onboarded ? "🔗 Google連携済" : "⛔ Google未連携"} ・{" "}
                  客単価 {s.avg_ticket_amount} {s.avg_ticket_currency}
                </div>
                <div style={{ fontSize: 13, marginTop: 4 }}>
                  無料期間:{" "}
                  {s.trial_ends_at
                    ? `${new Date(s.trial_ends_at).toLocaleDateString()} まで` +
                      (s.trial_days_left != null
                        ? `（残り ${s.trial_days_left} 日）`
                        : "")
                    : "未設定"}
                </div>
                {s.invite_url && (
                  <div style={{ fontSize: 12, marginTop: 6, wordBreak: "break-all" }}>
                    <span style={{ color: "#888" }}>招待リンク: </span>
                    <a href={s.invite_url} target="_blank" rel="noreferrer">
                      {s.invite_url}
                    </a>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {s.invite_url && (
                  <button onClick={() => copy(s.invite_url!)} style={btnSmall}>
                    リンクをコピー
                  </button>
                )}
                <button onClick={() => extendTrial(s.id, 30)} style={btnSmall}>
                  無料+30日
                </button>
                <button
                  onClick={() => removeStore(s.id, s.name)}
                  style={{ ...btnSmall, color: "crimson", borderColor: "crimson" }}
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

const btn: React.CSSProperties = {
  padding: "8px 14px",
  fontSize: 15,
  border: "1px solid #0a7",
  background: "#0a7",
  color: "#fff",
  borderRadius: 8,
  cursor: "pointer",
};
const btnGhost: React.CSSProperties = {
  padding: "6px 12px",
  fontSize: 14,
  border: "1px solid #ccc",
  background: "#fff",
  borderRadius: 8,
  cursor: "pointer",
};
const btnSmall: React.CSSProperties = {
  padding: "5px 10px",
  fontSize: 13,
  border: "1px solid #ccc",
  background: "#fff",
  borderRadius: 6,
  cursor: "pointer",
  whiteSpace: "nowrap",
};
const card: React.CSSProperties = {
  border: "1px solid #e5e5e5",
  borderRadius: 12,
  padding: 16,
  margin: "16px 0",
};
const row: React.CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  justifyContent: "space-between",
  border: "1px solid #eee",
  borderRadius: 10,
  padding: 12,
};
