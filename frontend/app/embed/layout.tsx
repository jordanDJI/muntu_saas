import type { Metadata } from "next";

export const metadata: Metadata = { title: "Widget" };

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
      </head>
      <body style={{ margin: 0, padding: 0, fontFamily: "system-ui, sans-serif", background: "transparent" }}>
        {children}
      </body>
    </html>
  );
}
