import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
    handleCreateDeal, 
    handleUpdateDealStage, 
    handleUpdateDealValue, 
    handleUpdateDealStatus 
} from '../automations/actions/deal-automation-actions';
import { adminDb } from '../firebase-admin';
import type { ExecutionContext } from '../automations/execution-types';
import type { DealAutomationActionConfig } from '../automations/actions/deal-automation-actions';

// Mock deal actions
const mockCreateDeal = vi.fn().mockResolvedValue({ id: 'deal-new-123' });
const mockUpdateDealStageAction = vi.fn().mockResolvedValue({ success: true });
const mockUpdateDealValueAction = vi.fn().mockResolvedValue({ success: true });
const mockUpdateDealStatusAction = vi.fn().mockResolvedValue({ success: true });

vi.mock('../../app/actions/deal-actions', () => ({
    createDeal: (data: Record<string, unknown>) => mockCreateDeal(data),
    updateDealStageAction: (dealId: string, stageId: string) => mockUpdateDealStageAction(dealId, stageId),
    updateDealValueAction: (dealId: string, value: number) => mockUpdateDealValueAction(dealId, value),
    updateDealStatusAction: (dealId: string, status: 'open' | 'won' | 'lost') => mockUpdateDealStatusAction(dealId, status),
}));

// Mock workspace entity actions
const mockLinkEntityToWorkspaceAction = vi.fn().mockResolvedValue({ success: true });
vi.mock('../workspace-entity-actions', () => ({
    linkEntityToWorkspaceAction: (input: Record<string, unknown>) => mockLinkEntityToWorkspaceAction(input),
}));

const mockDocGet = vi.fn();
const mockQueryGet = vi.fn();

const createMockCollection = (name: string) => {
    const chain = {
        where: vi.fn().mockImplementation(() => chain),
        orderBy: vi.fn().mockImplementation(() => chain),
        limit: vi.fn().mockImplementation(() => chain),
        add: vi.fn().mockResolvedValue({ id: 'activity-123' }),
        get: vi.fn().mockImplementation(async () => {
            if (name === 'deals') {
                return {
                    empty: false,
                    docs: [{
                        id: 'deal-target-abc',
                        exists: true,
                        data: () => ({ stageId: 'stage-old', value: 100 }),
                    }],
                };
            }
            if (name === 'workspace_entities') {
                const querySnap = await mockQueryGet(name);
                return querySnap || { empty: true, docs: [] };
            }
            return { empty: true, docs: [] };
        }),
        doc: vi.fn().mockImplementation((id: string) => ({
            get: vi.fn().mockImplementation(async () => {
                if (name === 'workspace_entities') {
                    const existsVal = await mockDocGet(id);
                    return {
                        exists: existsVal !== false,
                        id: id,
                        data: () => ({
                            id: 'entity-456',
                            workspaceId: 'workspace-local',
                            assignedTo: null,
                        }),
                    };
                }
                if (name === 'deals') {
                    const docData = await mockDocGet(id);
                    return {
                        exists: docData !== false,
                        id: id,
                        data: () => typeof docData === 'object' ? docData : { stageId: 'stage-old', value: 100 },
                    };
                }
                if (name === 'entities') {
                    return {
                        exists: true,
                        id: 'entity-456',
                        data: () => ({
                            organizationId: 'org-123',
                            name: 'Test Entity',
                            slug: 'test-entity',
                            entityType: 'institution',
                        }),
                    };
                }
                if (name === 'workspaces') {
                    return {
                        exists: true,
                        id: 'workspace-target',
                        data: () => ({
                            contactScope: 'institution',
                        }),
                    };
                }
                if (name === 'onboardingStages') {
                    return {
                        exists: true,
                        id: id || 'stage-1',
                        data: () => ({
                            pipelineId: 'pipeline-1',
                            name: 'Stage 1',
                        }),
                    };
                }
                if (name === 'pipelines') {
                    return {
                        exists: true,
                        id: id || 'pipeline-1',
                        data: () => ({
                            workspaceIds: ['workspace-local'],
                            name: 'Pipeline 1',
                        }),
                    };
                }
                return { exists: false };
            }),
            set: vi.fn().mockResolvedValue(undefined),
            update: vi.fn().mockResolvedValue(undefined),
        })),
    };
    return chain;
};

const mockCollection = vi.fn((name: string) => createMockCollection(name));

vi.mock('../firebase-admin', () => ({
    adminDb: {
        collection: (name: string) => mockCollection(name),
        collectionGroup: vi.fn(),
    },
}));

