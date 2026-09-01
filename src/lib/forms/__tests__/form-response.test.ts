import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  updateSubmissionStatusAction,
  bulkUpdateSubmissionsAction,
  addSubmissionNoteAction,
  getSubmissionNotesAction,
  saveFormSavedViewAction,
  getFormSavedViewsAction,
  deleteFormSavedViewAction,
} from '../form-response-actions';
import { sanitizeCsvCell } from '../form-utils';

// Mock firebase-admin
vi.mock('@/lib/firebase-admin', () => {
  const updateMock = vi.fn().mockResolvedValue({});
  const deleteMock = vi.fn().mockResolvedValue({});
  const addMock = vi.fn().mockResolvedValue({ id: 'note_123' });
  const setMock = vi.fn().mockResolvedValue({});

  const batchMock = {
    update: vi.fn(),
    delete: vi.fn(),
    set: vi.fn(),
    commit: vi.fn().mockResolvedValue([]),
  };

  const docMock = vi.fn((docId: string) => ({
    get: vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({
        id: docId,
        formId: 'form_123',
        workspaceId: 'ws_abc',
        dealId: 'deal_999',
        status: 'new',
      }),
    }),
    update: updateMock,
    delete: deleteMock,
    set: setMock,
    collection: vi.fn(() => ({
      add: addMock,
      orderBy: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({
          docs: [
            {
              id: 'note_1',
              data: () => ({
                text: 'Followed up via phone call',
                authorName: 'Sarah Jenkins',
                createdAt: '2026-09-01T10:00:00Z',
              }),
            },
          ],
        }),
      }),
    })),
  }));

  const collectionMock = vi.fn((colName: string) => ({
    doc: docMock,
    add: vi.fn().mockResolvedValue({ id: 'saved_view_123' }),
    where: vi.fn().mockReturnValue({
      get: vi.fn().mockResolvedValue({
        docs: [
          {
            id: 'view_1',
            data: () => ({
              name: 'High Score Qualified',
              formId: 'form_123',
              filters: { statuses: ['qualified'], scoreMin: 50 },
            }),
          },
        ],
      }),
    }),
  }));

  return {
    adminDb: {
      collection: collectionMock,
      batch: vi.fn(() => batchMock),
    },
  };
});

describe('SmartSapp Forms 2.0: Response Center & Submissions Inbox Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('CSV Injection Sanitization', () => {
    it('neutralizes leading formula injection characters', () => {
      expect(sanitizeCsvCell('=SUM(A1:B2)')).toBe("\"'=SUM(A1:B2)\"");
      expect(sanitizeCsvCell('+123456')).toBe("\"'+123456\"");
      expect(sanitizeCsvCell('-500')).toBe("\"'-500\"");
      expect(sanitizeCsvCell('@cmd')).toBe("\"'@cmd\"");
      expect(sanitizeCsvCell('\tmalicious')).toBe("\"'\tmalicious\"");
    });

    it('escapes quotes and handles plain strings and null values', () => {
      expect(sanitizeCsvCell('John "The Boss" Doe')).toBe('"John ""The Boss"" Doe"');
      expect(sanitizeCsvCell(null)).toBe('""');
      expect(sanitizeCsvCell(undefined)).toBe('""');
      expect(sanitizeCsvCell('Normal Text')).toBe('"Normal Text"');
    });
  });

  describe('updateSubmissionStatusAction', () => {
    it('validates missing submissionId or status', async () => {
      const res = await updateSubmissionStatusAction('', 'qualified');
      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });

    it('updates submission status and syncs to linked deal', async () => {
      const res = await updateSubmissionStatusAction('sub_123', 'qualified');
      expect(res.success).toBe(true);
    });
  });

  describe('bulkUpdateSubmissionsAction', () => {
    it('chunks large arrays (> 400) and commits batches', async () => {
      const { adminDb } = await import('@/lib/firebase-admin');
      const largeSubIds = Array.from({ length: 450 }, (_, i) => `sub_${i}`);

      const res = await bulkUpdateSubmissionsAction({
        formId: 'form_123',
        workspaceId: 'ws_abc',
        submissionIds: largeSubIds,
        action: 'status',
        status: 'qualified',
      });

      expect(res.success).toBe(true);
      expect(res.updatedCount).toBe(450);
      expect(adminDb.batch).toHaveBeenCalledTimes(2); // 400 in first batch, 50 in second
    });

    it('handles bulk deletion', async () => {
      const res = await bulkUpdateSubmissionsAction({
        formId: 'form_123',
        workspaceId: 'ws_abc',
        submissionIds: ['sub_1', 'sub_2'],
        action: 'delete',
      });

      expect(res.success).toBe(true);
      expect(res.updatedCount).toBe(2);
    });
  });

  describe('Staff Notes Actions', () => {
    it('adds internal note and increments counter', async () => {
      const res = await addSubmissionNoteAction(
        'sub_123',
        'ws_abc',
        'user_1',
        'Sarah Jenkins',
        'Candidate is highly qualified.'
      );

      expect(res.success).toBe(true);
      expect(res.note).toBeDefined();
      expect(res.note?.text).toBe('Candidate is highly qualified.');
    });

    it('retrieves notes for a submission', async () => {
      const res = await getSubmissionNotesAction('sub_123');
      expect(res.success).toBe(true);
      expect(res.notes.length).toBe(1);
      expect(res.notes[0].authorName).toBe('Sarah Jenkins');
    });
  });

  describe('Saved Views Actions', () => {
    it('saves custom view preset', async () => {
      const res = await saveFormSavedViewAction({
        formId: 'form_123',
        workspaceId: 'ws_abc',
        name: 'High Score Leads',
        filters: { statuses: ['qualified'], scoreMin: 70 },
      });

      expect(res.success).toBe(true);
      expect(res.viewId).toBe('saved_view_123');
    });

    it('fetches saved views for a form', async () => {
      const views = await getFormSavedViewsAction('form_123');
      expect(views.length).toBe(1);
      expect(views[0].name).toBe('High Score Qualified');
    });

    it('deletes saved view', async () => {
      const res = await deleteFormSavedViewAction('view_1');
      expect(res.success).toBe(true);
    });
  });
});
