import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase';

export const metadata: Metadata = {
  title: {
    default: 'Welcome To SmartSapp Family',
    template: '%s — SmartSapp',
  },
  description: 'Onboarding for SmartsApp Schools - Child Security, Parents\' Convenience, Smarter Schools.',
  openGraph: {
    title: 'SmartSapp Onboarding',
    description: 'Automating the SmartSapp institutional onboarding experience.',
    images: [
      {
        url: 'https://firebasestorage.googleapis.com/v0/b/studio-9220106300-f74cb.firebasestorage.app/o/media%2Fimage%2F1772732878319-Onboarding%20Meta%20image.webp?alt=media&token=f74f6912-135d-4b5e-b784-609017e6bb12',
        width: 1200,
        height: 630,
        alt: 'SmartSapp Onboarding',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SmartSapp Onboarding',
    description: 'Automating the SmartSapp institutional onboarding experience.',
    images: ['https://firebasestorage.googleapis.com/v0/b/studio-9220106300-f74cb.firebasestorage.app/o/media%2Fimage%2F1772732878319-Onboarding%20Meta%20image.webp?alt=media&token=f74f6912-135d-4b5e-b784-609017e6bb12'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@700;900&family=Figtree:wght@400;700&family=Raleway:ital,wght@0,400;1,400&family=League+Script&family=Mrs+Saint+Delafield&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased" suppressHydrationWarning>
        <FirebaseClientProvider>
          {children}
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
