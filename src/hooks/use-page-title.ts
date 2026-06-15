'use client';

import { useLayoutEffect } from 'react';

/**
 * Sets `document.title` to the given value for the lifetime of the calling
 * component. `useLayoutEffect` applies it synchronously before paint, so there
 * is no visible flicker of the previous title on client navigations. On unmount
 * the previous title is restored (e.g. when leaving the admin/backoffice shell).
 *
 * Admin/Backoffice are `'use client'` SPAs, so Next's `generateMetadata`
 * (Server-Component-only) cannot drive their tab titles — this hook does.
 */
export function usePageTitle(title: string | undefined): void {
  useLayoutEffect(() => {
    if (!title) return;
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
