import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EUDI Wallet Tracker",
  description:
    "Curated intelligence on EU Digital Identity Wallet developments",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,700&family=Epilogue:wght@600;700&family=Fraunces:opsz,wght@9..144,700;9..144,900&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="antialiased"
        style={
          {
            "--font-display": "'Fraunces', serif",
            "--font-body": "'DM Sans', sans-serif",
            "--font-label": "'Epilogue', sans-serif",
            "--font-mono": "'JetBrains Mono', monospace",
            fontFamily: "'DM Sans', sans-serif",
          } as React.CSSProperties
        }
      >
        {children}
      </body>
    </html>
  );
}
