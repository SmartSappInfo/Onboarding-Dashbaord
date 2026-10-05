/**
 * @fileOverview Single switch for platform store persistence (Phase 11 M0 · T0, finding F1).
 *
 * WHY THIS EXISTS
 * Eight platform stores (idempotency, outbox, approvals, flags/kill switches, audit, DLQ, event
 * ledger, outbox reader) used to pick an in-memory implementation whenever `FIREBASE_PROJECT_ID`
 * was unset. The deployed services never set it, so in production those records lived in RAM:
 * audit history, idempotency and operator flag changes were lost on every restart and differed
 * between Cloud Run instances.
 *
 * THE RULE NOW
 * - `NODE_ENV === 'test'` → memory (hermetic tests).
 * - `PLATFORM_STORAGE=memory` → memory, allowed only outside production (local opt-out).
 * - Everything else → Firestore. Production + memory is a configuration error and stops startup.
 *
 * CAUTION: never reintroduce an implicit fallback to memory (for example on a missing env var or
 * a Firestore error). A store that cannot persist must fail closed so callers report
 * `stateChanged: 'no'` instead of silently losing records. Rules 5, 40, 60.
 *
 * Tests: src/platform/__tests__/storage/storage-mode.test.ts
 */

export type PlatformStorageMode = 'firestore' | 'memory';

type StorageEnv = Readonly<Record<string, string | undefined>>;

export class PlatformStorageConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlatformStorageConfigError';
  }
}

/**
 * Decides where platform stores keep their records. Pure: pass `env` in tests.
 */
export function resolvePlatformStorageMode(env: StorageEnv = process.env): PlatformStorageMode {
  const requested = env.PLATFORM_STORAGE?.trim().toLowerCase();

  if (requested !== undefined && requested !== '' && requested !== 'memory' && requested !== 'firestore') {
    throw new PlatformStorageConfigError(
      `PLATFORM_STORAGE must be 'memory' or 'firestore' (got '${env.PLATFORM_STORAGE}').`
    );
  }

  if (env.NODE_ENV === 'production') {
    if (requested === 'memory') {
      throw new PlatformStorageConfigError(
        'PLATFORM_STORAGE=memory is not allowed in production: platform records would be lost on restart.'
      );
    }
    return 'firestore';
  }

  if (requested === 'memory') return 'memory';
  if (requested === 'firestore') return 'firestore';
  return env.NODE_ENV === 'test' ? 'memory' : 'firestore';
}

/**
 * Builds the store for the current mode. Only the selected factory runs, so importing a store
 * module in tests never touches Firestore and production never constructs a RAM store.
 */
export function selectPlatformStore<T>(
  createMemoryStore: () => T,
  createFirestoreStore: () => T,
  env: StorageEnv = process.env
): T {
  return resolvePlatformStorageMode(env) === 'memory' ? createMemoryStore() : createFirestoreStore();
}

/**
 * Startup guard, called from `src/instrumentation.ts`. Throws so a misconfigured production
 * deploy fails its health check instead of running with RAM-only audit and flags.
 */
export function assertPersistentStorageInProduction(env: StorageEnv = process.env): void {
  resolvePlatformStorageMode(env);
}
