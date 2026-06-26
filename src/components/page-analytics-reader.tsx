
'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import type { PageEventChannel } from '@/lib/types';

interface PageAnalyticsReaderProps {
  /** Called once when a ?ref= entity ID is detected in the URL. */
  onEntityDetected: (entityId: string, channel: PageEventChannel) => void;
  /** Called once on mount — always, regardless of ?ref= presence. */
  onReady: (channel: PageEventChannel) => void;
}

/**
 * Reads the ?ref= query param and detects the visitor's source channel.
 *
 * WHY this is a separate component:
 * useSearchParams() requires a Suspense boundary in Next.js static routes.
 * Isolating it here means only this tiny component suspends — not the entire page.
 * The parent wraps it in <Suspense fallback={null}> so there is zero visible flash.
 *
 * Channel detection logic:
 * - ?ref= present → 'email' (set by the /api/l/{id} redirect for tracked email links)
 *   Future: 'sms' and 'whatsapp' will be detected via an additional ?ch= param
 * - No ?ref=   → 'direct'
 */
export function PageAnalyticsReader({
  onEntityDetected,
  onReady,
}: PageAnalyticsReaderProps) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get('ref');
    const channelParam = searchParams.get('ch') as PageEventChannel | null;

    // Determine channel: explicit ?ch= > implied by ?ref= > direct
    const channel: PageEventChannel =
      channelParam ?? (ref ? 'email' : 'direct');

    if (ref) {
      onEntityDetected(ref, channel);
    }

    onReady(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount only — searchParams identity is stable on first render

  return null;
}
