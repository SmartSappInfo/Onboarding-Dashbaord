// @vitest-environment node
// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { importCallScriptAction } from '../call-centre-actions';
import { canUser } from '../workspace-permissions';
import {
  buildScriptExport,
  serializeScriptExport,
  CFLOW_FORMAT,
  CFLOW_VERSION,
} from '../call-script-portability';

const mockAdd = vi.fn().mockResolvedValue({ id: 'new_doc_1' });

vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      add: mockAdd,
      doc: vi.fn(() => ({ get: vi.fn(), update: vi.fn(), delete: vi.fn() })),
      where: vi.fn(() => ({ orderBy: vi.fn(() => ({ get: vi.fn() })), get: vi.fn() })),
    })),
  },
  FieldValue: {},
}));

vi.mock('../workspace-permissions', () => ({
  canUser: vi.fn().mockResolvedValue({ granted: true }),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

// Mirror the service's external deps so module load is side-effect free (see call-centre.test.ts).
vi.mock('../messaging-actions', () => ({
  previewCampaignAudience: vi.fn().mockResolvedValue({ success: true, preview: [], count: 0 }),
  resolveRecipientContacts: vi.fn().mockResolvedValue([]),
}));
vi.mock('../activity-logger', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

const ctx = { organizationId: 'org_current', workspaceId: 'ws_current' };

const validFile = serializeScriptExport(
  buildScriptExport({
    name: 'Welcome Call',
    description: 'Opener',
    content: 'Hello {{ENTITY_NAME}}',
    variables: ['ENTITY_NAME'],
  })
);

describe('importCallScriptAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(canUser).mockResolvedValue({ granted: true });
  });

  it('denies import without create permission', async () => {
    vi.mocked(canUser).mockResolvedValueOnce({ granted: false, reason: 'no access' });
    const res = await importCallScriptAction(validFile, ctx, 'user_1');
    expect(res.success).toBe(false);
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('rejects an invalid file without creating anything', async () => {
    const res = await importCallScriptAction('{ not valid', ctx, 'user_1');
    expect(res.success).toBe(false);
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('creates an imported script bound to the current org/workspace', async () => {
    const res = await importCallScriptAction(validFile, ctx, 'user_1');
    expect(res.success).toBe(true);
    expect(res.id).toBe('new_doc_1');
    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org_current',
        workspaceId: 'ws_current',
        name: 'Welcome Call',
        source: 'imported',
        createdBy: 'user_1',
      })
    );
    const payload = mockAdd.mock.calls[0][0];
    expect(payload.importMeta).toMatchObject({ originalName: 'Welcome Call' });
    expect(payload.variables).toEqual(['ENTITY_NAME']);
  });

  it('never binds to identity fields embedded in the file', async () => {
    const tampered = JSON.stringify({
      format: CFLOW_FORMAT,
      version: CFLOW_VERSION,
      script: {
        name: 'Evil',
        content: 'hi',
        organizationId: 'org_EVIL',
        workspaceId: 'ws_EVIL',
        id: 'doc_EVIL',
      },
    });
    await importCallScriptAction(tampered, ctx, 'user_1');
    const payload = mockAdd.mock.calls[0][0];
    expect(payload.organizationId).toBe('org_current');
    expect(payload.workspaceId).toBe('ws_current');
    expect(JSON.stringify(payload)).not.toContain('EVIL');
  });
});
