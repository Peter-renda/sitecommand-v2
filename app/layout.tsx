import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import DemoProvider from "@/components/DemoProvider";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://sitecommand.com"),
  title: {
    default: "SiteCommand – Construction Management Software",
    template: "%s | SiteCommand",
  },
  description:
    "SiteCommand is modern construction management software for contractors and project managers. Track RFIs, submittals, daily logs, drawings, and schedules — all in one place.",
  alternates: {
    canonical: "/",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=DM+Serif+Display:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <DemoProvider />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
