import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { appEnv } from "@/lib/env";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: 'Connectly Technologies | WiFi Hotspot Management',
  description: 'Connectly builds and manages reliable internet connectivity infrastructure and automated captive portals for places that need better access.',
  keywords: ['WiFi management', 'captive portal', 'Abuja', 'Nigeria', 'hotspot billing', 'internet connectivity', 'hotspot billing'],
  openGraph: {
    title: 'Connectly Technologies',
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* Head is automatically managed by Next.js */}
      <body className="min-h-full flex flex-col">
        {appEnv() !== "production" && (
          <div className="w-full bg-amber-400 text-black text-center text-xs font-bold py-1 tracking-wide">
            {appEnv().toUpperCase()} ENVIRONMENT: test data and sandbox payments only
          </div>
        )}
        {children}
      </body>
    </html>
  );
}