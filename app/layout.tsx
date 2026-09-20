import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Pathfinders Voice — Care evidence from every conversation',
  description:
    'Turn aged-care briefings and handovers into structured, source-linked evidence mapped to Australia’s National Quality Indicators.',
  openGraph: {
    title: 'Pathfinders Voice',
    description: 'Care conversations. Traceable evidence.',
    type: 'website',
    url: 'https://pathfinders-voice-aged-care.karrot-7818.chatgpt.site',
    images: [
      {
        url: 'https://pathfinders-voice-aged-care.karrot-7818.chatgpt.site/og.png',
        width: 1734,
        height: 907,
        alt: 'Pathfinders Voice — Care conversations. Traceable evidence.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pathfinders Voice',
    description: 'Care conversations. Traceable evidence.',
    images: ['https://pathfinders-voice-aged-care.karrot-7818.chatgpt.site/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-AU">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
