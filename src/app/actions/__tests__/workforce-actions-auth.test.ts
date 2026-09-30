/**
 * workforce-actions: who may manage the workforce (hardening H1).
 *
 * `canManageWorkforce` used to include `profile.isAuthorized` (true for every approved staff
 * member) and the read-only `management.users.view`, so any staff member could approve access
 * requests, send invitations, delete departments or bulk-assign themselves roles. These tests pin
 * the fix: only real admin signals pass, refusals reach no service, members can still read the
 * department and team pickers, and the organization check has no "missing org matches all" hole.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createOrUpdateDepartmentAction,
  deleteDepartmentAction,
  listDepartmentsAction,
  purgeSampleDepartmentsAction,
  createOrUpdateTeamAction,
  deleteTeamAction,
  listTeamsAction,
  dispatchInvitationsAction,
  resendInvitationAction,
  revokeInvitationAction,
  listInvitationsAction,
  resolveAccessRequestAction,
  listAccessRequestsAction,
  executeBulkWorkforceAction,
} from '../workforce-actions';

const h = vi.hoisted(() => {
  const serviceCalls: string[] = [];
  /** A service stub that records every call and resolves to a harmless value. */
  const recordingService = (serviceName: string) =>
    new Proxy({}, {
      get: (_target, method) => async () => {
        const name = String(method);
        serviceCalls.push(`${serviceName}.${name}`);
        return name.startsWith('list') ? [] : { id: 'stub', name: 'Stub', code: 'STUB' };
      },
    });
  return {
    serviceCalls,
    recordingService,
    profiles: new Map<string, Record<string, unknown>>(), // users/{uid}
    docs: new Map<string, Record<string, unknown>>(), // any other `${collection}/${id}`
  };
});

vi.mock('@/lib/firebase-admin', () => ({
  // The test passes the caller's uid as the ID token.
  adminAuth: { verifyIdToken: vi.fn(async (token: string) => ({ uid: token, email: null })) },
  adminDb: {
    collection: (collection: string) => ({
      doc: (id: string) => ({
        get: async () => {
          const data = collection === 'users' ? h.profiles.get(id) : h.docs.get(`${collection}/${id}`);
          return { id, exists: Boolean(data), data: () => data };
        },
      }),
    }),
  },
}));
vi.mock('@/lib/services/workforce/department-service', () => ({ DepartmentService: h.recordingService('DepartmentService') }));
vi.mock('@/lib/services/workforce/department-seed-service', () => ({ DepartmentSeedService: h.recordingService('DepartmentSeedService') }));
vi.mock('@/lib/services/workforce/team-service', () => ({ TeamService: h.recordingService('TeamService') }));
vi.mock('@/lib/services/workforce/invitation-lifecycle-service', () => ({ InvitationLifecycleService: h.recordingService('InvitationLifecycleService') }));
vi.mock('@/lib/services/workforce/invitation-dispatch-service', () => ({ InvitationDispatchService: h.recordingService('InvitationDispatchService') }));
vi.mock('@/lib/services/workforce/access-request-service', () => ({ AccessRequestService: h.recordingService('AccessRequestService') }));
vi.mock('@/lib/services/workforce/bulk-workforce-service', () => ({ BulkWorkforceService: h.recordingService('BulkWorkforceService') }));
vi.mock('@/lib/services/crypto/invite-crypto-service', () => ({ InviteCryptoService: h.recordingService('InviteCryptoService') }));

const ORG = 'org_a';

/** Actions report failures as `error`, except dispatchInvitationsAction, which uses `errors`. */
const errorText = (result: { error?: string; errors?: ReadonlyArray<{ error: string }> }) =>
  result.error ?? result.errors?.[0]?.error ?? '';

/** Every manager-only action, called as `caller` against `organizationId`. */
const managerOnlyCalls = (caller: string, organizationId = ORG) => [
  () => createOrUpdateDepartmentAction({ idToken: caller, organizationId, data: { name: 'Ops' } }),
  () => deleteDepartmentAction({ idToken: caller, organizationId, departmentId: 'dept_1' }),
  () => purgeSampleDepartmentsAction({ idToken: caller, organizationId }),
  () => createOrUpdateTeamAction({ idToken: caller, organizationId, data: { name: 'Team' } }),
  () => deleteTeamAction({ idToken: caller, organizationId, teamId: 'team_1' }),
  () => dispatchInvitationsAction({ idToken: caller, organizationId, invites: [] }),
  () => resendInvitationAction({ idToken: caller, organizationId, invitationId: 'inv_1' }),
  () => revokeInvitationAction({ idToken: caller, organizationId, invitationId: 'inv_1' }),
  () => listInvitationsAction({ idToken: caller, organizationId }),
  () => resolveAccessRequestAction({ idToken: caller, organizationId, requestId: 'req_1', resolution: 'approved' }),
  () => listAccessRequestsAction({ idToken: caller, organizationId }),
  () => executeBulkWorkforceAction({ idToken: caller, organizationId, personIds: ['p1'], action: 'assign_roles', payload: { workspaceId: 'ws', roleIds: ['admin_role'] } }),
];

