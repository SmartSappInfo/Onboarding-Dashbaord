// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerAutomationProtocols } from '../automation-processor';
import { logActivity } from '../activity-logger';
import { adminDb } from '../firebase-admin';

// Create shared mock batch that will be accessible in tests
const mockBatch = {
    update: vi.fn().mockImplementation(() => {}),
    commit: vi.fn().mockResolvedValue(true)
};

// Mock Dependencies
vi.mock('../firebase-admin', () => ({
    adminDb: {
        collection: vi.fn(),
        batch: vi.fn(() => mockBatch)
    }
}));

vi.mock('firebase-admin/firestore', () => ({
    FieldValue: {
        arrayUnion: vi.fn((...items) => ({ _methodName: 'FieldValue.arrayUnion', _elements: items })),
        arrayRemove: vi.fn((...items) => ({ _methodName: 'FieldValue.arrayRemove', _elements: items }))
    }
}));

vi.mock('../contact-adapter', () => ({
    resolveContact: vi.fn()
}));

vi.mock('../messaging-engine', () => ({
    sendMessage: vi.fn()
}));

let afterPromise: Promise<any> = Promise.resolve();
vi.mock('next/server', () => ({
    unstable_after: vi.fn((fn) => {
        afterPromise = fn();
        return afterPromise;
    }),
    after: vi.fn((fn) => {
        afterPromise = fn();
        return afterPromise;
    })
}));

