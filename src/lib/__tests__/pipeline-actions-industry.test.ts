// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDefaultPipelineForIndustry } from '../pipeline-actions';
import { INDUSTRY_CONFIG } from '../industry-config';
import type { IndustryVertical } from '../types';

// Mock firebase-admin
const mockStages = new Map<string, any>();
const mockPipelines = new Map<string, any>();

vi.mock('../firebase-admin', () => {
  return {
    adminDb: {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === 'stages') {
          return {
            doc: vi.fn((id?: string) => {
              const docId = id || `stage_${Date.now()}_${Math.random()}`;
              return {
                id: docId,
                set: vi.fn().mockImplementation(async (data: any) => {
                  mockStages.set(docId, { ...data, id: docId });
                  return { id: docId };
                }),
                get: vi.fn().mockImplementation(async () => ({
                  exists: mockStages.has(docId),
                  data: () => mockStages.get(docId),
                  id: docId
                }))
              };
            })
          };
        }
        if (collectionName === 'pipelines') {
          return {
            doc: vi.fn((id?: string) => {
              const docId = id || `pipeline_${Date.now()}_${Math.random()}`;
              return {
                id: docId,
                set: vi.fn().mockImplementation(async (data: any) => {
                  mockPipelines.set(docId, { ...data, id: docId });
                  return { id: docId };
                }),
                get: vi.fn().mockImplementation(async () => ({
                  exists: mockPipelines.has(docId),
                  data: () => mockPipelines.get(docId),
                  id: docId
                }))
              };
            })
          };
        }
        return {};
      })
    }
  };
});

