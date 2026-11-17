import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  weight: ['300', '400', '500', '600', '700'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains-mono',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'TrackMyWork - Hackathon Management Ecosystem',
  description: 'Zero-cost, hyper-optimized hackathon management with AI-powered automation',
  keywords: ['hackathon', 'project management', 'team collaboration', 'AI', 'NVIDIA NIM'],
  authors: [{ name: 'TrackMyWork Team' }],
  creator: 'TrackMyWork',
  publisher: 'TrackMyWork',
  robots: 'index, follow',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://trackmywork.app',
    title: 'TrackMyWork - Hackathon Management Ecosystem',
    description: 'Zero-cost, hyper-optimized hackathon management with AI-powered automation',
    siteName: 'TrackMyWork',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TrackMyWork',
    description: 'Zero-cost, hyper-optimized hackathon management with AI-powered automation',
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#a855f7',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen bg-surface-50">
        {children}
      </body>
    </html>
  );
}