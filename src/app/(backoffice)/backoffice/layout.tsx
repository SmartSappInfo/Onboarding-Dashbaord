import type { Metadata } from 'next';
import { Suspense, type ReactNode } from 'react';
import { ThemeProvider } from '@/components/theme-provider';
import BackofficeLayoutClient from './layout-client';

// The backoffice control plane is auth-gated; never index it.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * Enforces dynamic rendering across all nested /backoffice/* routes to prevent Next.js
 * from attempting build-time static generation or Firestore evaluation in CI.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
