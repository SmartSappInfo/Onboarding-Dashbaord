/**
 * @fileOverview Platform storage mode (Phase 11 M0 · T0, finding F1).
 *
 * Production used to fall back to in-memory stores because the selector keyed on
 * `FIREBASE_PROJECT_ID`, which the deployed services never set. These tests pin the new rule:
 * memory only under test, or by explicit opt-in outside production; production refuses memory.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  resolvePlatformStorageMode,
  selectPlatformStore,
  assertPersistentStorageInProduction,
  PlatformStorageConfigError,
} from '../../storage/storage-mode';

type Env = Record<string, string | undefined>;

describe('resolvePlatformStorageMode', () => {
  it('uses Firestore in production even when FIREBASE_PROJECT_ID is missing', () => {
    expect(resolvePlatformStorageMode({ NODE_ENV: 'production' })).toBe('firestore');
  });

  it('uses Firestore in development by default (adminDb already targets Firestore there)', () => {
    expect(resolvePlatformStorageMode({ NODE_ENV: 'development' })).toBe('firestore');
  });

  it('uses memory under test', () => {
    expect(resolvePlatformStorageMode({ NODE_ENV: 'test' })).toBe('memory');
  });

  it('allows an explicit memory opt-in outside production', () => {
    expect(resolvePlatformStorageMode({ NODE_ENV: 'development', PLATFORM_STORAGE: 'memory' })).toBe('memory');
  });

  it('refuses memory mode in production', () => {
    expect(() => resolvePlatformStorageMode({ NODE_ENV: 'production', PLATFORM_STORAGE: 'memory' })).toThrow(
      PlatformStorageConfigError
    );
  });

  it('rejects unknown PLATFORM_STORAGE values instead of guessing', () => {
    expect(() => resolvePlatformStorageMode({ NODE_ENV: 'development', PLATFORM_STORAGE: 'ram' })).toThrow(
      PlatformStorageConfigError
    );
  });
});

describe('selectPlatformStore', () => {
  const memory = () => 'memory-store';
  const firestore = () => 'firestore-store';

  it('builds only the selected store', () => {
    const env: Env = { NODE_ENV: 'production' };
    let memoryBuilt = false;
    const store = selectPlatformStore(
      () => {
        memoryBuilt = true;
        return 'memory-store';
      },
      firestore,
      env
    );
    expect(store).toBe('firestore-store');
    expect(memoryBuilt).toBe(false);
  });

  it('returns the memory store under test', () => {
    expect(selectPlatformStore(memory, firestore, { NODE_ENV: 'test' })).toBe('memory-store');
  });
});

describe('assertPersistentStorageInProduction', () => {
  it('passes in production with the default configuration', () => {
    expect(() => assertPersistentStorageInProduction({ NODE_ENV: 'production' })).not.toThrow();
  });

  it('fails startup when production is configured for memory', () => {
    expect(() =>
      assertPersistentStorageInProduction({ NODE_ENV: 'production', PLATFORM_STORAGE: 'memory' })
    ).toThrow(/PLATFORM_STORAGE/);
  });
});

describe('gate: no store keys its storage mode on FIREBASE_PROJECT_ID', () => {
  const root = join(__dirname, '..', '..');
  const storeFiles = [
    'capabilities/storage/execution-store.ts',
    'capabilities/storage/outbox-store.ts',
    'capabilities/storage/approval-store.ts',
    'capabilities/flags/flag-service.ts',
    'capabilities/storage/audit-store.ts',
    'events/storage/dead-letter-storage.ts',
    'events/storage/event-execution-ledger.ts',
    'events/storage/outbox-reader.ts',
  ];

  it.each(storeFiles)('%s selects its default through selectPlatformStore', (file) => {
    const source = readFileSync(join(root, file), 'utf8');
    expect(source).not.toMatch(/process\.env\.FIREBASE_PROJECT_ID/);
    expect(source).toMatch(/selectPlatformStore\(/);
  });
});
