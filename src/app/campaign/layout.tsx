import { ThemeProvider } from '@/components/theme-provider';
import { ThemeToggle } from '@/components/theme-toggle';
import type { ReactNode } from 'react';

export default function CampaignLayout({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={true}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 bg-background/80 hover:bg-background backdrop-blur-md border rounded-full shadow-md p-0.5 transition-all duration-300">
        <ThemeToggle size="sm" />
      </div>
    </ThemeProvider>
  );
}
