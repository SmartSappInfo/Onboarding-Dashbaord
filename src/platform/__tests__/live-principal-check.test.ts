/**
 * Live principal re-check for queued agent steps (agents_mcp PR-2).
 */
import { describe, it, expect } from 'vitest';
import { FakeFirestore } from './helpers/fake-firestore';
import { createLivePrincipalCheck } from '../tasks/live-principal-check';
import type { AgentPrincipal } from '../capabilities/contracts/capability-definition';

const target = { organizationId: 'org-1', workspaceId: 'ws-1' };
const principal: AgentPrincipal = {
  actorType: 'agent', userId: 'user-1', organizationId: 'org-1', workspaceId: 'ws-1',
  agentId: 'sdr', grantedScopes: [], effectiveRole: 'agent',
};
const grants = (granted: boolean) => async () => (granted ? { granted: true } : { granted: false, reason: 'No role grants this workspace' });

describe('live principal check', () => {
  const setup = (user: Record<string, unknown> | null, workspaceGranted = true) => {
    const db = new FakeFirestore();
    if (user) db.write('users/user-1', user);
    return createLivePrincipalCheck(db.asFirestore(), grants(workspaceGranted));
  };

  it('passes an approved member of the workspace', async () => {
    expect(await setup({ isAuthorized: true, organizationId: 'org-1' }).check(principal, target)).toEqual({ ok: true });
  });

  it('refuses a deleted, unapproved, moved or de-roled user', async () => {
    expect(await setup(null).check(principal, target)).toMatchObject({ ok: false });
    expect(await setup({ isAuthorized: false, organizationId: 'org-1' }).check(principal, target)).toMatchObject({ ok: false, reason: expect.stringMatching(/approved/) });
    expect(await setup({ isAuthorized: true, organizationId: 'org-2' }).check(principal, target)).toMatchObject({ ok: false, reason: expect.stringMatching(/organization/) });
    expect(await setup({ isAuthorized: true, organizationId: 'org-1' }, false).check(principal, target)).toMatchObject({ ok: false, reason: 'No role grants this workspace' });
  });

  it('lets a system admin through the approval and organization checks', async () => {
    expect(await setup({ permissions: ['system_admin'] }).check(principal, target)).toEqual({ ok: true });
  });
});
