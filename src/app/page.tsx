import Link from "next/link";

const CONTACT_EMAIL = "matsuzaki@matsunoyafoods.com";

export default function Home() {
  return (
    <main
      style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#1D2E2E",
        maxWidth: 820,
        margin: "0 auto",
        padding: "0 20px 80px",
        lineHeight: 1.6,
      }}
    >
      <header style={{ padding: "48px 0 8px" }}>
        <p style={{ color: "#0F5257", fontWeight: 700, letterSpacing: 1, margin: 0 }}>
          MATSUNOYA MEO
        </p>
        <h1 style={{ fontSize: 34, margin: "8px 0 0" }}>
          Google Business Profile assistant for restaurants
        </h1>
        <p style={{ fontSize: 18, color: "#5F7373", marginTop: 12 }}>
          A Telegram-based tool that helps restaurant owners in Cambodia manage
          their Google Business Profile — reply to reviews, publish &ldquo;What&rsquo;s
          new&rdquo; posts, and receive weekly performance reports — entirely from a
          chat, without a computer.
        </p>
      </header>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 22 }}>What it does</h2>
        <ul style={{ paddingLeft: 20 }}>
          <li>
            Notifies the owner in Telegram when a new Google review arrives and
            drafts a reply in the reviewer&rsquo;s language for the owner to approve,
            edit, or send.
          </li>
          <li>
            Generates &ldquo;What&rsquo;s new&rdquo; posts and publishes them to the
            store&rsquo;s Google Business Profile after the owner&rsquo;s approval.
          </li>
          <li>
            Sends weekly and monthly performance summaries (direction requests,
            calls) so the owner can see how their listing is performing.
          </li>
          <li>
            Provides an MEO (local SEO) diagnosis of the store&rsquo;s public Google
            Maps listing with concrete suggestions to improve visibility.
          </li>
        </ul>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 22 }}>How Google data is used</h2>
        <p>
          With the store owner&rsquo;s explicit consent, this application connects to
          the owner&rsquo;s Google Business Profile to read reviews and performance
          insights and to publish review replies and posts on the owner&rsquo;s
          behalf. Access is used only to provide the features above. We never
          sell Google user data or use it for advertising. See our{" "}
          <Link href="/privacy" style={{ color: "#0F5257", fontWeight: 600 }}>
            Privacy Policy
          </Link>{" "}
          for full details.
        </p>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 22 }}>Contact</h2>
        <p>
          Operated by Matsunoya Foods LLC (合同会社 松之屋フーズ). For questions or
          data-deletion requests, contact{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "#0F5257", fontWeight: 600 }}>
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>

      <footer
        style={{
          marginTop: 48,
          paddingTop: 16,
          borderTop: "1px solid #E5E5E5",
          color: "#8A9A9A",
          fontSize: 14,
        }}
      >
        <Link href="/privacy" style={{ color: "#5F7373" }}>
          Privacy Policy
        </Link>
        <span style={{ margin: "0 8px" }}>·</span>
        <span>© 2026 Matsunoya Foods LLC</span>
      </footer>
    </main>
  );
}
