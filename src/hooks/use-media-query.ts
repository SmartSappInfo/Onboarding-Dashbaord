'use client';

import { useState, useEffect } from 'react';

/**
 * Returns true when the given CSS media query matches.
 * SSR-safe: defaults to false on the server.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (typeof window.matchMedia === 'function') {
      const mql = window.matchMedia(query);
      setMatches(mql.matches);

      const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    }

    // Fallback for jsdom and environments without window.matchMedia
    const evalQuery = () => {
      const minMatch = query.match(/\(min-width:\s*(\d+)px\)/);
      if (minMatch && typeof window.innerWidth === 'number') {
        return window.innerWidth >= parseInt(minMatch[1], 10);
      }
      const maxMatch = query.match(/\(max-width:\s*(\d+)px\)/);
      if (maxMatch && typeof window.innerWidth === 'number') {
        return window.innerWidth <= parseInt(maxMatch[1], 10);
      }
      return false;
    };

    setMatches(evalQuery());
    const onResize = () => setMatches(evalQuery());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [query]);

  return matches;
}
