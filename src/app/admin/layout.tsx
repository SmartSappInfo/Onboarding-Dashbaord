import { Suspense, type ReactNode } from 'react';
import { ThemeProvider } from '@/components/theme-provider';
import AdminLayoutClient from './layout-client';
import FirebaseBootstrap from '@/firebase/FirebaseBootstrap';

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
        <FirebaseBootstrap />
        <AdminLayoutClient>{children}</AdminLayoutClient>
      </ThemeProvider>
    </Suspense>
  );
}
