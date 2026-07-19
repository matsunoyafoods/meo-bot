export const metadata = {
  title: "MEO Bot",
  description: "MEO automation PoC backend",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
