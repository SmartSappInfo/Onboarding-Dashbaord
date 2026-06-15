'use client';

import { usePathname } from 'next/navigation';
import { resolveRouteTitle, type RouteTitleMap } from '@/lib/route-titles';
import { usePageTitle } from '@/hooks/use-page-title';

const BRAND = 'SmartSapp';

interface PageTitleManagerProps {
  /** Route → feature-label map for this control plane. */
  map: RouteTitleMap;
  /**
   * Organization in focus. When provided (Admin), the title is
   * `{org} · {feature} — SmartSapp`; when absent (Backoffice) it is
   * `{feature} — SmartSapp`. Omitted until the org resolves to avoid a flash.
   */
  orgName?: string;
  /** Label used when no route prefix matches. */
  fallback?: string;
}

/**
 * Renders nothing; keeps the browser tab title in sync with the active route
 * (and, for Admin, the organization in focus). Drop one instance into each
 * control-plane layout shell.
 */
export function PageTitleManager({ map, orgName, fallback = '' }: PageTitleManagerProps) {
  const pathname = usePathname() || '';
  const feature = resolveRouteTitle(pathname, map, fallback);

  const segments = [orgName?.trim(), feature].filter(Boolean);
  const lead = segments.join(' · ');
  const title = lead ? `${lead} — ${BRAND}` : BRAND;

  usePageTitle(title);
  return null;
}
