"use client";

import { useEffect, useState, useCallback } from "react";

interface StoreView {
  id: string;
  name: string;
  telegram_chat_id: number | null;
  platform: "telegram" | "line";
  line_user_id: string | null;
  linked: boolean;
  onboarded: boolean;
  status: "active" | "suspended";
  owner_lang: string;
  avg_ticket_amount: number;
  avg_ticket_currency: string;
  category: string | null;
  keywords: string | null;
  trial_ends_at: string | null;
  trial_days_left: number | null;
  invite_url: string | null;
  created_at: string;
}

/* ---------- 管理画面の多言語辞書（ja / en / km / zh） ---------- */
type Lang = "ja" | "en" | "km" | "zh";
type Dict = Record<string, string>;

const STR: Record<Lang, Dict> = {
  ja: {
    title: "MEO 管理画面",
    login_prompt: "管理者パスワードを入力してください。",
    password_ph: "パスワード",
    login: "ログイン",
    login_error: "パスワードが違います",
    logout: "ログアウト",
    add_store: "店舗を追加",
    store_name_ph: "店舗名（例: I'm Hungry Phnom Penh）",
    free_days: "無料日数",
    days: "日",
    add_btn: "追加して招待リンク発行",
    add_help:
      "追加すると招待リンクが発行されます。下の一覧からリンクをコピーして、店舗オーナーに Telegram で転送してください。オーナーがリンクを開いて「開始」を押すと、その店舗に紐づき、初期設定（言語・ジャンル・キーワード・客単価）を自分で行えます。",
    store_list: "店舗一覧",
    no_stores: "まだ店舗がありません。",
    linked: "Telegram紐づけ済",
    linked_line: "LINE紐づけ済",
    not_linked: "未紐づけ",
    google_linked: "Google連携済",
    google_not: "Google未連携",
    avg_ticket: "客単価",
    category: "ジャンル・商品",
    keywords: "キーワード",
    free_period: "無料期間",
    until: "まで",
    days_left: "残り {n} 日",
    not_set: "未設定",
    invite_link: "招待リンク",
    copy_link: "リンクをコピー",
    extend30: "無料+30日",
    del: "削除",
    copied: "招待リンクをコピーしました",
    loading: "読み込み中…",
    confirm_delete: "「{name}」を削除しますか？（口コミ履歴・トークンも削除されます）",
    add_failed: "追加に失敗しました",
    name_untitled: "(名称未設定)",
    edit_name: "名前を編集",
    rename_prompt: "新しい店舗名を入力してください",
    edit_category: "ジャンルを編集",
    category_prompt: "店舗のジャンル・主な商品を入力（例: ラーメン店 / カフェ / 焼肉）",
    edit_keywords: "キーワードを編集",
    keywords_prompt: "MEOキーワードを入力（カンマ区切り。例: 味噌ラーメン, 餃子, プノンペン）",
    created: "登録日",
  },
  en: {
    title: "MEO Admin",
    login_prompt: "Enter the admin password.",
    password_ph: "Password",
    login: "Log in",
    login_error: "Wrong password",
    logout: "Log out",
    add_store: "Add a store",
    store_name_ph: "Store name (e.g. I'm Hungry Phnom Penh)",
    free_days: "Free days",
    days: "days",
    add_btn: "Add & create invite link",
    add_help:
      "Adding a store creates an invite link. Copy it from the list and forward it to the store owner on Telegram. When they open the link and press Start, their chat links to that store and they can set it up themselves (language, genre, keywords, average ticket).",
    store_list: "Stores",
    no_stores: "No stores yet.",
    linked: "Telegram linked",
    linked_line: "LINE linked",
    not_linked: "Not linked",
    google_linked: "Google connected",
    google_not: "Google not connected",
    avg_ticket: "Avg ticket",
    category: "Genre / products",
    keywords: "Keywords",
    free_period: "Free trial",
    until: "until",
    days_left: "{n} days left",
    not_set: "not set",
    invite_link: "Invite link",
    copy_link: "Copy link",
    extend30: "+30 free days",
    del: "Delete",
    copied: "Invite link copied",
    loading: "Loading…",
    confirm_delete: "Delete \"{name}\"? (reviews & tokens will also be deleted)",
    add_failed: "Failed to add",
    name_untitled: "(untitled)",
    edit_name: "Edit name",
    rename_prompt: "Enter a new store name",
    edit_category: "Edit genre",
    category_prompt: "Enter store genre / main products (e.g. ramen shop / cafe / BBQ)",
    edit_keywords: "Edit keywords",
    keywords_prompt: "Enter MEO keywords (comma-separated, e.g. miso ramen, gyoza, Phnom Penh)",
    created: "Created",
  },
  km: {
    title: "ផ្ទាំងគ្រប់គ្រង MEO",
    login_prompt: "សូមបញ្ចូលពាក្យសម្ងាត់អ្នកគ្រប់គ្រង។",
    password_ph: "ពាក្យសម្ងាត់",
    login: "ចូល",
    login_error: "ពាក្យសម្ងាត់មិនត្រឹមត្រូវ",
    logout: "ចេញ",
    add_store: "បន្ថែមហាង",
    store_name_ph: "ឈ្មោះហាង (ឧ. I'm Hungry Phnom Penh)",
    free_days: "ថ្ងៃឥតគិតថ្លៃ",
    days: "ថ្ងៃ",
    add_btn: "បន្ថែម & បង្កើតតំណអញ្ជើញ",
    add_help:
      "ការបន្ថែមហាងនឹងបង្កើតតំណអញ្ជើញ។ ចម្លងវាពីបញ្ជី ហើយបញ្ជូនទៅម្ចាស់ហាងតាម Telegram។ ពេលគាត់បើកតំណ ហើយចុច Start ការជជែកនឹងភ្ជាប់ទៅហាង ហើយគាត់អាចកំណត់ដោយខ្លួនឯង (ភាសា ប្រភេទ ពាក្យគន្លឹះ តម្លៃមធ្យម)។",
    store_list: "បញ្ជីហាង",
    no_stores: "មិនទាន់មានហាងទេ។",
    linked: "ភ្ជាប់ Telegram រួច",
    linked_line: "ភ្ជាប់ LINE រួច",
    not_linked: "មិនទាន់ភ្ជាប់",
    google_linked: "ភ្ជាប់ Google រួច",
    google_not: "មិនទាន់ភ្ជាប់ Google",
    avg_ticket: "តម្លៃមធ្យម",
    category: "ប្រភេទ/ផលិតផល",
    keywords: "ពាក្យគន្លឹះ",
    free_period: "រយៈពេលឥតគិតថ្លៃ",
    until: "រហូតដល់",
    days_left: "នៅសល់ {n} ថ្ងៃ",
    not_set: "មិនបានកំណត់",
    invite_link: "តំណអញ្ជើញ",
    copy_link: "ចម្លងតំណ",
    extend30: "+30 ថ្ងៃ ឥតគិតថ្លៃ",
    del: "លុប",
    copied: "បានចម្លងតំណអញ្ជើញ",
    loading: "កំពុងផ្ទុក…",
    confirm_delete: "លុប «{name}» ? (មតិ និង token នឹងត្រូវលុបផងដែរ)",
    add_failed: "បន្ថែមមិនបានសำเร็จ",
    name_untitled: "(គ្មានឈ្មោះ)",
    edit_name: "កែឈ្មោះ",
    rename_prompt: "បញ្ចូលឈ្មោះហាងថ្មី",
    edit_category: "កែប្រភេទ",
    category_prompt: "បញ្ចូលប្រភេទ/ផលិតផលហាង (ឧ. ហាងរ៉ាមេន / កាហ្វេ / សាច់អាំង)",
    edit_keywords: "កែពាក្យគន្លឹះ",
    keywords_prompt: "បញ្ចូលពាក្យគន្លឹះ MEO (បំបែកដោយក្បៀស ឧ. រ៉ាមេនមីសូ, គ្យូហ្សា, ភ្នំពេញ)",
    created: "ចុះឈ្មោះ",
  },
  zh: {
    title: "MEO 管理后台",
    login_prompt: "请输入管理员密码。",
    password_ph: "密码",
    login: "登录",
    login_error: "密码错误",
    logout: "退出",
    add_store: "添加店铺",
    store_name_ph: "店铺名称（例：I'm Hungry Phnom Penh）",
    free_days: "免费天数",
    days: "天",
    add_btn: "添加并生成邀请链接",
    add_help:
      "添加店铺会生成邀请链接。请从下方列表复制链接，通过 Telegram 转发给店主。店主打开链接并点击「开始」后，其对话即绑定到该店铺，并可自行设置（语言、类别、关键词、客单价）。",
    store_list: "店铺列表",
    no_stores: "还没有店铺。",
    linked: "已绑定 Telegram",
    linked_line: "已绑定 LINE",
    not_linked: "未绑定",
    google_linked: "已连接 Google",
    google_not: "未连接 Google",
    avg_ticket: "客单价",
    category: "类别/商品",
    keywords: "关键词",
    free_period: "免费期",
    until: "至",
    days_left: "剩余 {n} 天",
    not_set: "未设置",
    invite_link: "邀请链接",
    copy_link: "复制链接",
    extend30: "+30 免费天数",
    del: "删除",
    copied: "已复制邀请链接",
    loading: "加载中…",
    confirm_delete: "删除「{name}」？（评论和令牌也会被删除）",
    add_failed: "添加失败",
    name_untitled: "(未命名)",
    edit_name: "编辑名称",
    rename_prompt: "请输入新的店铺名称",
    edit_category: "编辑类别",
    category_prompt: "请输入店铺类别/主要商品（例：拉面店 / 咖啡馆 / 烧烤）",
    edit_keywords: "编辑关键词",
    keywords_prompt: "请输入 MEO 关键词（逗号分隔，例：味噌拉面, 饺子, 金边）",
    created: "创建日期",
  },
};

