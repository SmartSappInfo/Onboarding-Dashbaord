import { describe, it, expect } from 'vitest';
import { pickSenderProfileId, type SenderCandidate } from '../sender-resolution';

const owned = (id: string): SenderCandidate => ({ id, organizationId: 'orgA', isActive: true });

describe('pickSenderProfileId', () => {
  it('prefers a valid explicit profile owned by the org', () => {
    const r = pickSenderProfileId({
      orgId: 'orgA',
      explicit: owned('exp'),
      workspaceDefault: owned('ws'),
      orgDefault: owned('org'),
    });
    expect(r).toEqual({ outcome: 'resolved', senderProfileId: 'exp', source: 'explicit' });
  });

  it('REJECTS an explicit profile owned by a different org (no fallthrough)', () => {
    const r = pickSenderProfileId({
      orgId: 'orgA',
      explicit: { id: 'evil', organizationId: 'orgB', isActive: true },
      workspaceDefault: owned('ws'),
      orgDefault: owned('org'),
    });
    expect(r).toEqual({ outcome: 'cross_org_explicit', senderProfileId: null, source: 'explicit' });
  });

  it('falls back to the workspace default when there is no explicit profile', () => {
    const r = pickSenderProfileId({
      orgId: 'orgA',
      explicit: null,
      workspaceDefault: owned('ws'),
      orgDefault: owned('org'),
    });
    expect(r).toEqual({ outcome: 'resolved', senderProfileId: 'ws', source: 'workspace_default' });
  });

  it('falls back to the org default when there is no explicit or workspace default', () => {
    const r = pickSenderProfileId({
      orgId: 'orgA',
      explicit: null,
      workspaceDefault: null,
      orgDefault: owned('org'),
    });
    expect(r).toEqual({ outcome: 'resolved', senderProfileId: 'org', source: 'org_default' });
  });

  it('skips an inactive candidate and continues down the hierarchy', () => {
    const r = pickSenderProfileId({
      orgId: 'orgA',
      explicit: null,
      workspaceDefault: { id: 'ws', organizationId: 'orgA', isActive: false },
      orgDefault: owned('org'),
    });
    expect(r).toEqual({ outcome: 'resolved', senderProfileId: 'org', source: 'org_default' });
  });

  it('skips a workspace default owned by another org (data drift) and uses the org default', () => {
    const r = pickSenderProfileId({
      orgId: 'orgA',
      explicit: null,
      workspaceDefault: { id: 'ws', organizationId: 'orgB', isActive: true },
      orgDefault: owned('org'),
    });
    expect(r).toEqual({ outcome: 'resolved', senderProfileId: 'org', source: 'org_default' });
  });

  it('returns no_sender (NEVER a global pick) when nothing valid exists', () => {
    const r = pickSenderProfileId({
      orgId: 'orgA',
      explicit: null,
      workspaceDefault: null,
      orgDefault: null,
    });
    expect(r).toEqual({ outcome: 'no_sender', senderProfileId: null, source: 'none' });
  });

  it('returns no_sender when the only org default is inactive', () => {
    const r = pickSenderProfileId({
      orgId: 'orgA',
      explicit: null,
      workspaceDefault: null,
      orgDefault: { id: 'org', organizationId: 'orgA', isActive: false },
    });
    expect(r).toEqual({ outcome: 'no_sender', senderProfileId: null, source: 'none' });
  });
});
