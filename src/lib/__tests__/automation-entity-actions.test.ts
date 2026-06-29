import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleUpdateEntity,
  handleAssignEntity,
  handleAddNote,
  handleCreateEntity,
} from '../automations/actions/entity-actions';
import type { ExecutionContext } from '../automations/execution-types';

/**
 * Behavior coverage for the entity-mutation automation steps:
 * UPDATE_ENTITY, ASSIGN_ENTITY, ADD_NOTE, CREATE_ENTITY.
 */

const mockResolveContact = vi.fn();
const mockLogActivity = vi.fn().mockResolvedValue(undefined);
const mockCreateEntityAction = vi.fn().mockResolvedValue({ success: true, id: 'entity-new-1' });

const entitiesUpdate = vi.fn().mockResolvedValue(undefined);
const weUpdate = vi.fn().mockResolvedValue(undefined);
const notesAdd = vi.fn().mockResolvedValue({ id: 'note-1' });
const runsUpdate = vi.fn().mockResolvedValue(undefined);

vi.mock('../contact-adapter', () => ({
  resolveContact: (id: string, wsId: string) => mockResolveContact(id, wsId),
}));

vi.mock('../activity-logger', () => ({
  logActivity: (args: Record<string, unknown>) => mockLogActivity(args),
}));

vi.mock('../entity-actions', () => ({
  createEntityAction: (...args: unknown[]) => mockCreateEntityAction(...args),
  updateEntityAction: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn((name: string) => {
      if (name === 'entities') return { doc: () => ({ update: entitiesUpdate }) };
      if (name === 'workspace_entities') return { doc: () => ({ update: weUpdate }) };
      if (name === 'entity_notes') return { add: notesAdd };
      if (name === 'automation_runs') return { doc: () => ({ update: runsUpdate }) };
      if (name === 'app_fields') return { where: () => ({ get: async () => ({ docs: [] }) }) };
      if (name === 'workspaces') return { doc: () => ({ get: async () => ({ exists: true, data: () => ({ organizationId: 'org-1' }) }) }) };
      if (name === 'organizations') return { doc: () => ({ get: async () => ({ exists: true, data: () => ({ defaultCountryCode: 'GH' }) }) }) };
      return { doc: () => ({ update: vi.fn(), get: async () => ({ exists: false }) }), add: vi.fn(), where: () => ({ get: async () => ({ docs: [] }) }) };
    }),
  },
}));

const ctx = (overrides: Partial<ExecutionContext> = {}): ExecutionContext => ({
  automationId: 'auto-1',
  runId: 'run-1',
  workspaceId: 'ws-1',
  entityId: 'ent-1',
  entityType: 'institution',
  organizationId: 'org-1',
  payload: {},
  ...overrides,
});

describe('handleUpdateEntity (UPDATE_ENTITY)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveContact.mockResolvedValue({ entityId: 'ent-1', workspaceEntityId: 'we-1' });
  });

  it('throws when context has no entityId', async () => {
    await expect(handleUpdateEntity({ updates: { name: 'X' } }, ctx({ entityId: undefined })))
      .rejects.toThrow(/missing entityId/i);
  });

  it('writes identity fields (name) to the entities doc', async () => {
    await handleUpdateEntity({ updates: { name: 'New Name' } }, ctx());
    expect(entitiesUpdate).toHaveBeenCalledWith(expect.objectContaining({ name: 'New Name' }));
  });

  it('routes operational fields (pipelineId/stageId) to the workspace_entities doc', async () => {
    await handleUpdateEntity({ updates: { pipelineId: 'pipe-2', stageId: 'stage-3' } }, ctx());
    expect(weUpdate).toHaveBeenCalledWith(expect.objectContaining({ pipelineId: 'pipe-2', stageId: 'stage-3' }));
  });

  it('routes unknown keys into customData.* on the entity', async () => {
    await handleUpdateEntity({ updates: { favouriteColour: 'blue' } }, ctx());
    expect(entitiesUpdate).toHaveBeenCalledWith(expect.objectContaining({ 'customData.favouriteColour': 'blue' }));
  });

  it('logs an entity_updated activity tagged isAutomation (loop-safe)', async () => {
    await handleUpdateEntity({ updates: { name: 'New Name' } }, ctx());
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'entity_updated',
        source: 'automation',
        metadata: expect.objectContaining({ isAutomation: true }),
      }),
    );
  });
});

