import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  validateSourceUrl, 
  executeDocumentProcessingPipeline 
} from '../processing-pipeline';
import { 
  queueDocumentProcessingAction, 
  getProcessingJobStatusAction, 
  retryFailedProcessingJobAction 
} from '../processing-actions';

const mockStore: Record<string, Record<string, Record<string, unknown>>> = {
  document_processing_jobs: {},
  documents: {},
  document_versions: {},
  document_pages: {},
  flipbooks: {},
  flipbook_pages: {},
};

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: (colName: string) => ({
      doc: (docId: string) => ({
        get: vi.fn(() => Promise.resolve({
          exists: !!mockStore[colName]?.[docId],
          data: () => mockStore[colName]?.[docId],
        })),
        set: vi.fn((data: Record<string, unknown>) => {
          if (!mockStore[colName]) mockStore[colName] = {};
          mockStore[colName][docId] = { ...data };
          return Promise.resolve();
        }),
        update: vi.fn((data: Record<string, unknown>) => {
          if (!mockStore[colName]) mockStore[colName] = {};
          if (!mockStore[colName][docId]) mockStore[colName][docId] = {};
          mockStore[colName][docId] = { ...mockStore[colName][docId], ...data };
          return Promise.resolve();
        }),
      }),
      where: () => ({
        where: () => ({
          get: vi.fn(() => Promise.resolve({
            size: 0,
            docs: [],
          })),
        }),
        get: vi.fn(() => Promise.resolve({
          size: 0,
          docs: [],
        })),
      }),
    }),
  },
}));

describe('Processing Pipeline & SSRF Protection', () => {
  beforeEach(() => {
    for (const key of Object.keys(mockStore)) {
      mockStore[key] = {};
    }
  });

  it('validates safe public HTTPS URLs', () => {
    const valid = validateSourceUrl('https://example.com/assets/annual-report.pdf');
    expect(valid.isValid).toBe(true);
    expect(valid.error).toBeUndefined();
  });

  it('blocks localhost, 127.0.0.1, and loopback addresses (SSRF Guard)', () => {
    const localhost = validateSourceUrl('http://localhost:8080/secret.pdf');
    expect(localhost.isValid).toBe(false);
    expect(localhost.error).toContain('Localhost');

    const loopback = validateSourceUrl('http://127.0.0.1/admin.pdf');
    expect(loopback.isValid).toBe(false);

    const ipv6Loopback = validateSourceUrl('http://[::1]/internal.pdf');
    expect(ipv6Loopback.isValid).toBe(false);
  });

  it('blocks AWS/Cloud metadata IP and private RFC 1918 subnets', () => {
    const cloudMeta = validateSourceUrl('http://169.254.169.254/latest/meta-data/');
    expect(cloudMeta.isValid).toBe(false);

    const private10 = validateSourceUrl('http://10.0.0.5/doc.pdf');
    expect(private10.isValid).toBe(false);

    const private192 = validateSourceUrl('http://192.168.1.1/doc.pdf');
    expect(private192.isValid).toBe(false);
  });

  it('executes full pipeline successfully for a valid document', async () => {
    mockStore.document_processing_jobs['job_123'] = {
      id: 'job_123',
      workspaceId: 'ws_1',
      documentId: 'doc_1',
      versionId: 'doc_1_v1',
      status: 'queued',
      progress: 0,
      attempts: 1,
    };

    mockStore.documents['doc_1'] = {
      id: 'doc_1',
      workspaceId: 'ws_1',
      status: 'draft',
    };

    mockStore.document_versions['doc_1_v1'] = {
      id: 'doc_1_v1',
      documentId: 'doc_1',
      status: 'processing',
    };

    const result = await executeDocumentProcessingPipeline({
      jobId: 'job_123',
      workspaceId: 'ws_1',
      documentId: 'doc_1',
      versionId: 'doc_1_v1',
      sourceUrl: 'https://example.com/handbook.pdf',
      sourceFileName: 'handbook.pdf',
    });

    expect(result.success).toBe(true);
    expect(result.progress).toBe(100);
    expect(result.stage).toBe('finalize_document');
    expect(mockStore.document_processing_jobs['job_123'].status).toBe('completed');
    expect(mockStore.documents['doc_1'].status).toBe('published');
  });

  it('queues a document processing job via Server Action', async () => {
    const result = await queueDocumentProcessingAction({
      workspaceId: 'ws_test_1',
      documentId: 'doc_test_1',
      versionId: 'doc_test_1_v1',
      sourceUrl: 'https://example.com/prospectus.pdf',
      sourceFileName: 'prospectus.pdf',
    });

    expect(result.success).toBe(true);
    expect(result.jobId).toBeDefined();
    expect(result.status).toBe('queued');
  });

  it('retrieves status of a queued processing job', async () => {
    mockStore.document_processing_jobs['job_polled_1'] = {
      id: 'job_polled_1',
      workspaceId: 'ws_test_1',
      documentId: 'doc_test_1',
      versionId: 'doc_test_1_v1',
      status: 'processing',
      progress: 45,
      jobType: 'extract_pages',
    };

    const result = await getProcessingJobStatusAction('job_polled_1', 'ws_test_1');
    expect(result.success).toBe(true);
    expect(result.progress).toBe(45);
    expect(result.stage).toBe('extract_pages');
  });
});
