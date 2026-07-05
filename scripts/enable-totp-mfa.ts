#!/usr/bin/env tsx
/**
 * Enables TOTP multi-factor authentication for the Firebase project.
 *
 * Prerequisite: the project must be upgraded to
 * "Firebase Authentication with Identity Platform" (Console → Authentication
 * → Settings → Upgrade) — updateProjectConfig fails with a 400 otherwise.
 *
 * Usage:
 *   pnpm tsx scripts/enable-totp-mfa.ts          # enable
 *   STATE=DISABLED pnpm tsx scripts/enable-totp-mfa.ts   # roll back
 *
 * Uses the same credentials as the app (.env.local:
 * FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_SERVICE_ACCOUNT_PATH).
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main(): Promise<void> {
  const { adminAuth } = await import('../src/lib/firebase-admin');

  const state = process.env.STATE === 'DISABLED' ? 'DISABLED' : 'ENABLED';

  const config = await adminAuth.projectConfigManager().updateProjectConfig({
    multiFactorConfig: {
      // Top-level state governs MFA overall; TOTP itself is controlled by
      // the provider config below.
      state,
      providerConfigs: [
        {
          state,
          totpProviderConfig: {
            // Accept codes from ±5 adjacent 30s windows (Firebase default)
            // to tolerate device clock drift.
            adjacentIntervals: 5,
          },
        },
      ],
    },
  });

  console.log(`TOTP MFA is now ${state}.`);
  console.log('Current multiFactorConfig:', JSON.stringify(config.multiFactorConfig, null, 2));
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error('Failed to update project MFA config:', message);
  if (message.includes('INVALID_ARGUMENT') || message.includes('not supported')) {
    console.error(
      '\nHint: this usually means the project has NOT been upgraded to ' +
      'Firebase Authentication with Identity Platform yet. Upgrade in the ' +
      'Firebase Console (Authentication → Settings → Upgrade), then re-run.'
    );
  }
  process.exit(1);
});