describe('workforce-actions authorization', () => {
  beforeEach(() => {
    h.serviceCalls.length = 0;
    h.profiles.clear();
    h.docs.clear();
    h.profiles.set('staff_a', { isAuthorized: true, organizationId: ORG, permissions: [], roles: ['member'] });
    h.profiles.set('viewer_a', { isAuthorized: true, organizationId: ORG, permissions: ['management.users.view'] });
    h.profiles.set('manager_a', { isAuthorized: true, organizationId: ORG, roles: ['administrator'] });
    h.profiles.set('no_org', { isAuthorized: true, organizationId: '', roles: ['administrator'] });
    h.profiles.set('schema_admin', {
      isAuthorized: true, organizationId: ORG,
      permissionsSchema: { management: { features: { users: { edit: true } } } },
    });
    h.profiles.set('legacy_admin', { isAuthorized: true, organizationId: ORG, permissions: ['users_manage'] });
    h.profiles.set('dotted_admin', { isAuthorized: true, organizationId: ORG, permissions: ['management.users.create'] });
    h.profiles.set('role_admin', { isAuthorized: true, organizationId: ORG, roles: ['Org_Admin'] });
  });

  it('refuses every manager-only action for approved staff without admin rights', async () => {
    for (const call of managerOnlyCalls('staff_a')) {
      const result = await call();
      expect(result.success).toBe(false);
      expect(errorText(result)).toMatch(/Forbidden/);
    }
    expect(h.serviceCalls).toEqual([]);
  });

  it('refuses read-only "management.users.view" access', async () => {
    for (const call of managerOnlyCalls('viewer_a')) {
      expect((await call()).success).toBe(false);
    }
    expect(h.serviceCalls).toEqual([]);
  });

  it('accepts each real admin signal', async () => {
    for (const admin of ['manager_a', 'schema_admin', 'legacy_admin', 'dotted_admin', 'role_admin']) {
      const result = await executeBulkWorkforceAction({
        idToken: admin, organizationId: ORG, personIds: ['p1'], action: 'suspend',
      });
      expect(result.success).toBe(true);
    }
    expect(h.serviceCalls.filter((c) => c === 'BulkWorkforceService.executeBulkAction')).toHaveLength(5);
  });

  it('refuses another organization, and a profile with no organization', async () => {
    for (const call of [...managerOnlyCalls('manager_a', 'org_b'), ...managerOnlyCalls('no_org')]) {
      const result = await call();
      expect(result.success).toBe(false);
      expect(errorText(result)).toMatch(/Access to specified organization is denied/);
    }
    expect(h.serviceCalls).toEqual([]);
  });

  it('refuses invitations granting another organization\'s workspace or role, or system_admin', async () => {
    h.docs.set('workspaces/ws_a', { organizationId: ORG });
    h.docs.set('workspaces/ws_b', { organizationId: 'org_b' });
    h.docs.set('roles/role_a', { organizationId: ORG, permissions: [] });
    h.docs.set('roles/role_b', { organizationId: 'org_b', permissions: [] });
    h.docs.set('roles/role_root', { organizationId: ORG, permissions: ['system_admin'] });
    const invite = (workspaceId: string, roleIds: string[]) => ({
      email: 'new@example.com', workspaceId, roleIds, invitedBy: 'ignored-caller-value',
    });

    const result = await dispatchInvitationsAction({
      idToken: 'manager_a',
      organizationId: ORG,
      invites: [invite('ws_b', ['role_a']), invite('ws_a', ['role_b']), invite('ws_a', ['role_root'])],
    });

    expect(result.success).toBe(false);
    expect(result.errors.map((e) => e.error)).toEqual([
      expect.stringMatching(/every workspace must belong/),
      expect.stringMatching(/every role must belong/),
      expect.stringMatching(/only a platform administrator/),
    ]);
    expect(h.serviceCalls.filter((c) => c.startsWith('InvitationLifecycleService.'))).toEqual([]);
  });

  it('still lets members read the department and team pickers', async () => {
    expect((await listDepartmentsAction({ idToken: 'staff_a', organizationId: ORG })).success).toBe(true);
    expect((await listTeamsAction({ idToken: 'staff_a', organizationId: ORG })).success).toBe(true);
  });
});
