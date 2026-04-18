import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerAutomationProtocols } from '../automation-processor';
import { logActivity } from '../activity-logger';
import { adminDb } from '../firebase-admin';

const mockBatch = {
    update: vi.fn(),
    commit: vi.fn().mockResolvedValue(true)
};

// Mock Dependencies
vi.mock('../firebase-admin', () => {
    const mockBatch = {
        update: vi.fn(),
        commit: vi.fn().mockResolvedValue(true)
    };
    return {
        adminDb: {
            collection: vi.fn(),
            batch: vi.fn(() => mockBatch)
        }
    };
});

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
    })
}));

describe('Unified Tag Automation Flow', () => {
    const mockWorkspaceId = 'ws_123';
    const mockOrgId = 'org_456';
    const mockEntityId = 'ent_789';

    beforeEach(() => {
        vi.clearAllMocks();
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

        // Mock Firestore for automations query
        const mockAutoSnap = {
            empty: false,
            docs: [{ id: 'auto_1', data: () => mockAutomation }]
        };
        (adminDb.collection as any).mockReturnValue({
            where: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue(mockAutoSnap),
            add: vi.fn().mockResolvedValue({ id: 'run_1', update: vi.fn() }),
            doc: vi.fn().mockReturnValue({
                update: vi.fn()
            })
        });

        // Mock resolveContact for action processing
        const { resolveContact } = await import('../contact-adapter');
        (resolveContact as any).mockResolvedValue({
            id: mockEntityId,
            workspaceEntityId: 'we_123',
            entityType: 'institution',
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

        // 4. Verify triggerAutomationProtocols was invoked and processed the tree
        // Verification: The batch update should have been called for 'tag_priority'
        const batch = adminDb.batch();
        expect(batch.update).toHaveBeenCalled();
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
        (adminDb.collection as any).mockReturnValue({
            where: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue(mockAutoSnap),
            add: vi.fn().mockResolvedValue({ id: 'run_2', update: vi.fn() })
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

        // Verify executeAutomation was NOT called (or run was not initialized)
        // In our current implementation, it skips before executeAutomation
        expect(adminDb.collection).not.toHaveBeenCalledWith('automation_runs');
    });
});
