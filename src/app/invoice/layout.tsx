import { ThemeProvider } from '@/components/theme-provider';
import type { ReactNode } from 'react';

export default function InvoiceLayout({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" forcedTheme="light" enableSystem={false}>
      {children}
    </ThemeProvider>
  );
}
