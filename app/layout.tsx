import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
  keywords: ['WiFi management', 'captive portal', 'Abuja', 'Nigeria', 'hotspot billing', 'internet connectivity', 'Monnify hotspot'],
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}