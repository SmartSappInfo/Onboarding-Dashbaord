'use client';

import { useEffect } from 'react';
import { recordPageViewAction } from '@/lib/analytics-actions';

interface PageTrackingProps {
  pageId: string;
  utmParams?: {
    source?: string | null;
    medium?: string | null;
    campaign?: string | null;
    term?: string | null;
    content?: string | null;
  };
}

/**
 * Client-side tracking component for campaign pages.
 * Tracks page views, determines uniqueness, and captures UTM parameters.
 */
export function PageTracking({ pageId, utmParams }: PageTrackingProps) {
  useEffect(() => {
    const trackView = async () => {
      try {
        // Generate or retrieve session ID
        const sessionKey = `page_session_${pageId}`;
        const existingSession = localStorage.getItem(sessionKey);
        const isUnique = !existingSession;

        if (isUnique) {
          // Mark this visitor as having seen this page
          localStorage.setItem(sessionKey, Date.now().toString());
        }

        // Store UTM parameters in sessionStorage for form submissions
        if (utmParams && Object.values(utmParams).some(v => v)) {
          const utmData = {
            source: utmParams.source || undefined,
            medium: utmParams.medium || undefined,
            campaign: utmParams.campaign || undefined,
            term: utmParams.term || undefined,
            content: utmParams.content || undefined,
            timestamp: Date.now(),
          };
          sessionStorage.setItem(`utm_${pageId}`, JSON.stringify(utmData));
        }

        // Record the page view
        await recordPageViewAction(pageId, isUnique);
      } catch (error) {
        console.error('[PageTracking] Failed to track view:', error);
      }
    };

    trackView();
  }, [pageId, utmParams]);

  return null; // No UI
}
