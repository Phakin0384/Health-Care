import React from 'react';
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

// Self-hosted at build time rather than linked from fonts.googleapis.com. The
// demo is meant to run on a clinic LAN with no internet, where an external
// stylesheet is a render-blocking request that fails and drops the page back
// to a system font.
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-inter',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'Health Care - Central Clinic Staff Portal',
  description: 'Real-time patient intake registration system and staff monitoring portal.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-[#f7f9fb] text-[#191c1e] font-sans antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
