import { ThemeProvider } from '@/components/theme-provider';
import { ThemeToggle } from '@/components/theme-toggle';
import { Suspense, ReactNode } from 'react';
import IframeResizer from '@/components/iframe-resizer';

export default function MeetingsLayout({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={true}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 bg-background/80 hover:bg-background backdrop-blur-md border border-white/10 rounded-full shadow-md p-0.5 transition-all duration-300">
        <ThemeToggle size="sm" />
      </div>
      <Suspense fallback={null}>
        <IframeResizer />
      </Suspense>
    </ThemeProvider>
  );
}
