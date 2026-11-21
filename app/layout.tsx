import type { Metadata } from "next";
import { Schibsted_Grotesk, Geist_Mono } from "next/font/google";
import "./globals.css";
import { EnvBanner } from "@/components/env-banner";

const schibsted = Schibsted_Grotesk({
  variable: "--font-schibsted",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: 'Connectly Networks',
  description: 'Connectly Networks designs, installs and runs paid WiFi for markets, campuses, hostels and estates in Northern Nigeria.',
  keywords: ['managed WiFi', 'paid WiFi', 'hotspot', 'Abuja', 'Northern Nigeria', 'internet connectivity'],
  openGraph: {
    title: 'Connectly Networks',
    description: 'Reliable internet connectivity infrastructure and automated hotspot management.',
    url: 'https://getconnectly.net',
    siteName: 'Connectly',
    images: [
      {
        url: 'https://getconnectly.net/connectly-logo-horizontal.svg',
        width: 1200,
        height: 630,
        alt: 'Connectly Technologies Logo',
      }
    ],
    locale: 'en_NG',
    type: 'website',
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${schibsted.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* Head is automatically managed by Next.js */}
      <body className="min-h-full flex flex-col">
        <EnvBanner />
        {children}
      </body>
    </html>
  );
}