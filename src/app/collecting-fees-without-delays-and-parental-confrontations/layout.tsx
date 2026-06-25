import { ThemeProvider } from '@/components/theme-provider';
import type { ReactNode } from 'react';

export default function CollectingFeesLayout({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" forcedTheme="light">
      {children}
    </ThemeProvider>
  );
}
