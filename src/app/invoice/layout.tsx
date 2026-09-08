import { ThemeProvider } from '@/components/theme-provider';
import { ThemeToggle } from '@/components/theme-toggle';
import type { ReactNode } from 'react';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * Enforces dynamic rendering across /invoice/* routes to prevent Next.js from attempting
 * build-time static generation of invoice documents that depend on Firestore customer data.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function InvoiceLayout({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={true}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 bg-background/80 hover:bg-background backdrop-blur-sm border rounded-full shadow-lg p-1 transition-all duration-300">
        <ThemeToggle />
      </div>
    </ThemeProvider>
  );
}
