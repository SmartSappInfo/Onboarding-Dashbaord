// @vitest-environment node
/**
 * @fileOverview Guards the Phase 0 baseline manifest: every listed suite must exist, and each
 * Phase 1 domain must keep at least one suite, so coverage cannot silently disappear.
 */

import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import manifest from './baseline/baseline-manifest.json';

describe('agentic baseline manifest', () => {
  it('covers the Phase 1 domains', () => {
    for (const domain of ['identity', 'crm', 'portals']) {
      expect(manifest.domains[domain as keyof typeof manifest.domains]?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('lists only files that exist', () => {
    const missing = [...manifest.platform, ...Object.values(manifest.domains).flat()].filter((p) => !existsSync(p));
    expect(missing).toEqual([]);
  });
});