describe('handleAssignEntity (ASSIGN_ENTITY)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveContact.mockResolvedValue({ entityId: 'ent-1', workspaceEntityId: 'we-1' });
  });

  it('assigns a fixed user', async () => {
    await handleAssignEntity({ assignedTo: 'user-42' }, ctx());
    expect(weUpdate).toHaveBeenCalledWith(expect.objectContaining({ assignedTo: 'user-42' }));
  });

  it("resolves 'auto' to the triggering payload assignee", async () => {
    await handleAssignEntity({ assignedTo: 'auto' }, ctx({ payload: { assignedTo: { userId: 'user-99' } } }));
    expect(weUpdate).toHaveBeenCalledWith(expect.objectContaining({ assignedTo: 'user-99' }));
  });

  it('throws when the workspace entity cannot be found', async () => {
    mockResolveContact.mockResolvedValueOnce({ entityId: 'ent-1' }); // no workspaceEntityId
    await expect(handleAssignEntity({ assignedTo: 'user-42' }, ctx())).rejects.toThrow(/Workspace entity not found/i);
  });
});

describe('handleAddNote (ADD_NOTE)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveContact.mockResolvedValue({ entityId: 'ent-1', workspaceEntityId: 'we-1' });
  });

  it('writes a note to entity_notes with automation provenance', async () => {
    await handleAddNote({ content: 'Followed up by automation' }, ctx());
    expect(notesAdd).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: 'ent-1', content: 'Followed up by automation', source: 'automation', automationId: 'auto-1' }),
    );
  });

  it('logs a note_added activity', async () => {
    await handleAddNote({ content: 'hi' }, ctx());
    expect(mockLogActivity).toHaveBeenCalledWith(expect.objectContaining({ type: 'note_added' }));
  });

  it('throws when content is missing', async () => {
    await expect(handleAddNote({}, ctx())).rejects.toThrow(/requires entityId and content/i);
  });
});

describe('handleCreateEntity (CREATE_ENTITY)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateEntityAction.mockResolvedValue({ success: true, id: 'entity-new-1' });
  });

  it('creates an entity and returns its id, linking it to the run', async () => {
    const result = await handleCreateEntity(
      { name: 'Acme Inc', email: 'acme@x.com', entityType: 'institution' },
      ctx({ entityId: undefined }),
    );
    expect(result).toEqual({ id: 'entity-new-1' });
    expect(mockCreateEntityAction).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Acme Inc', contacts: expect.any(Array) }),
      expect.stringContaining('system-automation-create'),
      'ws-1',
      'institution',
      'org-1',
      true,
    );
    expect(runsUpdate).toHaveBeenCalledWith(expect.objectContaining({ entityId: 'entity-new-1' }));
  });

  it('throws when name is missing', async () => {
    await expect(handleCreateEntity({ email: 'a@x.com' }, ctx({ entityId: undefined }))).rejects.toThrow(/Name is required/i);
  });

  it('throws when neither phone nor email is provided', async () => {
    await expect(handleCreateEntity({ name: 'Acme' }, ctx({ entityId: undefined }))).rejects.toThrow(/phone number or email/i);
  });

  it('throws when the underlying createEntityAction fails', async () => {
    mockCreateEntityAction.mockResolvedValueOnce({ success: false, error: 'duplicate detected' });
    await expect(handleCreateEntity({ name: 'Acme', email: 'a@x.com' }, ctx({ entityId: undefined }))).rejects.toThrow(/duplicate detected/i);
  });
});
