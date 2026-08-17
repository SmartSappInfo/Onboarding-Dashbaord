'use client';

import { ThemeProvider } from '@/components/theme-provider';
import { PublicThemeToggleWrapper } from '@/components/PublicThemeToggleWrapper';
import { Suspense, type ReactNode } from 'react';

/**
 * ARCHITECTURAL NOTE (Rule 10 Maintainer Guidance):
 * Public Entity Pages Root Layout (/pe)
 * -------------------------------------
 * Wraps public entity pages (/pe/[entityId]).
 * Uses PublicThemeToggleWrapper inside <Suspense> to conditionally suppress
 * floating theme toggle buttons when embedded or displayed inside modal popups.
 */
export default function PeFolderLayout({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={true}>
      {children}
      <Suspense fallback={null}>
        <PublicThemeToggleWrapper size="sm" />
      </Suspense>
    </ThemeProvider>
  );
}
