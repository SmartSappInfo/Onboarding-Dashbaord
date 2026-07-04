'use client';

import { ThemeProvider } from '@/components/theme-provider';
import { ThemeToggle } from '@/components/theme-toggle';
import { useSearchParams } from 'next/navigation';
import { Suspense, ReactNode } from 'react';
import IframeResizer from '@/components/iframe-resizer';

function ThemeToggleWrapper() {
  const searchParams = useSearchParams();
  const isEmbedded = searchParams?.get('embed') === 'true';

  if (isEmbedded) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 bg-background/80 hover:bg-background backdrop-blur-sm border rounded-full shadow-lg p-1 transition-all duration-300">
      <ThemeToggle />
    </div>
  );
}

export default function SurveysLayout({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={true}>
      {children}
      <Suspense fallback={null}>
        <ThemeToggleWrapper />
      </Suspense>
      <Suspense fallback={null}>
        <IframeResizer />
      </Suspense>
    </ThemeProvider>
  );
}
