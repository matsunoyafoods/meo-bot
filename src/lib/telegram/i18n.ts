import type { OwnerLang } from "@/lib/supabase/database.types";

/**
 * オーナー向け UI 文言（4言語）。
 * 規律: キーを追加したら ja/en/km/zh すべて埋める（1つでも欠けると片手落ち）。
 */
type Dict = Record<string, string>;

const ja: Dict = {
  welcome:
    "ようこそ！Googleビジネスプロフィールと連携すると、口コミ返信・記事投稿・週報を自動化できます。\n\n下のボタンからGoogleと連携してください。",
  connect_google: "🔗 Googleと連携する",
  connected:
    "✅ 連携が完了しました。これから新しい口コミを自動でチェックします。/settings で言語や客単価を設定できます。",
  settings_title: "⚙️ 店舗設定",
  set_language: "🌐 母国語を設定",
  set_ticket: "💵 客単価を設定",
  choose_language: "通知・翻訳に使う母国語を選んでください。",
  lang_saved: "✅ 母国語を「{lang}」に設定しました。",
  ask_ticket:
    "客単価を「金額 通貨」の形式で送ってください。例: 10 USD / 40000 KHR",
  ticket_saved: "✅ 客単価を {amount} {currency} に設定しました。",
  ticket_invalid: "形式が正しくありません。例: 10 USD",
  low_review_title: "⚠️ 星{stars}の口コミが届きました",
  original: "元の口コミ",
  translation: "翻訳（{lang}）",
  draft_reply: "返信案（{lang}）",
  btn_send: "🟢 このまま送信",
  btn_edit: "✍️ 編集する",
  ask_edit:
    "返信したい内容をご自身の言葉で送ってください。相手の言語（{lang}）に翻訳して送信します。",
  edit_preview: "✍️ 編集後の返信案（{lang}）",
  sent: "✅ Googleマップに返信しました。",
  skipped: "スキップしました。",
  article_title: "📝 今週の記事下書き",
  btn_publish: "🟢 投稿する",
  btn_skip: "⏭ 見送る",
  published: "✅ Googleビジネスプロフィールに投稿しました。",
  not_connected: "先にGoogleと連携してください。/start を押してください。",
  error: "⚠️ エラーが発生しました。時間をおいて再度お試しください。",
};

const en: Dict = {
  welcome:
    "Welcome! Connect your Google Business Profile to automate review replies, posts and weekly reports.\n\nTap below to connect Google.",
  connect_google: "🔗 Connect Google",
  connected:
    "✅ Connected. I'll now watch for new reviews automatically. Use /settings to set your language and average ticket.",
  settings_title: "⚙️ Store settings",
  set_language: "🌐 Set your language",
  set_ticket: "💵 Set average ticket",
  choose_language: "Choose the language for notifications and translations.",
  lang_saved: "✅ Language set to \"{lang}\".",
  ask_ticket: "Send your average ticket as \"amount currency\". e.g. 10 USD / 40000 KHR",
  ticket_saved: "✅ Average ticket set to {amount} {currency}.",
  ticket_invalid: "Invalid format. Example: 10 USD",
  low_review_title: "⚠️ New {stars}-star review",
  original: "Original review",
  translation: "Translation ({lang})",
  draft_reply: "Draft reply ({lang})",
  btn_send: "🟢 Send as is",
  btn_edit: "✍️ Edit",
  ask_edit:
    "Type what you'd like to say in your own words. I'll translate it to the reviewer's language ({lang}) and send it.",
  edit_preview: "✍️ Edited reply ({lang})",
  sent: "✅ Replied on Google Maps.",
  skipped: "Skipped.",
  article_title: "📝 This week's post draft",
  btn_publish: "🟢 Publish",
  btn_skip: "⏭ Skip",
  published: "✅ Published to your Google Business Profile.",
  not_connected: "Please connect Google first. Tap /start.",
  error: "⚠️ Something went wrong. Please try again later.",
};

