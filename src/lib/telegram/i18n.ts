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
  set_category: "🍜 ジャンル・商品を設定",
  set_keywords: "🔑 キーワードを設定",
  ask_category:
    "店舗のジャンル・主な商品を入力してください（例: ラーメン店、カフェ、焼肉店、タイ料理）。投稿文の生成に使います。",
  ask_keywords:
    "投稿で使いたいキーワードを入力してください（カンマ区切り。例: 味噌ラーメン, 餃子, 天文館, ランチ）。",
  category_saved: "✅ ジャンル・商品を「{v}」に設定しました。",
  keywords_saved: "✅ キーワードを設定しました。",
  set_area: "📍 エリア（市区町村）を設定",
  ask_area:
    "店舗のエリア（市区町村・地域名）を入力してください（例: 鹿児島市 天文館 / プノンペン BKK1）。投稿やMEOで地域名として使います。空欄にしたい場合は「なし」と入力。",
  area_saved: "✅ エリアを「{v}」に設定しました。",
  area_cleared: "✅ エリア設定を解除しました（地域名は使いません）。",
  set_name: "🏪 店名を設定",
  ask_name: "店名を入力してください（Googleマップに登録されている正式名がおすすめ。例: 麺屋あぶらや 天文館本店）。MEO診断・投稿・レポートで使います。",
  name_saved: "✅ 店名を「{v}」に設定しました。",
  setup_prompt:
    "はじめに初期設定をしましょう。下のボタンから、母国語・ジャンル・キーワード・客単価を設定できます（後で /settings でも変更できます）。",
  choose_language: "通知・翻訳に使う母国語を選んでください。",
  lang_saved: "✅ 母国語を「{lang}」に設定しました。",
  ask_ticket:
    "客単価を「金額 通貨」の形式で送ってください。通貨は自由です（例: 10 USD、120 THB、40000 KHR、1500 JPY、50000 VND）。",
  ticket_saved: "✅ 客単価を {amount} {currency} に設定しました。",
  ticket_invalid: "形式が正しくありません。例: 10 USD",
  low_review_title: "星{stars}の口コミが届きました",
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
  ask_post_keyword:
    "投稿したい内容やキーワードを入力してください（例: 金曜限定 辛味噌ラーメン 20%OFF、週末イベント）。AIが投稿文を作成します。",
  ask_post_edit:
    "どう直したいか、ご自身の言葉で送ってください（例: もっとカジュアルに、価格を追加、週末限定を強調）。内容を反映して下書きを作り直します。",
  diagnose_running: "🔍 GoogleマップのMEO状態を診断しています…（少々お待ちください）",
  diagnose_not_found:
    "お店のGoogleマップが見つかりませんでした。店名を正確に設定するか、Google連携をご確認ください。",
  diagnose_title: "🔍 MEO診断レポート",
  diagnose_score: "MEOスコア",
  diagnose_good: "✅ よい点",
  diagnose_improve: "🚀 改善するともっと伸びる",
  group_linked:
    "✅ このグループを店舗「{name}」のレポート配信先に登録しました。週次・月次レポートがここに届きます。",
  group_invalid: "招待リンクが無効です。管理者に新しいグループ用リンクをご確認ください。",
  backlog_none: "未返信の口コミはありません。すべて対応済みです。",
  backlog_summary:
    "📮 未返信の口コミが {total} 件あります。\n⭐ 4-5★: {high} 件\n⚠️ 1-3★: {low} 件\n\nどちらから対応しますか？",
  backlog_btn_high: "⭐ 4-5★ {n}件 の返信案を作成",
  backlog_btn_low: "⚠️ 1-3★ {n}件 を確認",
  backlog_high_ready:
    "⭐ 4-5★ の返信案を {n} 件作成しました。内容を確認して、よければ「まとめて送信」を押してください。",
  backlog_btn_sendall: "🟢 まとめて送信",
  backlog_btn_oneby: "✍️ 1件ずつ確認する",
  backlog_sent: "✅ {n} 件の返信を送信しました。",
  backlog_low_intro: "⚠️ 1-3★ を1件ずつ表示します（{n}件）。それぞれ確認して送信してください。",
  backlog_more: "残り {n} 件あります。もう一度 /reviews で続けられます。",
  btn_skip_review: "⏭ スキップ",
  menu_title: "何をしますか？下のボタンから選べます。",
  menu_post: "📝 投稿を作る",
  menu_diagnose: "🔍 MEO診断",
  menu_reviews: "📮 未返信口コミ",
  menu_settings: "⚙️ 設定",
  connection_ready:
    "🎉 店舗データの接続が完了しました！Googleの承認が下り、口コミ返信・記事投稿・週報がご利用いただけます。\n\n/menu からメニューを開けます。",
  trial_warn:
    "⏳ 無料期間はあと {days} 日（{date} まで）で終了します。終了後は自動で停止します。継続をご希望の場合は担当者へご連絡ください。",
  trial_ended:
    "🔒 無料期間が終了しました。投稿・口コミ返信・MEO診断・レポートは現在停止しています。継続してご利用いただくには担当者へご連絡ください。",
  subscribe_cta: "💳 継続する（お申し込み）",
  pay_link_msg: "お申し込みはこちらです（月額 $49・カード決済）。下のボタンからお進みください。",
  pay_link_btn: "💳 お支払いに進む",
  pay_unavailable: "現在お申し込みを受け付けできません。担当者へご連絡ください。",
  manage_link_msg: "契約の管理・解約はこちらからできます。",
  manage_link_btn: "🧾 契約を管理・解約",
  manage_unavailable: "まだご契約がありません。まずはお申し込みください。",
  menu_contact: "📞 問い合わせ",
  contact_prompt: "お問い合わせ内容を入力して送信してください。担当者に届きます。",
  contact_sent: "✅ 送信しました。担当者から折り返しご連絡します。",
  contact_unavailable: "現在お問い合わせを受け付けできません。恐れ入りますが後ほどお試しください。",
  subscribed_ok: "🎉 お申し込みありがとうございます！継続してご利用いただけます。/menu からどうぞ。",
  payment_ok: "✅ お支払いを確認しました。ありがとうございます。",
  payment_failed: "⚠️ お支払いに失敗しました。カードをご確認のうえ、/subscribe から再度お試しください。",
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
  set_category: "🍜 Set genre / products",
  set_keywords: "🔑 Set keywords",
  ask_category:
    "Enter your store's genre / main products (e.g. ramen shop, cafe, BBQ, Thai food). Used to generate posts.",
  ask_keywords:
    "Enter keywords to use in posts (comma-separated, e.g. miso ramen, gyoza, Phnom Penh, lunch).",
  category_saved: "✅ Genre / products set to \"{v}\".",
  keywords_saved: "✅ Keywords saved.",
  set_area: "📍 Set area (city / district)",
  ask_area:
    "Enter your area (city / district / neighborhood), e.g. “Tenmonkan, Kagoshima” or “BKK1, Phnom Penh”. It’s woven into posts and MEO. Type “none” to leave it unset.",
  area_saved: "✅ Area set to \"{v}\".",
  area_cleared: "✅ Area cleared (no locality will be used).",
  set_name: "🏪 Set store name",
  ask_name: "Enter your store name (ideally the exact name on Google Maps). It’s used in MEO diagnosis, posts and reports.",
  name_saved: "✅ Store name set to \"{v}\".",
  setup_prompt:
    "Let's set things up first. Use the buttons below to set your language, genre, keywords and average ticket (you can change them later with /settings).",
  choose_language: "Choose the language for notifications and translations.",
  lang_saved: "✅ Language set to \"{lang}\".",
  ask_ticket:
    "Send your average ticket as \"amount currency\". Any currency works (e.g. 10 USD, 120 THB, 40000 KHR, 1500 JPY, 50000 VND).",
  ticket_saved: "✅ Average ticket set to {amount} {currency}.",
  ticket_invalid: "Invalid format. Example: 10 USD",
  low_review_title: "New {stars}-star review",
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
  ask_post_keyword:
    "Type the content or keywords you want to post (e.g. Friday-only spicy miso ramen 20% off, weekend event). The AI will write the post.",
  ask_post_edit:
    "Tell me how to change it in your own words (e.g. make it more casual, add the price, emphasise the weekend-only deal). I'll rewrite the draft accordingly.",
  diagnose_running: "🔍 Checking your Google Maps MEO status… (please wait a moment)",
  diagnose_not_found:
    "Couldn't find your store on Google Maps. Please set the exact store name or check your Google connection.",
  diagnose_title: "🔍 MEO diagnosis report",
  diagnose_score: "MEO score",
  diagnose_good: "✅ What's good",
  diagnose_improve: "🚀 Improve these to grow",
  group_linked:
    "✅ This group is now a report channel for \"{name}\". Weekly and monthly reports will arrive here.",
  group_invalid: "Invalid invite link. Please ask the admin for a new group link.",
  backlog_none: "No unreplied reviews. You're all caught up.",
  backlog_summary:
    "📮 You have {total} unreplied reviews.\n⭐ 4-5★: {high}\n⚠️ 1-3★: {low}\n\nWhich would you like to handle?",
  backlog_btn_high: "⭐ Draft replies for {n} × 4-5★",
  backlog_btn_low: "⚠️ Review {n} × 1-3★",
  backlog_high_ready:
    "⭐ Drafted {n} replies for 4-5★. Review them and tap \"Send all\" if they look good.",
  backlog_btn_sendall: "🟢 Send all",
  backlog_btn_oneby: "✍️ Review one by one",
  backlog_sent: "✅ Sent {n} replies.",
  backlog_low_intro: "⚠️ Showing 1-3★ one by one ({n}). Please review and send each.",
  backlog_more: "{n} left. Run /reviews again to continue.",
  btn_skip_review: "⏭ Skip",
  menu_title: "What would you like to do? Pick from the buttons below.",
  menu_post: "📝 Create a post",
  menu_diagnose: "🔍 MEO check",
  menu_reviews: "📮 Unreplied reviews",
  menu_settings: "⚙️ Settings",
  connection_ready:
    "🎉 Your store is now connected! Google approved access, so review replies, posts and weekly reports are ready to use.\n\nOpen the menu with /menu.",
  trial_warn:
    "⏳ Your free period ends in {days} day(s) — on {date}. After that the bot pauses automatically. Contact us if you'd like to continue.",
  trial_ended:
    "🔒 Your free period has ended. Posts, review replies, MEO checks and reports are paused. Contact us to keep using MapBoost.",
  subscribe_cta: "💳 Subscribe to continue",
  pay_link_msg: "Here is your subscription link ($49/month, card). Tap the button below to continue.",
  pay_link_btn: "💳 Go to payment",
  pay_unavailable: "Subscription is not available right now. Please contact us.",
  manage_link_msg: "Manage or cancel your subscription here.",
  manage_link_btn: "🧾 Manage / cancel",
  manage_unavailable: "You do not have a subscription yet. Please subscribe first.",
  menu_contact: "📞 Contact us",
  contact_prompt: "Type your message and send it. It will reach our team.",
  contact_sent: "✅ Sent. Our team will get back to you.",
  contact_unavailable: "Contact is unavailable right now. Please try again later.",
  subscribed_ok: "🎉 Thanks for subscribing! You can keep using MapBoost. Open /menu.",
  payment_ok: "✅ Payment confirmed. Thank you!",
  payment_failed: "⚠️ Your payment failed. Please check your card and try again via /subscribe.",
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
  set_category: "🍜 កំណត់ប្រភេទ/ផលិតផល",
  set_keywords: "🔑 កំណត់ពាក្យគន្លឹះ",
  ask_category:
    "សូមបញ្ចូលប្រភេទហាង/ផលិតផលសំខាន់ (ឧ. ហាងរ៉ាមេន, ហាងកាហ្វេ, សាច់អាំង, ម្ហូបថៃ)។ ប្រើសម្រាប់បង្កើតអត្ថបទ។",
  ask_keywords:
    "សូមបញ្ចូលពាក្យគន្លឹះសម្រាប់ការបង្ហោះ (បំបែកដោយសញ្ញាក្បៀស ឧ. រ៉ាមេនមីសូ, គ្យូហ្សា, ភ្នំពេញ, អាហារថ្ងៃត្រង់)។",
  category_saved: "✅ បានកំណត់ប្រភេទ/ផលិតផលទៅ «{v}»។",
  keywords_saved: "✅ បានរក្សាទុកពាក្យគន្លឹះ។",
  set_area: "📍 កំណត់តំបន់ (ក្រុង/សង្កាត់)",
  ask_area:
    "សូមបញ្ចូលតំបន់របស់អ្នក (ក្រុង/សង្កាត់/មូលដ្ឋាន) ឧ. «BKK1, ភ្នំពេញ»។ វានឹងត្រូវប្រើក្នុងការបង្ហោះ និង MEO។ វាយ «none» ដើម្បីទុកចោល។",
  area_saved: "✅ បានកំណត់តំបន់ទៅ «{v}»។",
  area_cleared: "✅ បានលុបតំបន់ (មិនប្រើឈ្មោះតំបន់ទេ)។",
  set_name: "🏪 កំណត់ឈ្មោះហាង",
  ask_name: "សូមបញ្ចូលឈ្មោះហាងរបស់អ្នក (ល្អបំផុតគឺឈ្មោះពិតប្រាកដនៅលើ Google Maps)។ វាប្រើក្នុងការវិនិច្ឆ័យ MEO ការបង្ហោះ និងរបាយការណ៍។",
  name_saved: "✅ បានកំណត់ឈ្មោះហាងទៅ «{v}»។",
  setup_prompt:
    "ដំបូងសូមកំណត់ការកំណត់។ ប្រើប៊ូតុងខាងក្រោមដើម្បីកំណត់ភាសា ប្រភេទ ពាក្យគន្លឹះ និងតម្លៃមធ្យម (អាចផ្លាស់ប្តូរពេលក្រោយដោយ /settings)។",
  choose_language: "ជ្រើសរើសភាសាសម្រាប់ការជូនដំណឹង និងការបកប្រែ។",
  lang_saved: "✅ បានកំណត់ភាសាទៅ «{lang}»។",
  ask_ticket:
    "ផ្ញើតម្លៃមធ្យមជា «ចំនួន រូបិយប័ណ្ណ»។ រូបិយប័ណ្ណណាក៏បាន (ឧ. 10 USD, 120 THB, 40000 KHR, 1500 JPY, 50000 VND)។",
  ticket_saved: "✅ បានកំណត់តម្លៃមធ្យម {amount} {currency}។",
  ticket_invalid: "ទម្រង់មិនត្រឹមត្រូវ។ ឧ. 10 USD",
  low_review_title: "មតិផ្កាយ {stars} ថ្មី",
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
  ask_post_keyword:
    "សូមបញ្ចូលខ្លឹមសារ ឬពាក្យគន្លឹះដែលអ្នកចង់បង្ហោះ (ឧ. រ៉ាមេនម្សៅហឹរ តែថ្ងៃសុក្រ បញ្ចុះ 20%, ព្រឹត្តិការណ៍ចុងសប្តាហ៍)។ AI នឹងសរសេរអត្ថបទ។",
  ask_post_edit:
    "សូមប្រាប់ពីរបៀបដែលអ្នកចង់កែ តាមពាក្យរបស់អ្នក (ឧ. ធ្វើឱ្យធម្មតាជាង, បន្ថែមតម្លៃ, បញ្ជាក់ការបញ្ចុះតម្លៃចុងសប្តាហ៍)។ ខ្ញុំនឹងសរសេរសេចក្តីព្រាងឡើងវិញ។",
  diagnose_running: "🔍 កំពុងវិនិច្ឆ័យស្ថានភាព MEO នៅ Google Maps… (សូមរង់ចាំបន្តិច)",
  diagnose_not_found:
    "រកមិនឃើញហាងរបស់អ្នកនៅ Google Maps ទេ។ សូមកំណត់ឈ្មោះហាងឲ្យត្រឹមត្រូវ ឬពិនិត្យការភ្ជាប់ Google។",
  diagnose_title: "🔍 របាយការណ៍វិនិច្ឆ័យ MEO",
  diagnose_score: "ពិន្ទុ MEO",
  diagnose_good: "✅ ចំណុចល្អ",
  diagnose_improve: "🚀 កែសម្រួលដើម្បីលូតលាស់",
  group_linked:
    "✅ ក្រុមនេះត្រូវបានចុះឈ្មោះជាកន្លែងទទួលរបាយការណ៍សម្រាប់ហាង «{name}»។ របាយការណ៍ប្រចាំសប្តាហ៍/ខែ នឹងមកដល់ទីនេះ។",
  group_invalid: "តំណអញ្ជើញមិនត្រឹមត្រូវ។ សូមសុំតំណក្រុមថ្មីពីអ្នកគ្រប់គ្រង។",
  backlog_none: "គ្មានមតិដែលមិនទាន់ឆ្លើយតបទេ។ អ្នកបានដោះស្រាយអស់ហើយ។",
  backlog_summary:
    "📮 មានមតិមិនទាន់ឆ្លើយតប {total} ។\n⭐ 4-5★: {high}\n⚠️ 1-3★: {low}\n\nចង់ដោះស្រាយមួយណាមុន?",
  backlog_btn_high: "⭐ បង្កើតការឆ្លើយតប {n} × 4-5★",
  backlog_btn_low: "⚠️ ពិនិត្យ {n} × 1-3★",
  backlog_high_ready:
    "⭐ បានបង្កើតការឆ្លើយតប {n} សម្រាប់ 4-5★។ ពិនិត្យ ហើយចុច «ផ្ញើទាំងអស់» បើត្រឹមត្រូវ។",
  backlog_btn_sendall: "🟢 ផ្ញើទាំងអស់",
  backlog_btn_oneby: "✍️ ពិនិត្យម្តងមួយ",
  backlog_sent: "✅ បានផ្ញើការឆ្លើយតប {n} ។",
  backlog_low_intro: "⚠️ បង្ហាញ 1-3★ ម្តងមួយ ({n})។ សូមពិនិត្យ ហើយផ្ញើម្តងមួយ។",
  backlog_more: "នៅសល់ {n} ។ ចុច /reviews ម្តងទៀតដើម្បីបន្ត។",
  btn_skip_review: "⏭ រំលង",
  menu_title: "តើអ្នកចង់ធ្វើអ្វី? សូមជ្រើសរើសពីប៊ូតុងខាងក្រោម។",
  menu_post: "📝 បង្កើតការបង្ហោះ",
  menu_diagnose: "🔍 វិនិច្ឆ័យ MEO",
  menu_reviews: "📮 មតិមិនទាន់ឆ្លើយតប",
  menu_settings: "⚙️ ការកំណត់",
  connection_ready:
    "🎉 ហាងរបស់អ្នកបានភ្ជាប់រួចរាល់! Google បានអនុម័ត ដូច្នេះការឆ្លើយតបមតិ ការបង្ហោះ និងរបាយការណ៍ប្រចាំសប្តាហ៍ អាចប្រើបានហើយ។\n\nបើកម៉ឺនុយដោយ /menu។",
  trial_warn:
    "⏳ រយៈពេលសាកល្បងឥតគិតថ្លៃនឹងបញ្ចប់ក្នុងរយៈពេល {days} ថ្ងៃ (ត្រឹម {date})។ បន្ទាប់មកប្រព័ន្ធនឹងផ្អាកដោយស្វ័យប្រវត្តិ។ សូមទាក់ទងមកយើងបើចង់បន្ត។",
  trial_ended:
    "🔒 រយៈពេលសាកល្បងឥតគិតថ្លៃបានបញ្ចប់ហើយ។ ការបង្ហោះ ការឆ្លើយតបមតិ ការវិនិច្ឆ័យ MEO និងរបាយការណ៍ត្រូវបានផ្អាក។ សូមទាក់ទងមកយើងដើម្បីបន្ត។",
  subscribe_cta: "💳 ជាវ ដើម្បីបន្ត",
  pay_link_msg: "នេះជាតំណជាវរបស់អ្នក ($49/ខែ ដោយកាត)។ សូមចុចប៊ូតុងខាងក្រោមដើម្បីបន្ត។",
  pay_link_btn: "💳 ទៅកាន់ការទូទាត់",
  pay_unavailable: "មិនអាចទទួលការជាវបានទេនៅពេលនេះ។ សូមទាក់ទងមកយើង។",
  manage_link_msg: "គ្រប់គ្រង ឬបោះបង់ការជាវនៅទីនេះ។",
  manage_link_btn: "🧾 គ្រប់គ្រង / បោះបង់",
  manage_unavailable: "អ្នកមិនទាន់មានការជាវទេ។ សូមជាវជាមុនសិន។",
  menu_contact: "📞 ទំនាក់ទំនង",
  contact_prompt: "សូមវាយសាររបស់អ្នក ហើយផ្ញើ។ វានឹងទៅដល់ក្រុមការងាររបស់យើង។",
  contact_sent: "✅ បានផ្ញើ។ ក្រុមការងាររបស់យើងនឹងឆ្លើយតបទៅវិញ។",
  contact_unavailable: "មិនអាចទំនាក់ទំនងបានទេឥឡូវនេះ។ សូមព្យាយាមម្តងទៀតនៅពេលក្រោយ។",
  subscribed_ok: "🎉 អរគុណសម្រាប់ការជាវ! អ្នកអាចបន្តប្រើ MapBoost បាន។ បើក /menu។",
  payment_ok: "✅ បានបញ្ជាក់ការទូទាត់។ សូមអរគុណ!",
  payment_failed: "⚠️ ការទូទាត់បរាជ័យ។ សូមពិនិត្យកាត ហើយព្យាយាមម្តងទៀតតាម /subscribe។",
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
  set_category: "🍜 设置类别/商品",
  set_keywords: "🔑 设置关键词",
  ask_category:
    "请输入店铺类别/主要商品（例：拉面店、咖啡馆、烧烤、泰国菜）。用于生成帖文。",
  ask_keywords:
    "请输入用于帖文的关键词（用逗号分隔，例：味噌拉面, 饺子, 金边, 午餐）。",
  category_saved: "✅ 类别/商品已设置为「{v}」。",
  keywords_saved: "✅ 关键词已保存。",
  set_area: "📍 设置地区（城市/街区）",
  ask_area:
    "请输入您的地区（城市/街区/地段），例如「鹿儿岛 天文馆」或「金边 BKK1」。将用于帖文和MEO。输入「none」可清空。",
  area_saved: "✅ 地区已设置为「{v}」。",
  area_cleared: "✅ 已清除地区（不使用地区名）。",
  set_name: "🏪 设置店名",
  ask_name: "请输入店名（建议与 Google 地图上的正式名称一致）。用于MEO诊断、帖文和报告。",
  name_saved: "✅ 店名已设置为「{v}」。",
  setup_prompt:
    "先来做初始设置吧。用下方按钮设置语言、类别、关键词和客单价（之后可用 /settings 修改）。",
  choose_language: "请选择用于通知和翻译的语言。",
  lang_saved: "✅ 语言已设置为「{lang}」。",
  ask_ticket:
    "请以「金额 货币」发送客单价。任何货币均可（例：10 USD、120 THB、40000 KHR、1500 JPY、50000 VND）。",
  ticket_saved: "✅ 客单价已设置为 {amount} {currency}。",
  ticket_invalid: "格式不正确。例如：10 USD",
  low_review_title: "收到 {stars} 星评论",
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
  ask_post_keyword:
    "请输入您想发布的内容或关键词（例：仅限周五的辣味噌拉面 20% 折扣、周末活动）。AI 将撰写帖文。",
  ask_post_edit:
    "请用您自己的话告诉我如何修改（例：更口语化、加上价格、强调周末限定）。我会据此重写草稿。",
  diagnose_running: "🔍 正在诊断您的 Google 地图 MEO 状态……（请稍候）",
  diagnose_not_found:
    "在 Google 地图上找不到您的店铺。请设置准确的店名或检查 Google 连接。",
  diagnose_title: "🔍 MEO 诊断报告",
  diagnose_score: "MEO 评分",
  diagnose_good: "✅ 做得好的地方",
  diagnose_improve: "🚀 改进后可增长",
  group_linked:
    "✅ 本群已登记为店铺「{name}」的报告接收群。周报和月报将发送到这里。",
  group_invalid: "邀请链接无效。请向管理员索取新的群链接。",
  backlog_none: "没有未回复的评论，全部已处理。",
  backlog_summary:
    "📮 有 {total} 条未回复的评论。\n⭐ 4-5★: {high}\n⚠️ 1-3★: {low}\n\n先处理哪一类？",
  backlog_btn_high: "⭐ 为 {n} 条 4-5★ 生成回复",
  backlog_btn_low: "⚠️ 查看 {n} 条 1-3★",
  backlog_high_ready:
    "⭐ 已为 4-5★ 生成 {n} 条回复。请查看，若无问题请点「全部发送」。",
  backlog_btn_sendall: "🟢 全部发送",
  backlog_btn_oneby: "✍️ 逐条确认",
  backlog_sent: "✅ 已发送 {n} 条回复。",
  backlog_low_intro: "⚠️ 逐条显示 1-3★（{n} 条）。请逐条查看并发送。",
  backlog_more: "还剩 {n} 条。再次运行 /reviews 可继续。",
  btn_skip_review: "⏭ 跳过",
  menu_title: "您想做什么？请从下方按钮选择。",
  menu_post: "📝 创建帖文",
  menu_diagnose: "🔍 MEO 诊断",
  menu_reviews: "📮 未回复评论",
  menu_settings: "⚙️ 设置",
  connection_ready:
    "🎉 您的店铺已连接完成！Google 已批准访问，评论回复、动态发布和周报现已可用。\n\n使用 /menu 打开菜单。",
  trial_warn:
    "⏳ 免费试用还有 {days} 天结束（截至 {date}）。之后系统将自动暂停。如需继续请联系我们。",
  trial_ended:
    "🔒 免费试用已结束。发布、评论回复、MEO 诊断和报告已暂停。如需继续使用请联系我们。",
  subscribe_cta: "💳 订阅以继续",
  pay_link_msg: "这是您的订阅链接（每月 $49・刷卡）。请点击下方按钮继续。",
  pay_link_btn: "💳 前往付款",
  pay_unavailable: "目前无法受理订阅，请联系我们。",
  manage_link_msg: "在此管理或取消订阅。",
  manage_link_btn: "🧾 管理 / 取消",
  manage_unavailable: "您还没有订阅，请先订阅。",
  menu_contact: "📞 联系我们",
  contact_prompt: "请输入您的留言并发送，我们的团队会收到。",
  contact_sent: "✅ 已发送。我们的团队会尽快回复您。",
  contact_unavailable: "目前无法接受咨询，请稍后再试。",
  subscribed_ok: "🎉 感谢订阅！您可以继续使用 MapBoost。打开 /menu。",
  payment_ok: "✅ 已确认付款，谢谢！",
  payment_failed: "⚠️ 付款失败。请检查银行卡后通过 /subscribe 重试。",
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
