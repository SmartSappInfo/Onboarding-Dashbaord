'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { ThemeToggle } from '@/components/theme-toggle';

export interface PublicThemeToggleWrapperProps {
  className?: string;
  size?: 'default' | 'sm' | 'xs';
}

/**
 * ARCHITECTURAL NOTE (Rule 10 Maintainer Guidance):
 * PublicThemeToggleWrapper Component
 * -----------------------------------
 * Controls the visibility of the floating theme toggle button on public landing pages,
 * public forms (/p/f/[slug]), PDF forms (/forms/[pdfId]), and surveys (/surveys/[slug]).
 * 
 * 1. Modal / Embedded Suppression:
 *    When `embed=true` or `modal=true` or `isInModal=true` is set in the URL search params,
 *    this component returns `null` so that no theme button renders over modal popups.
 * 
 * 2. Mobile Touch & Usability:
 *    When standalone, renders a floating circular button at `bottom-4 right-4` with
 *    `min-h-[44px]` touch target, backdrop blur, and high contrast outline.
 * 
 * 3. Testability & SSR Safety:
 *    Must be rendered inside a `<Suspense fallback={null}>` block in Next.js App Router layouts.
 */
export function PublicThemeToggleWrapper({ size = 'sm' }: PublicThemeToggleWrapperProps) {
  const searchParams = useSearchParams();

  const isEmbeddedOrModal = React.useMemo(() => {
    if (!searchParams) return false;
    const isEmbed = searchParams.get('embed') === 'true';
    const isModal = searchParams.get('modal') === 'true';
    const isInModal = searchParams.get('isInModal') === 'true';
    return isEmbed || isModal || isInModal;
  }, [searchParams]);

  if (isEmbeddedOrModal) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-background/90 hover:bg-background backdrop-blur-md border border-slate-300 dark:border-slate-700 rounded-full shadow-lg p-1 transition-all duration-300 active:scale-[0.95]">
      <ThemeToggle size={size} />
    </div>
  );
}

export default PublicThemeToggleWrapper;