describe('createDefaultPipelineForIndustry', () => {
  beforeEach(() => {
    // Clear mocks before each test
    mockStages.clear();
    mockPipelines.clear();
  });

  it('should create a pipeline for SaaS industry with correct stages', async () => {
    const workspaceId = 'test-workspace-saas';
    const industry: IndustryVertical = 'SaaS';

    const result = await createDefaultPipelineForIndustry(workspaceId, industry);

    expect(result.success).toBe(true);
    expect(result.id).toBeDefined();

    const pipeline = Array.from(mockPipelines.values())[0];

    expect(pipeline).toBeDefined();
    expect(pipeline.name).toBe('Customer Pipeline');
    expect(pipeline.workspaceIds).toEqual([workspaceId]);
    expect(pipeline.isDefault).toBe(true);
    expect(pipeline.stageIds).toHaveLength(6);

    // Verify stages were created
    expect(mockStages.size).toBe(6);
    const stages = Array.from(mockStages.values());
    expect(stages[0].name).toBe('Lead');
    expect(stages[1].name).toBe('Trial');
    expect(stages[2].name).toBe('Onboarding');
    expect(stages[3].name).toBe('Active');
    expect(stages[4].name).toBe('Renewal');
    expect(stages[5].name).toBe('Churned');
  });

  it('should create a pipeline for SchoolEnrollment industry with correct stages', async () => {
    const workspaceId = 'test-workspace-school';
    const industry: IndustryVertical = 'SchoolEnrollment';

    const result = await createDefaultPipelineForIndustry(workspaceId, industry);

    expect(result.success).toBe(true);

    const pipeline = Array.from(mockPipelines.values())[0];

    expect(pipeline.name).toBe('Admissions Pipeline');
    expect(pipeline.stageIds).toHaveLength(5);

    const stages = Array.from(mockStages.values());
    expect(stages[0].name).toBe('Enquiry');
    expect(stages[1].name).toBe('Application');
    expect(stages[2].name).toBe('Review');
    expect(stages[3].name).toBe('Accepted');
    expect(stages[4].name).toBe('Enrolled');
  });

  it('should create a pipeline for Law industry with correct stages', async () => {
    const workspaceId = 'test-workspace-law';
    const industry: IndustryVertical = 'Law';

    const result = await createDefaultPipelineForIndustry(workspaceId, industry);

    expect(result.success).toBe(true);

    const pipeline = Array.from(mockPipelines.values())[0];

    expect(pipeline.name).toBe('Legal Pipeline');
    expect(pipeline.stageIds).toHaveLength(6);

    const stages = Array.from(mockStages.values());
    expect(stages[0].name).toBe('Intake');
    expect(stages[1].name).toBe('Conflict Check');
    expect(stages[2].name).toBe('Consultation');
    expect(stages[3].name).toBe('Engagement');
    expect(stages[4].name).toBe('Active');
    expect(stages[5].name).toBe('Closed');
  });

  it('should create a pipeline for Marketing industry with correct stages', async () => {
    const workspaceId = 'test-workspace-marketing';
    const industry: IndustryVertical = 'Marketing';

    const result = await createDefaultPipelineForIndustry(workspaceId, industry);

    expect(result.success).toBe(true);

    const pipeline = Array.from(mockPipelines.values())[0];

    expect(pipeline.name).toBe('Agency Pipeline');
    expect(pipeline.stageIds).toHaveLength(6);

    const stages = Array.from(mockStages.values());
    expect(stages[0].name).toBe('Discovery');
    expect(stages[1].name).toBe('Proposal');
    expect(stages[2].name).toBe('Planning');
    expect(stages[3].name).toBe('Execution');
    expect(stages[4].name).toBe('Reporting');
    expect(stages[5].name).toBe('Retention');
  });

  it('should create a pipeline for RealEstate industry with correct stages', async () => {
    const workspaceId = 'test-workspace-realestate';
    const industry: IndustryVertical = 'RealEstate';

    const result = await createDefaultPipelineForIndustry(workspaceId, industry);

    expect(result.success).toBe(true);

    const pipeline = Array.from(mockPipelines.values())[0];

    expect(pipeline.name).toBe('Property Pipeline');
    expect(pipeline.stageIds).toHaveLength(6);

    const stages = Array.from(mockStages.values());
    expect(stages[0].name).toBe('Enquiry');
    expect(stages[1].name).toBe('Viewing');
    expect(stages[2].name).toBe('Offer');
    expect(stages[3].name).toBe('Negotiation');
    expect(stages[4].name).toBe('Documentation');
    expect(stages[5].name).toBe('Closed');
  });

  it('should create a pipeline for Consultancy industry with correct stages', async () => {
    const workspaceId = 'test-workspace-consultancy';
    const industry: IndustryVertical = 'Consultancy';

    const result = await createDefaultPipelineForIndustry(workspaceId, industry);

    expect(result.success).toBe(true);

    const pipeline = Array.from(mockPipelines.values())[0];

    expect(pipeline.name).toBe('Consulting Pipeline');
    expect(pipeline.stageIds).toHaveLength(6);

    const stages = Array.from(mockStages.values());
    expect(stages[0].name).toBe('Enquiry');
    expect(stages[1].name).toBe('Discovery');
    expect(stages[2].name).toBe('Proposal');
    expect(stages[3].name).toBe('Engagement');
    expect(stages[4].name).toBe('Delivery');
    expect(stages[5].name).toBe('Outcome');
  });

  it('should assign colors to stages in correct order', async () => {
    const workspaceId = 'test-workspace-colors';
    const industry: IndustryVertical = 'SaaS';

    await createDefaultPipelineForIndustry(workspaceId, industry);

    const stages = Array.from(mockStages.values());

    // Verify colors are assigned
    expect(stages[0].color).toBe('#6B7280'); // gray
    expect(stages[1].color).toBe('#3B82F6'); // blue
    expect(stages[2].color).toBe('#F59E0B'); // amber
    expect(stages[3].color).toBe('#10B981'); // green
    expect(stages[4].color).toBe('#8B5CF6'); // purple
    expect(stages[5].color).toBe('#EF4444'); // red
  });

  it('should set stage order correctly', async () => {
    const workspaceId = 'test-workspace-order';
    const industry: IndustryVertical = 'SaaS';

    await createDefaultPipelineForIndustry(workspaceId, industry);

    const stages = Array.from(mockStages.values());

    stages.forEach((stage, index) => {
      expect(stage.order).toBe(index + 1);
    });
  });

  it('should handle invalid industry gracefully', async () => {
    const workspaceId = 'test-workspace-invalid';
    const industry = 'InvalidIndustry' as IndustryVertical;

    const result = await createDefaultPipelineForIndustry(workspaceId, industry);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid industry vertical');
  });

  it('should create pipeline with correct metadata', async () => {
    const workspaceId = 'test-workspace-metadata';
    const industry: IndustryVertical = 'Marketing';

    const result = await createDefaultPipelineForIndustry(workspaceId, industry);

    expect(result.success).toBe(true);

    const pipeline = Array.from(mockPipelines.values())[0];

    expect(pipeline.id).toBeDefined();
    expect(pipeline.description).toBe('Default Marketing pipeline');
    expect(pipeline.workspaceIds).toEqual([workspaceId]);
    expect(pipeline.accessRoles).toEqual([]);
    expect(pipeline.isDefault).toBe(true);
    expect(pipeline.createdAt).toBeDefined();
    expect(pipeline.updatedAt).toBeDefined();
  });

  it('should match INDUSTRY_CONFIG template stages', async () => {
    const industries: IndustryVertical[] = ['SaaS', 'SchoolEnrollment', 'Law', 'Marketing', 'RealEstate', 'Consultancy'];

    for (const industry of industries) {
      mockStages.clear();

      const workspaceId = `test-workspace-${industry}`;
      await createDefaultPipelineForIndustry(workspaceId, industry);

      const stages = Array.from(mockStages.values());
      const template = INDUSTRY_CONFIG[industry].pipelineTemplate;

      expect(stages).toHaveLength(template.stages.length);
      stages.forEach((stage, index) => {
        expect(stage.name).toBe(template.stages[index]);
      });
    }
  });
});
