import { Suspense, type ReactNode } from 'react';
import { ThemeProvider } from '@/components/theme-provider';
import BackofficeLayoutClient from './layout-client';

/**
 * Server Component wrapper for the Backoffice control plane.
 * Provides a Suspense boundary and forces dark theme.
 */
export default function BackofficeLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen w-full bg-background" />}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <BackofficeLayoutClient>{children}</BackofficeLayoutClient>
      </ThemeProvider>
    </Suspense>
  );
}
