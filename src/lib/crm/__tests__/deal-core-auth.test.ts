/**
 * Deal core + deal Server Actions: authorization (agents_mcp PR-1 / N1).
 *
 * Before this fix `createDeal`, `updateDealValueAction`, `updateDealStatusAction` and
 * `updateDealOwnerAction` had no check at all, `updateDealStageAction` checked only when the caller
 * chose to pass a `userId`, and most other deal actions trusted a caller-supplied `userId`.
 * These tests pin the fix:
 * - Server Actions take identity from the session and check the deal's STORED workspace;
 * - a new deal's organization comes from its workspace, never from the caller;
 * - service actors are pinned to one workspace;
 * - bulk and batch paths refuse foreign ids.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

type Doc = Record<string, unknown>;
interface Session { uid: string; workspaceIds: string[] }

const h = vi.hoisted(() => ({
  session: null as Session | null,
  /** uid -> workspaceId -> pipeline actions the user holds there. */
  grants: new Map<string, Map<string, string[]>>(),
  store: new Map<string, Map<string, Record<string, unknown>>>(),
  nextId: 0,
}));

// ── Session + permissions ──────────────────────────────────────────────────────────────────
vi.mock('@/lib/auth/require-auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth/require-auth')>('@/lib/auth/require-auth');
  const ctx = () => {
    if (!h.session) throw new actual.UnauthorizedError('Not signed in.');
    return { uid: h.session.uid, profile: { name: 'Session User' }, isSystemAdmin: false };
  };
  return {
    ...actual,
    requireAuth: vi.fn(async () => ctx()),
    requireWorkspace: vi.fn(async (workspaceId: string) => {
      const c = ctx();
      if (!h.session?.workspaceIds.includes(workspaceId)) throw new actual.ForbiddenError('No access to this workspace.');
      return c;
    }),
  };
});
vi.mock('@/lib/workspace-permissions', () => ({
  canUser: vi.fn(async (uid: string, section: string, feature: string, action: string, workspaceId?: string) => {
    const held = workspaceId ? h.grants.get(uid)?.get(workspaceId) ?? [] : [];
    const granted = section === 'operations' && feature === 'pipeline' && held.includes(action);
    return granted ? { granted: true } : { granted: false, reason: 'Permission denied' };
  }),
}));

