'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';

interface MeetingThemeProviderProps {
  children: React.ReactNode;
  forceDark?: boolean;
}

/**
 * MeetingThemeProvider ensures that training pages are forced to dark mode
 * while maintaining flexibility for other meeting types.
 */
export function MeetingThemeProvider({ children, forceDark }: MeetingThemeProviderProps) {
  const { setTheme, resolvedTheme } = useTheme();

  React.useEffect(() => {
    if (forceDark) {
      setTheme('dark');
    }
  }, [forceDark, setTheme]);

  return (
    <div className={forceDark ? 'dark bg-background text-foreground' : ''}>
      {children}
    </div>
  );
}
