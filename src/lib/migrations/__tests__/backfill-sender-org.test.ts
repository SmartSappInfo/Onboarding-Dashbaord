import { describe, it, expect } from 'vitest';
import {
  resolveProfileOrg,
  pickOrgDefaultSeed,
  type WorkspaceOrgMap,
  type SeedCandidate,
} from '../backfill-sender-org';

const map: WorkspaceOrgMap = { ws1: 'orgA', ws2: 'orgA', ws3: 'orgB' };

describe('resolveProfileOrg', () => {
  it('returns the single org when all workspaces share it', () => {
    expect(resolveProfileOrg(['ws1', 'ws2'], map)).toEqual({ status: 'ok', organizationId: 'orgA' });
  });

  it('deduplicates repeated workspaces of the same org', () => {
    expect(resolveProfileOrg(['ws1', 'ws1', 'ws2'], map)).toEqual({ status: 'ok', organizationId: 'orgA' });
  });

  it('flags ambiguous when workspaces span multiple orgs', () => {
    expect(resolveProfileOrg(['ws1', 'ws3'], map)).toEqual({
      status: 'ambiguous',
      organizationIds: ['orgA', 'orgB'],
    });
  });

  it('flags orphan when no workspace resolves', () => {
    expect(resolveProfileOrg(['wsX'], map)).toEqual({ status: 'orphan', organizationIds: [] });
  });

  it('flags orphan for an empty workspace list', () => {
    expect(resolveProfileOrg([], map)).toEqual({ status: 'orphan', organizationIds: [] });
  });
});

describe('pickOrgDefaultSeed', () => {
  const active = (id: string, extra: Partial<SeedCandidate> = {}): SeedCandidate => ({
    id,
    isActive: true,
    isDefault: false,
    ...extra,
  });

  it('prefers the profile already flagged isDefault', () => {
    const chosen = pickOrgDefaultSeed([active('a'), active('b', { isDefault: true }), active('c')]);
    expect(chosen).toBe('b');
  });

  it('falls back to the sole active profile when none is flagged default', () => {
    expect(pickOrgDefaultSeed([active('only')])).toBe('only');
  });

  it('returns null when multiple active profiles exist but none is flagged (ambiguous, do not guess)', () => {
    expect(pickOrgDefaultSeed([active('a'), active('b')])).toBeNull();
  });

  it('ignores inactive profiles entirely', () => {
    expect(pickOrgDefaultSeed([active('a', { isActive: false }), active('b')])).toBe('b');
  });

  it('returns null when there are no active profiles', () => {
    expect(pickOrgDefaultSeed([active('a', { isActive: false })])).toBeNull();
  });
});
