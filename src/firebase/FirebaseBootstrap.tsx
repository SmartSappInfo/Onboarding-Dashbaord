'use client';

/**
 * FirebaseBootstrap — Dev-only infrastructure seeder component.
 *
 * Architectural & Security Notes:
 * - Module-level `didInit` guard (per Vercel `advanced-init-once` guidelines) prevents duplicate executions.
 * - Executes server-side infrastructure seeding via `seedInfrastructureAction()` (powered by `adminDb`).
 *   This avoids client-side Firestore SDK write attempts on `system_config`, `organizations`, and `workspaces`,
 *   which trigger client permission errors due to strict Firestore Security Rules.
 * - Dev-only: Returns immediately in production builds with zero runtime overhead.
 * - Rendered inside root layout contexts.
 */

import { useEffect } from 'react';
import { seedInfrastructureAction } from '@/app/actions/seed-actions';

// Module-level guard — survives component remounts and React Strict Mode double-invocations
let didInit = false;

export default function FirebaseBootstrap(): null {
  useEffect(() => {
    // advanced-init-once: never run twice per app lifecycle
    if (didInit) return;

    // Production guard: zero overhead in production builds
    if (process.env.NODE_ENV !== 'development') return;

    // SSR guard
    if (typeof window === 'undefined') return;

    didInit = true;

    // Invoke server action to seed infrastructure cleanly via adminDb
    seedInfrastructureAction()
      .then((res) => {
        if (res.success && res.seeded.length > 0) {
          console.log('>>> [BOOTSTRAP] Dev infrastructure seeded via admin server action:', res.seeded);
        }
      })
      .catch((err: unknown) => {
        // Non-fatal: seed failures in dev environment should not crash the app UI
        const msg = err instanceof Error ? err.message : String(err);
        console.warn('>>> [BOOTSTRAP] Dev seed server action failed (non-fatal):', msg);
      });
  }, []);

  // Renders no visible UI DOM elements
  return null;
}
