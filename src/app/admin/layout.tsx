import type { Metadata } from 'next';
import { Suspense, type ReactNode } from 'react';
import { ThemeProvider } from '@/components/theme-provider';
import AdminLayoutClient from './layout-client';
import FirebaseBootstrap from '@/firebase/FirebaseBootstrap';

// The admin control plane is auth-gated; never index it.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Server Component wrapper for admin layout.
 * Provides Suspense boundary for useSearchParams usage in child components.
 * Renders FirebaseBootstrap here (not in root layout) to isolate dev-only
 * seeding logic from public-facing pages — prevents cross-page auth conflicts.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen w-full bg-background" />}>
      <ThemeProvider attribute="class" forcedTheme="dark" enableSystem={false}>
        <style dangerouslySetInnerHTML={{ __html: `
          :root {
            --org-primary: #3B5FFF;
            --org-secondary: #8B5CF6;
          }
        `}} />
        <FirebaseBootstrap />
        <AdminLayoutClient>{children}</AdminLayoutClient>
      </ThemeProvider>
    </Suspense>
  );
}