describe('Automation Deal Routing & Workspace Linking', () => {
    const mockContext: ExecutionContext = {
        entityId: 'entity-456',
        entityType: 'institution',
        workspaceId: 'workspace-local',
        organizationId: 'org-123',
        payload: { organizationId: 'org-123' },
        automationId: 'auto-1',
        runId: 'run-1',
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockDocGet.mockReset();
        mockQueryGet.mockReset();
    });

    describe('handleCreateDeal', () => {
        it('should create deal in local workspace if config.workspaceId is omitted', async () => {
            const config: DealAutomationActionConfig = {
                pipelineId: 'pipeline-1',
                stageId: 'stage-1',
                name: 'Local Deal',
                value: 100,
            };

            mockDocGet.mockResolvedValue(true);

            await handleCreateDeal(config, mockContext);

            expect(mockLinkEntityToWorkspaceAction).not.toHaveBeenCalled();
            expect(mockCreateDeal).toHaveBeenCalledWith(expect.objectContaining({
                entityId: 'entity-456',
                workspaceId: 'workspace-local',
                pipelineId: 'pipeline-1',
                stageId: 'stage-1',
                name: 'Local Deal',
                value: 100,
            }));
        });

        it('should trigger auto-linking and create deal in target workspace if target workspace is different and entity is not yet linked', async () => {
            const config: DealAutomationActionConfig = {
                workspaceId: 'workspace-target',
                pipelineId: 'pipeline-1',
                stageId: 'stage-1',
                name: 'Target Deal',
                value: 200,
            };

            mockDocGet.mockImplementation(async (id: string) => {
                if (id === 'workspace-target_entity-456') {
                    return false;
                }
                return true;
            });

            mockQueryGet.mockResolvedValue({
                empty: true,
                docs: [],
            });

            await handleCreateDeal(config, mockContext);

            expect(mockLinkEntityToWorkspaceAction).toHaveBeenCalledWith({
                entityId: 'entity-456',
                workspaceId: 'workspace-target',
                userId: 'system-automation',
                userName: 'Automation Engine',
                userEmail: 'automation@smartsapp.com',
            });

            expect(mockCreateDeal).toHaveBeenCalledWith(expect.objectContaining({
                entityId: 'entity-456',
                workspaceId: 'workspace-target',
                pipelineId: 'pipeline-1',
                stageId: 'stage-1',
                name: 'Target Deal',
                value: 200,
            }));
        });

        it('should skip auto-linking and create deal in target workspace if entity is already linked to target workspace', async () => {
            const config: DealAutomationActionConfig = {
                workspaceId: 'workspace-target',
                pipelineId: 'pipeline-1',
                stageId: 'stage-1',
                name: 'Target Deal',
                value: 200,
            };

            mockDocGet.mockResolvedValue(true);

            await handleCreateDeal(config, mockContext);

            expect(mockLinkEntityToWorkspaceAction).not.toHaveBeenCalled();
            expect(mockCreateDeal).toHaveBeenCalledWith(expect.objectContaining({
                workspaceId: 'workspace-target',
                pipelineId: 'pipeline-1',
            }));
        });
    });

    describe('handleUpdateDealStage', () => {
        it('should update deal stage when target workspace is specified and stage is different', async () => {
            const config: DealAutomationActionConfig = {
                workspaceId: 'workspace-target',
                pipelineId: 'pipeline-1',
                stageId: 'stage-new',
            };

            mockDocGet.mockResolvedValue({ stageId: 'stage-old' });

            await handleUpdateDealStage(config, mockContext);

            expect(mockUpdateDealStageAction).toHaveBeenCalledWith('deal-target-abc', 'stage-new');
        });

        it('should skip update if deal is already at the target stage', async () => {
            const config: DealAutomationActionConfig = {
                workspaceId: 'workspace-target',
                pipelineId: 'pipeline-1',
                stageId: 'stage-current',
            };

            mockDocGet.mockResolvedValue({ stageId: 'stage-current' });

            await handleUpdateDealStage(config, mockContext);

            expect(mockUpdateDealStageAction).not.toHaveBeenCalled();
        });
    });

    describe('handleUpdateDealValue', () => {
        it('should update with absolute value if value string is a plain number', async () => {
            const config: DealAutomationActionConfig = {
                workspaceId: 'workspace-target',
                pipelineId: 'pipeline-1',
                value: 150,
            };

            mockDocGet.mockResolvedValue({ value: 100 });

            await handleUpdateDealValue(config, mockContext);

            expect(mockUpdateDealValueAction).toHaveBeenCalledWith('deal-target-abc', 150);
        });

        it('should update with relative positive value if value starts with +', async () => {
            const config: DealAutomationActionConfig = {
                workspaceId: 'workspace-target',
                pipelineId: 'pipeline-1',
                value: '+50',
            };

            mockDocGet.mockResolvedValue({ value: 100 });

            await handleUpdateDealValue(config, mockContext);

            expect(mockUpdateDealValueAction).toHaveBeenCalledWith('deal-target-abc', 150);
        });

        it('should update with relative negative value if value starts with -', async () => {
            const config: DealAutomationActionConfig = {
                workspaceId: 'workspace-target',
                pipelineId: 'pipeline-1',
                value: '-30',
            };

            mockDocGet.mockResolvedValue({ value: 100 });

            await handleUpdateDealValue(config, mockContext);

            expect(mockUpdateDealValueAction).toHaveBeenCalledWith('deal-target-abc', 70);
        });
    });

    describe('handleUpdateDealStatus', () => {
        it('should update status to won, lost or open if valid', async () => {
            const config: DealAutomationActionConfig = {
                workspaceId: 'workspace-target',
                pipelineId: 'pipeline-1',
                status: 'won',
            };

            mockDocGet.mockResolvedValue({ status: 'open' });

            await handleUpdateDealStatus(config, mockContext);

            expect(mockUpdateDealStatusAction).toHaveBeenCalledWith('deal-target-abc', 'won');
        });

        it('should throw an error if status is invalid', async () => {
            const config: DealAutomationActionConfig = {
                workspaceId: 'workspace-target',
                pipelineId: 'pipeline-1',
                status: 'invalid' as any,
            };

            mockDocGet.mockResolvedValue({ status: 'open' });

            await expect(handleUpdateDealStatus(config, mockContext)).rejects.toThrow('Invalid status: invalid');
        });

        it('should skip update if deal status is already at the target status', async () => {
            const config: DealAutomationActionConfig = {
                workspaceId: 'workspace-target',
                pipelineId: 'pipeline-1',
                status: 'won',
            };

            mockDocGet.mockResolvedValue({ status: 'won' });

            await handleUpdateDealStatus(config, mockContext);

            expect(mockUpdateDealStatusAction).not.toHaveBeenCalled();
        });
    });
});
