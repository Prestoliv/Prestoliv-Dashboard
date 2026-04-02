import "./globals.css";
import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Prestoliv - Project Tracking & Client Communication",
    template: "%s | Prestoliv",
  },
  description:
    "Prestoliv helps teams track project milestones and communicate with customers in real time with updates, media attachments, and threaded query messages.",
  keywords: ["project tracking", "customer communication", "supabase", "realtime", "milestones", "queries", "media upload"],
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/logo.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "Prestoliv",
    title: "Prestoliv - Project Tracking & Client Communication",
    description:
      "Track milestones, share updates with media, and keep customer conversations in real time.",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "Prestoliv logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Prestoliv - Project Tracking & Client Communication",
    description: "Realtime project updates and customer messaging.",
    images: ["/logo.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

