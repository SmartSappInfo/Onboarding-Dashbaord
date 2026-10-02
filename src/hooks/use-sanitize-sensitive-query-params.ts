'use client';

/**
 * @fileOverview Client-side hook for instant URL query parameter scrubbing.
 * Enforces CWE-598 mitigation at the browser DOM level.
 * Governed by SmartSapp Agentic Development Rules (Rules 1, 4, 8, 10).
 */
import * as React from 'react';
import { scrubBrowserUrlInPlace } from '@/lib/auth/url-sanitizer';

/**
 * Executes synchronously or immediately on initial mount in the browser to
 * scrub sensitive credential query parameters (such as `password`) from the
 * browser address bar and history via window.history.replaceState before
 * external analytics, telemetry, or same-origin HTTP Referer headers can leak them.
 */
export function useSanitizeSensitiveQueryParams(): void {
  React.useEffect(() => {
    scrubBrowserUrlInPlace();
  }, []);
}
