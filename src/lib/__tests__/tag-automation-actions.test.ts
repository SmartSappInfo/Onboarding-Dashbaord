import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bulkApplyTagsAction, bulkRemoveTagsAction } from '../tag-actions';
import { updateEntityAction } from '../entity-actions';
import { adminDb } from '../firebase-admin';
import type { Tag, EntityType } from '../types';

// Mock Dependencies
const mockBatch = {
    update: vi.fn(),
    commit: vi.fn().mockResolvedValue(true)
};

let mockContactTags: string[] = [];

vi.mock('../firebase-admin', () => {
    return {
        adminDb: {
            batch: () => mockBatch,
            collection: (collectionName: string) => {
                return {
                    add: vi.fn().mockResolvedValue({ id: 'new_doc_id' }),
                    doc: (docId: string) => {
                        return {
                            set: vi.fn().mockResolvedValue(undefined),
                            update: vi.fn().mockResolvedValue(undefined),
                            get: async () => {
                                if (collectionName === 'tags' && docId === 'tag_hot') {
                                    return {
                                        exists: true,
                                        id: 'tag_hot',
                                        data: () => ({
                                            id: 'tag_hot',
                                            name: 'Hot Lead',
                                            workspaceId: 'ws_123',
                                            organizationId: 'org_456',
                                        })
                                    };
                                }
                                if (collectionName === 'entities' && docId === 'ent_789') {
                                    return {
                                        exists: true,
                                        id: 'ent_789',
                                        data: () => ({
                                            id: 'ent_789',
                                            name: 'Test institution',
                                            entityType: 'institution',
                                            workspaceTags: mockContactTags,
                                            globalTags: mockContactTags,
                                            organizationId: 'org_456',
                                            workspaceId: 'ws_123'
                                        })
                                    };
                                }
                                return {
                                    exists: true,
                                    id: docId,
                                    data: () => ({
                                        id: docId,
                                        name: 'Test Doc',
                                        entityType: 'institution',
                                        workspaceTags: mockContactTags,
                                        globalTags: mockContactTags,
                                        tags: mockContactTags,
                                        organizationId: 'org_456',
                                        workspaceId: 'ws_123'
                                    })
                                };
                            }
                        };
                    },
                    where: function() { return this; },
                    limit: function() { return this; },
                    get: async () => {
                        if (collectionName === 'workspace_entities') {
                            return {
                                empty: false,
                                docs: [{
                                    id: 'we_123',
                                    ref: {
                                        update: vi.fn().mockResolvedValue(undefined)
                                    },
                                    data: () => ({
                                        entityId: 'ent_789',
                                        workspaceId: 'ws_123',
                                        organizationId: 'org_456',
                                        workspaceTags: mockContactTags
                                    })
                                }]
                            };
                        }
                        return {
                            empty: false,
                            docs: [{
                                id: 'we_123',
                                data: () => ({ workspaceId: 'ws_123', organizationId: 'org_456' })
                            }]
                        };
                    }
                };
            }
        }
    };
});

vi.mock('@/firebase/config', () => ({
    firestore: {},
}));

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    doc: vi.fn(),
    getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
    getDocs: vi.fn().mockResolvedValue({ empty: true, docs: [], forEach: () => {} }),
    addDoc: vi.fn(),
    updateDoc: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    Timestamp: {},
    arrayUnion: vi.fn((...items: unknown[]) => items),
    arrayRemove: vi.fn((...items: unknown[]) => items),
}));

vi.mock('firebase-admin/firestore', () => ({
    FieldValue: {
        arrayUnion: vi.fn((...items: unknown[]) => ({ _methodName: 'FieldValue.arrayUnion', _elements: items })),
        arrayRemove: vi.fn((...items: unknown[]) => ({ _methodName: 'FieldValue.arrayRemove', _elements: items })),
        increment: vi.fn((n: number) => ({ _methodName: 'FieldValue.increment', _value: n })),
    }
}));

vi.mock('../contact-adapter', () => ({
    resolveContact: vi.fn()
}));

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
}));

vi.mock('../workspace-permissions', () => ({
    canUser: vi.fn().mockResolvedValue({ granted: true })
}));

const mockTriggerAutomationProtocols = vi.fn();
vi.mock('../automation-processor', () => ({
    triggerAutomationProtocols: (...args: unknown[]) => mockTriggerAutomationProtocols(...args),
}));
vi.mock('../automations/orchestrator', () => ({
    triggerAutomationProtocolsBulk: vi.fn(async (event: string, workspaceId: string, items: Array<{ entityId: string; payload?: any }>) => {
        for (const item of items) {
            mockTriggerAutomationProtocols(event, {
                tagId: item.payload?.tagId || item.payload?.tag,
                entityId: item.entityId,
                workspaceId: workspaceId,
                organizationId: item.payload?.organizationId || 'org_456',
            });
        }
    }),
}));

let afterPromises: Promise<unknown>[] = [];
vi.mock('next/server', () => ({
    unstable_after: vi.fn((fn: () => Promise<unknown> | void) => {
        const p = Promise.resolve(fn());
        afterPromises.push(p);
        return p;
    }),
    after: vi.fn((fn: () => Promise<unknown> | void) => {
        const p = Promise.resolve(fn());
        afterPromises.push(p);
        return p;
    })
}));

describe('Tag Automation Actions Integration', () => {
    const mockWorkspaceId = 'ws_123';
    const mockOrgId = 'org_456';
    const mockEntityId = 'ent_789';
    const mockUserId = 'user_1';

    beforeEach(() => {
        vi.clearAllMocks();
        afterPromises = [];
        mockBatch.update.mockClear();
        mockBatch.commit.mockClear();
        mockContactTags = [];
    });

    it('should trigger automation when bulk tag applied', async () => {
        mockContactTags = [];

        // Call bulk apply tags
        await bulkApplyTagsAction([mockEntityId], 'workspace_entity', ['tag_hot'], mockUserId);

        // Wait for unstable_after execution
        await Promise.all(afterPromises);

        // Check if triggerAutomationProtocols was called
        expect(mockTriggerAutomationProtocols).toHaveBeenCalledWith(
            'TAG_ADDED',
            expect.objectContaining({
                tagId: 'tag_hot',
                entityId: mockEntityId,
                workspaceId: mockWorkspaceId,
                organizationId: mockOrgId
            })
        );
    });

    it('should trigger automation when bulk tag removed', async () => {
        mockContactTags = ['tag_hot'];

        await bulkRemoveTagsAction([mockEntityId], 'workspace_entity', ['tag_hot'], mockUserId);

        await Promise.all(afterPromises);

        expect(mockTriggerAutomationProtocols).toHaveBeenCalledWith(
            'TAG_REMOVED',
            expect.objectContaining({
                tagId: 'tag_hot',
                entityId: mockEntityId,
                workspaceId: mockWorkspaceId,
                organizationId: mockOrgId
            })
        );
    });

    it('should trigger automation when tag is updated via updateEntityAction', async () => {
        mockContactTags = [];

        await updateEntityAction(
            mockEntityId,
            {
                name: 'Test institution',
                workspaceTags: ['tag_hot']
            },
            mockUserId,
            mockWorkspaceId,
            mockOrgId
        );

        await Promise.all(afterPromises);

        expect(mockTriggerAutomationProtocols).toHaveBeenCalledWith(
            'TAG_ADDED',
            expect.objectContaining({
                tagId: 'tag_hot',
                entityId: mockEntityId,
                workspaceId: mockWorkspaceId,
                organizationId: mockOrgId
            })
        );
    });
});
