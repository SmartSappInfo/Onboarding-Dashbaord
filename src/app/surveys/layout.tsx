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
    <div className="fixed bottom-4 right-4 z-50 bg-background/80 hover:bg-background backdrop-blur-md border rounded-full shadow-md p-0.5 transition-all duration-300">
      <ThemeToggle size="sm" />
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