describe('Unified Tag Automation Flow', () => {
    const mockWorkspaceId = 'ws_123';
    const mockOrgId = 'org_456';
    const mockEntityId = 'ent_789';

    beforeEach(() => {
        vi.clearAllMocks();
        // Reset the mock batch functions
        mockBatch.update.mockClear();
        mockBatch.commit.mockClear();
    });

    it('should trigger automation when tag is added', async () => {
        // 1. Setup Automation with TAG_ADDED trigger
        const mockAutomation = {
            id: 'auto_1',
            name: 'Tag Trigger Test',
            trigger: 'TAG_ADDED',
            isActive: true,
            workspaceIds: [mockWorkspaceId],
            nodes: [
                { id: 'n1', type: 'triggerNode', data: { config: { tagIds: ['tag_hot'] } } },
                { id: 'n2', type: 'tagActionNode', data: { action: 'add_tags', tagIds: ['tag_priority'] } }
            ],
            edges: [
                { id: 'e1', source: 'n1', target: 'n2' }
            ]
        };

        // Mock Firestore for automations query and runs
        const mockAutoSnap = {
            empty: false,
            docs: [{ id: 'auto_1', data: () => mockAutomation }]
        };
        
        const mockJobsSnap = {
            empty: true,
            docs: []
        };

        // Create mock document references for batch operations
        const mockWeDocRef = { path: 'workspace_entities/we_123' };
        const mockSchoolDocRef = { path: 'schools/ent_789' };
        const mockProspectDocRef = { path: 'prospects/ent_789' };

        // Enhanced mock with doc().get() support and proper doc references
        (adminDb.collection as any).mockImplementation((collectionName: string) => {
            const mockDoc = {
                get: vi.fn().mockResolvedValue({
                    exists: true,
                    data: () => ({ organizationId: mockOrgId })
                }),
                update: vi.fn().mockResolvedValue(undefined)
            };

            // Return appropriate doc ref based on collection
            const getDocRef = (docId: string) => {
                if (collectionName === 'workspace_entities') return mockWeDocRef;
                if (collectionName === 'schools') return mockSchoolDocRef;
                if (collectionName === 'prospects') return mockProspectDocRef;
                return { path: `${collectionName}/${docId}` };
            };

            return {
                where: vi.fn().mockReturnThis(),
                get: vi.fn().mockImplementation(() => {
                    if (collectionName === 'automations') return Promise.resolve(mockAutoSnap);
                    if (collectionName === 'automation_jobs') return Promise.resolve(mockJobsSnap);
                    return Promise.resolve({ empty: true, docs: [] });
                }),
                add: vi.fn().mockResolvedValue({ 
                    id: 'run_1', 
                    update: vi.fn().mockResolvedValue(undefined) 
                }),
                doc: vi.fn((docId?: string) => ({
                    ...mockDoc,
                    ref: getDocRef(docId || 'default')
                }))
            };
        });

        // Mock resolveContact for action processing
        const { resolveContact } = await import('../contact-adapter');
        (resolveContact as any).mockResolvedValue({
            id: mockEntityId,
            entityId: mockEntityId,
            workspaceEntityId: 'we_123',
            entityType: 'institution',
            name: 'Test School',
            tags: ['tag_hot']
        });

        // 2. Simulate Activity Logging (which happens in Tag Actions)
        await logActivity({
            organizationId: mockOrgId,
            workspaceId: mockWorkspaceId,
            entityId: mockEntityId,
            type: 'tag_added',
            source: 'activity',
            userId: 'user_1',
            description: 'Tag added',
            metadata: {
                tagId: 'tag_hot', // Matches trigger config
                contactType: 'school',
                appliedBy: 'manual'
            }
        });

        // 3. Wait for the background automation process to finish (the unstable_after block)
        await afterPromise;
        
        // Add a small delay to ensure all async operations complete
        await new Promise(resolve => setTimeout(resolve, 100));

        // 4. Verify batch operations were called
        expect(mockBatch.update).toHaveBeenCalled();
        expect(mockBatch.commit).toHaveBeenCalled();
        
        // Verify batch.update was called twice (once for workspace_entities, once for legacy)
        expect(mockBatch.update).toHaveBeenCalledTimes(2);
        expect(mockBatch.commit).toHaveBeenCalledTimes(1);
        
        // Verify at least one call was for workspace_entities with workspaceTags
        const calls = mockBatch.update.mock.calls;
        const workspaceCall = calls.find((call: any) => 
            call[1]?.workspaceTags !== undefined
        );
        expect(workspaceCall).toBeDefined();
        expect(workspaceCall[1]).toMatchObject({
            updatedAt: expect.any(String)
        });
        
        // Verify at least one call was for legacy collection with tags
        const legacyCall = calls.find((call: any) => 
            call[1]?.tags !== undefined
        );
        expect(legacyCall).toBeDefined();
        expect(legacyCall[1]).toMatchObject({
            updatedAt: expect.any(String)
        });
    });

    it('should NOT trigger automation if tagId does not match config', async () => {
        // Setup Automation with specific tag filter
        const mockAutomation = {
            id: 'auto_2',
            trigger: 'TAG_ADDED',
            isActive: true,
            workspaceIds: [mockWorkspaceId],
            nodes: [
                { id: 'n1', type: 'triggerNode', data: { config: { tagIds: ['tag_hot'] } } }
            ],
            edges: []
        };

        const mockAutoSnap = {
            empty: false,
            docs: [{ id: 'auto_2', data: () => mockAutomation }]
        };
        
        const mockJobsSnap = {
            empty: true,
            docs: []
        };

        // Enhanced mock with doc().get() support
        (adminDb.collection as any).mockImplementation((collectionName: string) => {
            const mockDoc = {
                get: vi.fn().mockResolvedValue({
                    exists: true,
                    data: () => ({ organizationId: mockOrgId })
                }),
                update: vi.fn().mockResolvedValue(undefined)
            };

            return {
                where: vi.fn().mockReturnThis(),
                get: vi.fn().mockImplementation(() => {
                    if (collectionName === 'automations') return Promise.resolve(mockAutoSnap);
                    if (collectionName === 'automation_jobs') return Promise.resolve(mockJobsSnap);
                    return Promise.resolve({ empty: true, docs: [] });
                }),
                add: vi.fn().mockResolvedValue({ 
                    id: 'run_2', 
                    update: vi.fn().mockResolvedValue(undefined) 
                }),
                doc: vi.fn(() => mockDoc)
            };
        });

        // Log an activity with a DIFFERENT tag
        await logActivity({
            organizationId: mockOrgId,
            workspaceId: mockWorkspaceId,
            entityId: mockEntityId,
            type: 'tag_added',
            source: 'activity',
            userId: 'user_1',
            description: 'Different tag added',
            metadata: {
                tagId: 'tag_cold', // Does NOT match hot
                contactType: 'school'
            }
        });

        // Wait for the background process (which should skip execution)
        await afterPromise;

        // Verify batch operations were NOT called (automation was filtered out)
        expect(mockBatch.update).not.toHaveBeenCalled();
        expect(mockBatch.commit).not.toHaveBeenCalled();
    });
});
