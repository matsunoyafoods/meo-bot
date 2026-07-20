import Link from "next/link";

const CONTACT_EMAIL = "matsuzaki@matsunoyafoods.com";
const LAST_UPDATED = "July 20, 2026";

const h2 = { fontSize: 20, marginTop: 32 } as const;

export default function Privacy() {
  return (
    <main
      style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#1D2E2E",
        maxWidth: 820,
        margin: "0 auto",
        padding: "48px 20px 80px",
        lineHeight: 1.65,
      }}
    >
      <p style={{ margin: 0 }}>
        <Link href="/" style={{ color: "#0F5257" }}>
          ← Home
        </Link>
      </p>
      <h1 style={{ fontSize: 30, marginTop: 12 }}>Privacy Policy</h1>
      <p style={{ color: "#5F7373" }}>Last updated: {LAST_UPDATED}</p>

      <p>
        This Privacy Policy explains how Matsunoya Foods LLC (合同会社 松之屋フーズ,
        &ldquo;we&rdquo;, &ldquo;us&rdquo;) collects, uses, stores, and shares
        information in connection with our Google Business Profile assistant for
        restaurants (the &ldquo;Service&rdquo;), which restaurant owners operate
        through Telegram. By connecting a Google account to the Service, the
        account owner agrees to this policy.
      </p>

      <h2 style={h2}>Google user data we access</h2>
      <p>
        With the account owner&rsquo;s explicit consent through Google&rsquo;s OAuth
        consent screen, and using the{" "}
        <code>https://www.googleapis.com/auth/business.manage</code> scope, the
        Service accesses the following data from the owner&rsquo;s Google Business
        Profile:
      </p>
      <ul style={{ paddingLeft: 20 }}>
        <li>Business account and location information (name, address, hours).</li>
        <li>Customer reviews and their content.</li>
        <li>Performance insights (e.g. direction requests and call clicks).</li>
      </ul>

      <h2 style={h2}>How we use the data</h2>
      <ul style={{ paddingLeft: 20 }}>
        <li>To notify the owner of new reviews and draft replies for their approval.</li>
        <li>To publish review replies and &ldquo;What&rsquo;s new&rdquo; posts to the owner&rsquo;s Google Business Profile, only after the owner approves them.</li>
        <li>To calculate and send weekly and monthly performance summaries to the owner.</li>
        <li>To provide an MEO (local SEO) diagnosis with improvement suggestions.</li>
      </ul>
      <p>
        We use the data solely to provide these features to the account owner. We
        do not use Google user data for advertising, and we do not sell it.
      </p>

      <h2 style={h2}>Service providers</h2>
      <p>
        We use the following processors strictly to operate the Service. Data is
        shared only as needed to deliver the features above:
      </p>
      <ul style={{ paddingLeft: 20 }}>
        <li>
          <strong>Google Generative AI (Gemini API)</strong> — review text and
          post topics are sent to generate draft replies and posts. This content
          is processed to produce text and is not used to train models.
        </li>
        <li>
          <strong>Supabase</strong> — secure database storage for the account&rsquo;s
          OAuth tokens and Service data.
        </li>
        <li>
          <strong>Vercel</strong> — application hosting.
        </li>
        <li>
          <strong>Telegram</strong> — delivery of messages and drafts to the owner.
        </li>
      </ul>

      <h2 style={h2}>Storage and retention</h2>
      <p>
        OAuth access and refresh tokens and the data needed to run the Service are
        stored securely and used only to provide the Service. We retain the data
        for as long as the account remains connected. When the owner disconnects
        the Service or requests deletion, we delete the stored tokens and
        associated data.
      </p>

      <h2 style={h2}>Limited Use disclosure</h2>
      <p>
        The Service&rsquo;s use and transfer of information received from Google APIs
        adheres to the{" "}
        <a
          href="https://developers.google.com/terms/api-services-user-data-policy"
          style={{ color: "#0F5257" }}
        >
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements.
      </p>

      <h2 style={h2}>Your controls</h2>
      <p>
        The account owner can revoke the Service&rsquo;s access at any time from their
        Google Account security settings (
        <a href="https://myaccount.google.com/permissions" style={{ color: "#0F5257" }}>
          myaccount.google.com/permissions
        </a>
        ), or by contacting us to disconnect and delete their data.
      </p>

      <h2 style={h2}>Contact</h2>
      <p>
        For any privacy question or a data-deletion request, contact{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "#0F5257", fontWeight: 600 }}>
          {CONTACT_EMAIL}
        </a>
        .
      </p>

      <footer
        style={{
          marginTop: 48,
          paddingTop: 16,
          borderTop: "1px solid #E5E5E5",
          color: "#8A9A9A",
          fontSize: 14,
        }}
      >
        © 2026 Matsunoya Foods LLC
      </footer>
    </main>
  );
}
