import type { ReactNode } from 'react';
import { Suspense } from 'react';
import AdminLayoutClient from './layout-client';

/**
 * Server Component wrapper for admin layout.
 * Provides Suspense boundary for useSearchParams usage in child components.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen w-full bg-background" />}>
      <AdminLayoutClient>{children}</AdminLayoutClient>
    </Suspense>
  );
}
