'use client';

import { useEffect } from 'react';
import { useNavigation } from '@/context/NavigationContext';
import { usePathname } from 'next/navigation';

/**
 * Custom hook to declaratively set a dynamic label for a path segment in the breadcrumb.
 * Useful for resolving IDs to Names (e.g. School ID -> 'Ghana International School').
 * 
 * @param label The human-readable name to display.
 * @param pathOverride Optional path to label. Defaults to current pathname.
 */
export function useSetBreadcrumb(label: string | null | undefined, pathOverride?: string) {
  const { setCustomLabel } = useNavigation();
  const pathname = usePathname();
  const targetPath = pathOverride || pathname;

  useEffect(() => {
    if (label) {
      setCustomLabel(targetPath, label);
    }
  }, [label, targetPath, setCustomLabel]);
}
