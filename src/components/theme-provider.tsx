'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ThemeProviderProps } from 'next-themes';

/**
 * Theme provider wrapper for next-themes.
 * 
 * Note: next-themes injects a script tag to prevent FOUC (Flash of Unstyled Content).
 * React 19 warns about script tags in the component tree, but this is expected behavior
 * and the script is necessary for proper theme initialization before hydration.
 * 
 * The warning can be safely ignored as next-themes handles this correctly.
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
