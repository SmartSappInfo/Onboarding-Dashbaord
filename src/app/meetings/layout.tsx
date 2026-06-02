import { ThemeProvider } from '@/components/theme-provider';
import { ThemeToggle } from '@/components/theme-toggle';
import type { ReactNode } from 'react';

export default function MeetingsLayout({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={true}>
      {children}
      <div className="fixed top-6 right-6 z-50 bg-background/80 hover:bg-background backdrop-blur-sm border border-white/10 rounded-full shadow-lg p-1 transition-all duration-300">
        <ThemeToggle />
      </div>
    </ThemeProvider>
  );
}