const km: Dict = {
  welcome:
    "សូមស្វាគមន៍! ភ្ជាប់ Google Business Profile ដើម្បីធ្វើស្វ័យប្រវត្តិកម្មការឆ្លើយតបមតិ ការបង្ហោះ និងរបាយការណ៍ប្រចាំសប្តាហ៍។\n\nចុចខាងក្រោមដើម្បីភ្ជាប់ Google។",
  connect_google: "🔗 ភ្ជាប់ Google",
  connected:
    "✅ បានភ្ជាប់រួចរាល់។ ខ្ញុំនឹងតាមដានមតិថ្មីដោយស្វ័យប្រវត្តិ។ ប្រើ /settings ដើម្បីកំណត់ភាសា និងតម្លៃមធ្យម។",
  settings_title: "⚙️ ការកំណត់ហាង",
  set_language: "🌐 កំណត់ភាសា",
  set_ticket: "💵 កំណត់តម្លៃមធ្យម",
  choose_language: "ជ្រើសរើសភាសាសម្រាប់ការជូនដំណឹង និងការបកប្រែ។",
  lang_saved: "✅ បានកំណត់ភាសាទៅ «{lang}»។",
  ask_ticket: "ផ្ញើតម្លៃមធ្យមជា «ចំនួន រូបិយប័ណ្ណ»។ ឧ. 10 USD / 40000 KHR",
  ticket_saved: "✅ បានកំណត់តម្លៃមធ្យម {amount} {currency}។",
  ticket_invalid: "ទម្រង់មិនត្រឹមត្រូវ។ ឧ. 10 USD",
  low_review_title: "⚠️ មតិផ្កាយ {stars} ថ្មី",
  original: "មតិដើម",
  translation: "ការបកប្រែ ({lang})",
  draft_reply: "សេចក្តីព្រាងឆ្លើយតប ({lang})",
  btn_send: "🟢 ផ្ញើដូចនេះ",
  btn_edit: "✍️ កែសម្រួល",
  ask_edit:
    "សរសេរអ្វីដែលអ្នកចង់និយាយតាមពាក្យរបស់អ្នក។ ខ្ញុំនឹងបកប្រែទៅភាសាអ្នកផ្តល់មតិ ({lang}) ហើយផ្ញើ។",
  edit_preview: "✍️ ការឆ្លើយតបដែលបានកែ ({lang})",
  sent: "✅ បានឆ្លើយតបនៅលើ Google Maps។",
  skipped: "បានរំលង។",
  article_title: "📝 សេចក្តីព្រាងអត្ថបទសប្តាហ៍នេះ",
  btn_publish: "🟢 បង្ហោះ",
  btn_skip: "⏭ រំលង",
  published: "✅ បានបង្ហោះទៅ Google Business Profile។",
  not_connected: "សូមភ្ជាប់ Google ជាមុនសិន។ ចុច /start។",
  error: "⚠️ មានបញ្ហា។ សូមព្យាយាមម្តងទៀត។",
};

const zh: Dict = {
  welcome:
    "欢迎！连接您的 Google 商家资料，即可自动回复评论、发布动态并接收周报。\n\n点击下方连接 Google。",
  connect_google: "🔗 连接 Google",
  connected:
    "✅ 已连接。我会自动监测新评论。使用 /settings 设置语言和客单价。",
  settings_title: "⚙️ 店铺设置",
  set_language: "🌐 设置语言",
  set_ticket: "💵 设置客单价",
  choose_language: "请选择用于通知和翻译的语言。",
  lang_saved: "✅ 语言已设置为「{lang}」。",
  ask_ticket: "请以「金额 货币」发送客单价。例如：10 USD / 40000 KHR",
  ticket_saved: "✅ 客单价已设置为 {amount} {currency}。",
  ticket_invalid: "格式不正确。例如：10 USD",
  low_review_title: "⚠️ 收到 {stars} 星评论",
  original: "原始评论",
  translation: "翻译（{lang}）",
  draft_reply: "回复草稿（{lang}）",
  btn_send: "🟢 直接发送",
  btn_edit: "✍️ 编辑",
  ask_edit: "请用您自己的话输入想说的内容。我会翻译成评论者的语言（{lang}）并发送。",
  edit_preview: "✍️ 编辑后的回复（{lang}）",
  sent: "✅ 已在 Google 地图回复。",
  skipped: "已跳过。",
  article_title: "📝 本周动态草稿",
  btn_publish: "🟢 发布",
  btn_skip: "⏭ 跳过",
  published: "✅ 已发布到您的 Google 商家资料。",
  not_connected: "请先连接 Google。点击 /start。",
  error: "⚠️ 出现错误，请稍后再试。",
};

const TABLE: Record<OwnerLang, Dict> = { ja, en, km, zh };

const LANG_NAME: Record<OwnerLang, string> = {
  ja: "日本語",
  en: "English",
  km: "ភាសាខ្មែរ",
  zh: "中文",
};

export function t(
  lang: OwnerLang,
  key: keyof typeof ja,
  params?: Record<string, string | number>,
): string {
  let s = TABLE[lang]?.[key] ?? ja[key] ?? String(key);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.replaceAll(`{${k}}`, String(v));
    }
  }
  return s;
}

export function langName(lang: OwnerLang): string {
  return LANG_NAME[lang];
}