function detectLang(): Lang {
  if (typeof navigator === "undefined") return "ja";
  const l = navigator.language.toLowerCase();
  if (l.startsWith("ja")) return "ja";
  if (l.startsWith("km")) return "km";
  if (l.startsWith("zh")) return "zh";
  return "en";
}

const box: React.CSSProperties = {
  fontFamily: "system-ui, sans-serif",
  maxWidth: 960,
  margin: "0 auto",
  padding: "24px 16px",
};

export default function AdminPage() {
  const [lang, setLang] = useState<Lang>("ja");
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [stores, setStores] = useState<StoreView[]>([]);
  const [name, setName] = useState("");
  const [trialDays, setTrialDays] = useState(60);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      let s = STR[lang][key] ?? STR.ja[key] ?? key;
      if (params) for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
      return s;
    },
    [lang],
  );

  useEffect(() => {
    const saved = (typeof localStorage !== "undefined" && localStorage.getItem("meo_admin_lang")) as Lang | null;
    setLang(saved ?? detectLang());
  }, []);

  function changeLang(l: Lang) {
    setLang(l);
    if (typeof localStorage !== "undefined") localStorage.setItem("meo_admin_lang", l);
  }

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
      setMsg(t("login_error"));
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
      setMsg(t("add_failed"));
    }
  }

  async function patchStore(id: string, patch: Record<string, unknown>) {
    await fetch(`/api/admin/stores/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    void load();
  }

  function editField(id: string, field: string, promptKey: string, current: string | null) {
    const next = prompt(t(promptKey), current ?? "");
    if (next == null) return;
    void patchStore(id, { [field]: next.trim() });
  }

  async function removeStore(id: string, label: string) {
    if (!confirm(t("confirm_delete", { name: label || t("name_untitled") }))) return;
    await fetch(`/api/admin/stores/${id}`, { method: "DELETE" });
    void load();
  }

  function extendTrial(id: string, days: number) {
    const until = new Date(Date.now() + days * 86_400_000).toISOString();
    void patchStore(id, { trial_ends_at: until });
  }

  function copyLink(text: string) {
    void navigator.clipboard.writeText(text);
    setMsg(t("copied"));
    setTimeout(() => setMsg(""), 1500);
  }

  const LangPicker = (
    <select
      value={lang}
      onChange={(e) => changeLang(e.target.value as Lang)}
      style={{ padding: "6px 8px", fontSize: 14, borderRadius: 8 }}
    >
      <option value="ja">日本語</option>
      <option value="en">English</option>
      <option value="km">ភាសាខ្មែរ</option>
      <option value="zh">中文</option>
    </select>
  );

  if (authed === null) {
    return <main style={box}>{t("loading")}</main>;
  }

  if (!authed) {
    return (
      <main style={box}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1>{t("title")}</h1>
          {LangPicker}
        </div>
        <p>{t("login_prompt")}</p>
        <div style={{ display: "flex", gap: 8, maxWidth: 360 }}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
            placeholder={t("password_ph")}
            style={{ flex: 1, padding: 8, fontSize: 16 }}
          />
          <button onClick={login} disabled={busy} style={btn}>
            {t("login")}
          </button>
        </div>
        {msg && <p style={{ color: "crimson" }}>{msg}</p>}
      </main>
    );
  }

  return (
    <main style={box}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <h1 style={{ margin: 0 }}>{t("title")}</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <a
            href="/admin/reps"
            style={{ ...btnGhost, textDecoration: "none", display: "inline-block" }}
          >
            💰 営業マン報酬 / Reps
          </a>
          {LangPicker}
          <button onClick={logout} style={btnGhost}>
            {t("logout")}
          </button>
        </div>
      </div>

      <section style={card}>
        <h2 style={{ marginTop: 0 }}>{t("add_store")}</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("store_name_ph")}
            style={{ flex: 1, minWidth: 220, padding: 8, fontSize: 16 }}
          />
          <label style={{ fontSize: 14 }}>
            {t("free_days")}{" "}
            <input
              type="number"
              value={trialDays}
              onChange={(e) => setTrialDays(Number(e.target.value))}
              style={{ width: 72, padding: 6 }}
            />{" "}
            {t("days")}
          </label>
          <button onClick={addStore} disabled={busy} style={btn}>
            {t("add_btn")}
          </button>
        </div>
        <p style={{ fontSize: 13, color: "#666" }}>{t("add_help")}</p>
      </section>

      {msg && <p style={{ color: "#0a7" }}>{msg}</p>}

      <section style={card}>
        <h2 style={{ marginTop: 0 }}>
          {t("store_list")}（{stores.length}）
        </h2>
        {stores.length === 0 && <p>{t("no_stores")}</p>}
        <div style={{ display: "grid", gap: 12 }}>
          {stores.map((s) => (
            <div key={s.id} style={row}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ fontWeight: 600, fontSize: 16, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span>{s.name || t("name_untitled")}</span>
                  <button onClick={() => editField(s.id, "name", "rename_prompt", s.name)} style={btnTiny}>
                    ✎ {t("edit_name")}
                  </button>
                </div>
                <div style={{ fontSize: 12, color: "#999", marginTop: 2 }}>
                  {s.telegram_chat_id != null && <>Chat ID: {s.telegram_chat_id} ・ </>}
                  {s.platform === "line" && s.line_user_id != null && (
                    <>LINE ID: {s.line_user_id.slice(0, 8)}… ・ </>
                  )}
                  {t("created")}: {new Date(s.created_at).toLocaleDateString()}
                </div>
                <div style={{ fontSize: 13, color: "#555", marginTop: 4 }}>
                  {s.linked
                    ? `🟢 ${t(s.platform === "line" ? "linked_line" : "linked")}`
                    : `⚪ ${t("not_linked")}`}{" "}
                  ・{" "}
                  {s.onboarded ? `🔗 ${t("google_linked")}` : `⛔ ${t("google_not")}`} ・{" "}
                  {t("avg_ticket")} {s.avg_ticket_amount} {s.avg_ticket_currency}
                </div>
                <div style={{ fontSize: 13, marginTop: 4, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span>
                    {t("category")}: <b>{s.category || t("not_set")}</b>
                  </span>
                  <button onClick={() => editField(s.id, "category", "category_prompt", s.category)} style={btnTiny}>
                    ✎
                  </button>
                </div>
                <div style={{ fontSize: 13, marginTop: 2, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span>
                    {t("keywords")}: <b>{s.keywords || t("not_set")}</b>
                  </span>
                  <button onClick={() => editField(s.id, "keywords", "keywords_prompt", s.keywords)} style={btnTiny}>
                    ✎
                  </button>
                </div>
                <div style={{ fontSize: 13, marginTop: 4 }}>
                  {t("free_period")}:{" "}
                  {s.trial_ends_at
                    ? `${new Date(s.trial_ends_at).toLocaleDateString()} ${t("until")}` +
                      (s.trial_days_left != null ? `（${t("days_left", { n: s.trial_days_left })}）` : "")
                    : t("not_set")}
                </div>
                {s.invite_url && (
                  <div style={{ fontSize: 12, marginTop: 6, wordBreak: "break-all" }}>
                    <span style={{ color: "#888" }}>{t("invite_link")}: </span>
                    <a href={s.invite_url} target="_blank" rel="noreferrer">
                      {s.invite_url}
                    </a>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {s.invite_url && (
                  <button onClick={() => copyLink(s.invite_url!)} style={btnSmall}>
                    {t("copy_link")}
                  </button>
                )}
                <button onClick={() => extendTrial(s.id, 30)} style={btnSmall}>
                  {t("extend30")}
                </button>
                <button
                  onClick={() => removeStore(s.id, s.name)}
                  style={{ ...btnSmall, color: "crimson", borderColor: "crimson" }}
                >
                  {t("del")}
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
const btnTiny: React.CSSProperties = {
  padding: "2px 8px",
  fontSize: 12,
  border: "1px solid #ccc",
  background: "#fff",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: 400,
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
