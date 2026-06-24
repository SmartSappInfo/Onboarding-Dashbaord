import { describe, it, expect, vi } from 'vitest';
import { resolveSenderProfileId, resolveOrgId, type CandidateLoader } from '../sender-repository';
import type { SenderCandidate } from '../sender-resolution';

const db: Record<string, SenderCandidate> = {
  expA: { id: 'expA', organizationId: 'orgA', isActive: true },
  wsA: { id: 'wsA', organizationId: 'orgA', isActive: true },
  orgA_def: { id: 'orgA_def', organizationId: 'orgA', isActive: true },
  evilB: { id: 'evilB', organizationId: 'orgB', isActive: true },
};

const loader: CandidateLoader = async (id) => db[id] ?? null;

describe('resolveSenderProfileId', () => {
  it('resolves an explicit org-owned sender', async () => {
    const res = await resolveSenderProfileId({
      orgId: 'orgA', channel: 'sms', explicitId: 'expA',
      workspaceDefaultId: 'wsA', orgDefaultId: 'orgA_def', loadCandidate: loader,
    });
    expect(res).toMatchObject({ outcome: 'resolved', senderProfileId: 'expA', source: 'explicit' });
  });

  it('rejects an explicit sender from another org without falling through', async () => {
    const res = await resolveSenderProfileId({
      orgId: 'orgA', channel: 'sms', explicitId: 'evilB',
      workspaceDefaultId: 'wsA', orgDefaultId: 'orgA_def', loadCandidate: loader,
    });
    expect(res.outcome).toBe('cross_org_explicit');
    expect(res.senderProfileId).toBeNull();
  });

  it('treats the "default" / "none" sentinels and empty string as no explicit id', async () => {
    for (const sentinel of ['default', 'none', '']) {
      const res = await resolveSenderProfileId({
        orgId: 'orgA', channel: 'sms', explicitId: sentinel,
        workspaceDefaultId: null, orgDefaultId: 'orgA_def', loadCandidate: loader,
      });
      expect(res).toMatchObject({ outcome: 'resolved', senderProfileId: 'orgA_def', source: 'org_default' });
    }
  });

  it('falls back to the workspace default then org default', async () => {
    const res = await resolveSenderProfileId({
      orgId: 'orgA', channel: 'sms', explicitId: null,
      workspaceDefaultId: 'wsA', orgDefaultId: 'orgA_def', loadCandidate: loader,
    });
    expect(res).toMatchObject({ outcome: 'resolved', senderProfileId: 'wsA', source: 'workspace_default' });
  });

  it('returns no_sender when nothing resolves', async () => {
    const res = await resolveSenderProfileId({
      orgId: 'orgA', channel: 'sms', explicitId: null,
      workspaceDefaultId: null, orgDefaultId: null, loadCandidate: loader,
    });
    expect(res.outcome).toBe('no_sender');
  });

  it('loads each distinct id at most once', async () => {
    const spy = vi.fn(loader);
    await resolveSenderProfileId({
      orgId: 'orgA', channel: 'sms', explicitId: 'expA',
      workspaceDefaultId: 'expA', orgDefaultId: 'expA', loadCandidate: spy,
    });
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('resolveOrgId', () => {
  it('prefers the explicit org id', () => {
    expect(resolveOrgId('exp', 'tmpl', 'ws')).toBe('exp');
  });
  it('falls back to the template org, then the workspace org', () => {
    expect(resolveOrgId(undefined, 'tmpl', 'ws')).toBe('tmpl');
    expect(resolveOrgId('', '', 'ws')).toBe('ws');
  });
  it('returns null when no source yields an org id', () => {
    expect(resolveOrgId(undefined, undefined, undefined)).toBeNull();
    expect(resolveOrgId('', '', '')).toBeNull();
  });
});
