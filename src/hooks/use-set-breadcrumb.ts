'use client';

import { useEffect } from 'react';
import { useNavigation } from '@/context/NavigationContext';
import { usePathname } from 'next/navigation';

/**
 * Custom hook to declaratively set a dynamic label for the current path in the breadcrumb.
 * Useful for resolving IDs to Names (e.g. School ID -> 'Ghana International School').
 */
export function useSetBreadcrumb(label: string | null | undefined) {
  const { setCustomLabel } = useNavigation();
  const pathname = usePathname();

  useEffect(() => {
    if (label) {
      setCustomLabel(pathname, label);
    }
  }, [label, pathname, setCustomLabel]);
}
