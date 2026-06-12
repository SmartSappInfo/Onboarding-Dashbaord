import { ThemeProvider } from '@/components/theme-provider';
import type { ReactNode } from 'react';

export default function CollectFeesLayout({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} forcedTheme="light">
      {children}
    </ThemeProvider>
  );
}
