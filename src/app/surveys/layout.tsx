'use client';

import { ThemeProvider } from '@/components/theme-provider';
import { PublicThemeToggleWrapper } from '@/components/PublicThemeToggleWrapper';
import { Suspense, ReactNode } from 'react';
import IframeResizer from '@/components/iframe-resizer';

/**
 * ARCHITECTURAL NOTE (Rule 10 Maintainer Guidance):
 * Surveys Root Layout (/surveys)
 * -----------------------------
 * Wraps public surveys (/surveys/[slug]).
 * Uses PublicThemeToggleWrapper inside <Suspense> to conditionally suppress
 * floating theme toggle buttons when embedded or displayed inside modal popups.
 */
export default function SurveysLayout({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={true}>
      {children}
      <Suspense fallback={null}>
        <PublicThemeToggleWrapper size="sm" />
      </Suspense>
      <Suspense fallback={null}>
        <IframeResizer />
      </Suspense>
    </ThemeProvider>
  );
}
