import { Suspense, type ReactNode } from 'react';
import { ThemeProvider } from '@/components/theme-provider';
import AdminLayoutClient from './layout-client';

/**
 * Server Component wrapper for admin layout.
 * Provides Suspense boundary for useSearchParams usage in child components.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen w-full bg-background" />}>
      <ThemeProvider attribute="class" forcedTheme="dark" enableSystem={false}>
        <AdminLayoutClient>{children}</AdminLayoutClient>
      </ThemeProvider>
    </Suspense>
  );
}
