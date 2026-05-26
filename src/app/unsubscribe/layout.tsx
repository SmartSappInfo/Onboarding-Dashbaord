import { ThemeProvider } from '@/components/theme-provider';
import { ThemeToggle } from '@/components/theme-toggle';
import type { ReactNode } from 'react';

export default function UnsubscribeLayout({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={true}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 bg-background/80 hover:bg-background backdrop-blur-sm border rounded-full shadow-lg p-1 transition-all duration-300">
        <ThemeToggle />
      </div>
    </ThemeProvider>
  );
}