// ── Side effects we don't assert on ────────────────────────────────────────────────────────
vi.mock('@/lib/activity-logger', () => ({ logActivity: vi.fn(async () => undefined) }));
vi.mock('@/lib/deals/deal-event-bus', () => ({ emitDealDomainEvent: vi.fn() }));
vi.mock('@/lib/automations/orchestrator', () => ({ triggerAutomationProtocols: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

// ── Minimal in-memory Firestore ────────────────────────────────────────────────────────────
vi.mock('@/lib/firebase-admin', () => {
  const col = (name: string) => {
    if (!h.store.has(name)) h.store.set(name, new Map());
    return h.store.get(name)!;
  };
  const snap = (name: string, id: string) => {
    const data = col(name).get(id);
    return { id, exists: Boolean(data), data: () => data, get: (field: string) => data?.[field] };
  };
  const docRef = (name: string, id: string) => ({
    id,
    __col: name,
    get: async () => snap(name, id),
    set: async (data: Doc) => { col(name).set(id, { ...data }); },
    update: async (patch: Doc) => {
      const cur = col(name).get(id);
      if (!cur) throw new Error(`No document to update: ${name}/${id}`);
      col(name).set(id, { ...cur, ...patch });
    },
    delete: async () => { col(name).delete(id); },
  });
  const query = (name: string, filters: Array<[string, unknown]>) => ({
    where: (field: string, _op: string, value: unknown) => query(name, [...filters, [field, value]]),
    orderBy: () => query(name, filters),
    limit: () => query(name, filters),
    get: async () => {
      const docs = [...col(name).entries()]
        .filter(([, d]) => filters.every(([f, v]) => d[f] === v))
        .map(([id]) => ({ ...snap(name, id), ref: docRef(name, id) }));
      return { empty: docs.length === 0, size: docs.length, docs, forEach: (cb: (d: unknown) => void) => docs.forEach(cb) };
    },
  });
  type Ref = ReturnType<typeof docRef>;
  return {
    adminDb: {
      collection: (name: string) => ({
        ...query(name, []),
        doc: (id?: string) => docRef(name, id ?? `auto_${++h.nextId}`),
        add: async (data: Doc) => { const id = `auto_${++h.nextId}`; col(name).set(id, { ...data }); return { id }; },
      }),
      getAll: async (...refs: Ref[]) => refs.map((r) => ({ ...snap(r.__col, r.id), ref: r })),
      batch: () => {
        const ops: Array<() => Promise<void>> = [];
        return {
          update: (r: Ref, patch: Doc) => { ops.push(() => r.update(patch)); },
          delete: (r: Ref) => { ops.push(() => r.delete()); },
          set: (r: Ref, data: Doc) => { ops.push(() => r.set(data)); },
          commit: async () => { for (const op of ops) await op(); },
        };
      },
    },
  };
});

import {
  createDeal,
  updateDealStageAction,
  updateDealValueAction,
  updateDealStatusAction,
  updateDealOwnerAction,
  updateDealAction,
  deleteDealAction,
  bulkDeleteDealsAction,
  bulkAssignDealsAction,
  archiveDealAction,
  duplicateDealAction,
  updateDealDetailsAction,
  logDealInteractionAction,
  updateStageOrdersAction,
} from '@/app/actions/deal-actions';
import { createDealBulkJobAction } from '@/app/actions/deal-bulk-job-actions';
import { bulkCreateDealsAction } from '@/app/actions/bulk-deal-actions';
import { createDealCore, updateDealStageCore, updateDealValueCore } from '../deal-core';
import type { BulkDealCreationData } from '../bulk-deal-core';

const seed = (name: string, id: string, data: Doc) => {
  if (!h.store.has(name)) h.store.set(name, new Map());
  h.store.get(name)!.set(id, data);
};
const read = (name: string, id: string) => h.store.get(name)?.get(id);
const grant = (uid: string, workspaceId: string, actions: string[]) => {
  if (!h.grants.has(uid)) h.grants.set(uid, new Map());
  h.grants.get(uid)!.set(workspaceId, actions);
};

const EDITOR: Session = { uid: 'editor_a', workspaceIds: ['ws_a'] };
const VIEWER: Session = { uid: 'viewer_a', workspaceIds: ['ws_a'] };

describe('deal authorization (N1)', () => {
  beforeEach(() => {
    h.session = null;
    h.grants.clear();
    h.store.clear();
    h.nextId = 0;
    grant('editor_a', 'ws_a', ['view', 'create', 'edit']);
    grant('viewer_a', 'ws_a', ['view']);
    seed('workspaces', 'ws_a', { organizationId: 'org_a' });
    seed('workspaces', 'ws_b', { organizationId: 'org_b' });
    seed('workspace_entities', 'ws_a_ent_1', { workspaceId: 'ws_a', entityId: 'ent_1', displayName: 'Acme' });
    seed('pipelines', 'pipe_a', { workspaceIds: ['ws_a'] });
    seed('pipelines', 'pipe_b', { workspaceIds: ['ws_b'] });
    seed('onboardingStages', 'stage_a1', { pipelineId: 'pipe_a', name: 'New', order: 0 });
    seed('onboardingStages', 'stage_a2', { pipelineId: 'pipe_a', name: 'Won', order: 1 });
    seed('onboardingStages', 'stage_b1', { pipelineId: 'pipe_b', name: 'Other', order: 0 });
    seed('deals', 'deal_a', { workspaceId: 'ws_a', organizationId: 'org_a', pipelineId: 'pipe_a', stageId: 'stage_a1', name: 'A', value: 10, status: 'open' });
    seed('deals', 'deal_b', { workspaceId: 'ws_b', organizationId: 'org_b', pipelineId: 'pipe_b', stageId: 'stage_b1', name: 'B', value: 20, status: 'open' });
    seed('deals', 'deal_legacy', { organizationId: 'org_b', pipelineId: 'pipe_b', stageId: 'stage_b1', name: 'No workspace', value: 5 });
  });

  describe('Server Actions', () => {
    it('refuse anonymous callers before touching any deal', async () => {
      await expect(updateDealValueAction('deal_a', 99)).rejects.toThrow();
      await expect(updateDealStageAction('deal_a', 'stage_a2')).rejects.toThrow();
      await expect(createDeal({ entityId: 'ent_1', workspaceId: 'ws_a', pipelineId: 'pipe_a', name: 'X' })).rejects.toThrow();
      expect(read('deals', 'deal_a')?.value).toBe(10);
    });

    it('refuse deals stored in a workspace the user cannot edit', async () => {
      h.session = EDITOR;
      expect(await updateDealValueAction('deal_b', 1)).toMatchObject({ success: false });
      expect(await updateDealStatusAction('deal_b', 'won')).toMatchObject({ success: false });
      expect(await updateDealOwnerAction('deal_b', 'x', 'X', null)).toMatchObject({ success: false });
      expect(await updateDealStageAction('deal_b', 'stage_b1')).toMatchObject({ success: false });
      expect(await archiveDealAction('deal_b')).toMatchObject({ success: false });
      // Naming your own workspace in the request does not help: the STORED workspace decides.
      expect(await deleteDealAction('deal_b', 'ws_a')).toMatchObject({ success: false });
      expect(await updateDealAction('deal_b', { name: 'pwned' }, 'ws_a')).toMatchObject({ success: false });
      expect(read('deals', 'deal_b')).toMatchObject({ value: 20, status: 'open', name: 'B' });
    });

    it('refuse deals with no stored workspace', async () => {
      h.session = EDITOR;
      expect(await updateDealValueAction('deal_legacy', 1)).toMatchObject({ success: false, error: 'Deal not found.' });
      expect(read('deals', 'deal_legacy')?.value).toBe(5);
    });

    it('always check the stage-change permission (it used to be skipped without a userId)', async () => {
      h.session = VIEWER;
      expect(await updateDealStageAction('deal_a', 'stage_a2')).toMatchObject({ success: false, error: 'Permission denied' });
      expect(read('deals', 'deal_a')?.stageId).toBe('stage_a1');

      h.session = EDITOR;
      expect(await updateDealStageAction('deal_a', 'stage_a2')).toMatchObject({ success: true });
      expect(read('deals', 'deal_a')?.stageId).toBe('stage_a2');
    });

    it('let a permitted user edit their own workspace\'s deal', async () => {
      h.session = EDITOR;
      expect(await updateDealValueAction('deal_a', 42)).toMatchObject({ success: true });
      expect(read('deals', 'deal_a')?.value).toBe(42);
    });

    it('create deals only with pipeline:create, in the workspace\'s own organization', async () => {
      h.session = VIEWER;
      expect(await createDeal({ entityId: 'ent_1', workspaceId: 'ws_a', pipelineId: 'pipe_a', name: 'X' })).toMatchObject({ error: 'Permission denied' });

      h.session = EDITOR;
      const res = await createDeal({ entityId: 'ent_1', workspaceId: 'ws_a', organizationId: 'org_b', pipelineId: 'pipe_a', name: 'X' });
      expect(res.id).toBeDefined();
      expect(read('deals', res.id!)).toMatchObject({ workspaceId: 'ws_a', organizationId: 'org_a' });
    });

    it('never let an update move a deal to another tenant', async () => {
      h.session = EDITOR;
      const res = await updateDealAction('deal_a', { name: 'Renamed', workspaceId: 'ws_b', organizationId: 'org_b' }, 'ws_a');
      expect(res.success).toBe(true);
      expect(read('deals', 'deal_a')).toMatchObject({ name: 'Renamed', workspaceId: 'ws_a', organizationId: 'org_a' });
    });

    it('bulk actions skip foreign and workspace-less ids', async () => {
      h.session = EDITOR;
      const res = await bulkDeleteDealsAction(['deal_a', 'deal_b', 'deal_legacy'], 'ws_a');
      expect(res).toMatchObject({ success: true, deletedCount: 1 });
      expect(read('deals', 'deal_a')).toBeUndefined();
      expect(read('deals', 'deal_b')).toBeDefined();
      expect(read('deals', 'deal_legacy')).toBeDefined();

      const assign = await bulkAssignDealsAction(['deal_b'], { userId: 'x', name: 'X', email: null }, 'ws_a');
      expect(assign).toMatchObject({ success: true, updatedCount: 0 });
      expect(read('deals', 'deal_b')?.assignedTo).toBeUndefined();
    });

    it('log interactions only on deals of the named workspace', async () => {
      h.session = EDITOR;
      const res = await logDealInteractionAction('deal_b', { type: 'note', subject: 'x' }, 'ws_a');
      expect(res.success).toBe(false);
    });

    it('reorder only stages of a pipeline shared to the workspace', async () => {
      h.session = EDITOR;
      expect(await updateStageOrdersAction('pipe_b', ['stage_b1'], 'ws_a')).toMatchObject({ success: false });
      expect(await updateStageOrdersAction('pipe_a', ['stage_a2', 'stage_b1'], 'ws_a')).toMatchObject({ success: false });
      expect(read('onboardingStages', 'stage_b1')?.order).toBe(0);

      expect(await updateStageOrdersAction('pipe_a', ['stage_a2', 'stage_a1'], 'ws_a')).toMatchObject({ success: true });
      expect(read('onboardingStages', 'stage_a2')?.order).toBe(0);
    });
  });

  describe('pipeline and stage placement (FU-15)', () => {
    beforeEach(() => { h.session = EDITOR; });
    const before = () => ({ ...read('deals', 'deal_a') });

    it('refuses creating a deal in a pipeline or stage not shared to the workspace', async () => {
      expect(await createDeal({ entityId: 'ent_1', workspaceId: 'ws_a', pipelineId: 'pipe_b', name: 'X' })).toMatchObject({ error: 'Pipeline not found.' });
      expect(await createDeal({ entityId: 'ent_1', workspaceId: 'ws_a', pipelineId: 'pipe_a', stageId: 'stage_b1', name: 'X' })).toMatchObject({ error: 'Stage not found.' });
      expect(await createDeal({ entityId: 'ent_1', workspaceId: 'ws_a', pipelineId: 'pipe_a', stageId: 'stage_a2', name: 'X' })).toHaveProperty('id');
    });

    it('refuses moving a deal to another tenant\'s stage', async () => {
      const prior = before();
      expect(await updateDealStageAction('deal_a', 'stage_b1')).toMatchObject({ success: false, error: 'Stage not found.' });
      expect(read('deals', 'deal_a')).toEqual(prior);
    });

    it('refuses edits and copies that point at another tenant\'s pipeline or stage', async () => {
      const prior = before();
      expect(await updateDealAction('deal_a', { pipelineId: 'pipe_b' }, 'ws_a')).toMatchObject({ success: false, error: 'Pipeline not found.' });
      expect(await updateDealDetailsAction('deal_a', { stageId: 'stage_b1' })).toMatchObject({ success: false, error: 'Stage not found.' });
      expect(await duplicateDealAction('deal_a', { targetPipelineId: 'pipe_b' })).toMatchObject({ success: false, error: 'Pipeline not found.' });
      expect(read('deals', 'deal_a')).toEqual(prior);
      expect(h.store.get('deals')?.size).toBe(3);
    });

    it('still allows edits that leave placement alone', async () => {
      expect(await updateDealAction('deal_a', { name: 'Fine' }, 'ws_a')).toMatchObject({ success: true });
      expect(await updateDealDetailsAction('deal_a', { stageId: 'stage_a2' })).toMatchObject({ success: true });
    });

    it('refuses bulk creation into a foreign pipeline', async () => {
      const res = await bulkCreateDealsAction({ entityIds: ['ent_1'], workspaceId: 'ws_a', pipelineId: 'pipe_b', dealNamePattern: 'X', value: 0, assignmentStrategy: 'unassigned' });
      expect(res).toMatchObject({ success: false, error: 'Pipeline not found.' });
    });
  });

  describe('bulk create', () => {
    const request: BulkDealCreationData = { entityIds: ['ent_1'], workspaceId: 'ws_a', organizationId: 'org_b', pipelineId: 'pipe_a', dealNamePattern: '{{entityName}}', value: 0, assignmentStrategy: 'unassigned' };
    const dealCount = () => h.store.get('deals')?.size ?? 0;

    it('needs a session and pipeline:create in the workspace', async () => {
      await expect(bulkCreateDealsAction(request)).rejects.toThrow();
      h.session = VIEWER;
      expect(await bulkCreateDealsAction(request)).toMatchObject({ success: false, error: 'Permission denied' });
      expect(dealCount()).toBe(3);
    });

    it('creates in the workspace\'s own organization', async () => {
      h.session = EDITOR;
      expect(await bulkCreateDealsAction(request)).toMatchObject({ success: true, count: 1 });
      const created = [...h.store.get('deals')!.values()].find((d) => d.entityId === 'ent_1');
      expect(created).toMatchObject({ workspaceId: 'ws_a', organizationId: 'org_a' });
    });
  });

  describe('bulk jobs', () => {
    it('never touch deals outside the job\'s workspace', async () => {
      h.session = EDITOR;
      const res = await createDealBulkJobAction('bulk_archive', ['deal_a', 'deal_b'], {}, 'ws_a');
      expect(res.success).toBe(true);
      await vi.waitFor(() => expect(read('deal_bulk_jobs', res.jobId!)?.status).toBe('completed'));

      expect(read('deals', 'deal_a')?.isArchived).toBe(true);
      expect(read('deals', 'deal_b')?.isArchived).toBeUndefined();
      expect(read('deal_bulk_jobs', res.jobId!)).toMatchObject({ userId: 'editor_a', failedRecords: 1 });
    });
  });

  describe('core with a service actor', () => {
    const service = { kind: 'service', service: 'automations', workspaceId: 'ws_a' } as const;

    it('works inside its workspace without a signed-in user', async () => {
      expect(await updateDealValueCore(service, 'deal_a', 7)).toMatchObject({ success: true });
      expect(read('deals', 'deal_a')?.value).toBe(7);
      const created = await createDealCore(service, { entityId: 'ent_1', workspaceId: 'ws_a', pipelineId: 'pipe_a', name: 'Auto' });
      expect(read('deals', created.id!)).toMatchObject({ organizationId: 'org_a' });
    });

    it('is refused outside its workspace', async () => {
      expect(await updateDealStageCore(service, 'deal_b', 'stage_b1')).toMatchObject({ success: false, error: 'Deal not found.' });
      expect(await createDealCore(service, { entityId: 'ent_1', workspaceId: 'ws_b', pipelineId: 'pipe_b', name: 'X' })).toMatchObject({ error: 'Deal not found.' });
      expect(read('deals', 'deal_b')?.stageId).toBe('stage_b1');
    });
  });
});
