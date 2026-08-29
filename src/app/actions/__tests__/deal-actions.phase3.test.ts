import { describe, it, expect, beforeEach, vi } from 'vitest';
import { convertLeadToDealAction, logDealInteractionAction } from '../deal-actions';
import type { Deal, OnboardingStage, WorkspaceEntity } from '@/lib/types';
import type { LeadConversionOptions, DealInteractionData } from '@/lib/deals/deal-types';

// Mock canUser
let permissionGranted = true;
vi.mock('@/lib/workspace-permissions', () => ({
  canUser: vi.fn().mockImplementation(async () => {
    return { granted: permissionGranted, reason: permissionGranted ? undefined : 'Permission denied' };
  }),
}));

// Mock activity logger
let loggedActivities: Array<Record<string, unknown>> = [];
vi.mock('@/lib/activity-logger', () => ({
  logActivity: vi.fn().mockImplementation(async (activity: Record<string, unknown>) => {
    loggedActivities.push(activity);
  }),
}));

// Mock next/cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// Mock orchestrator
vi.mock('@/lib/automations/orchestrator', () => ({
  triggerAutomationProtocols: vi.fn().mockResolvedValue(undefined),
}));

// Mock deal-expected-close
vi.mock('../../admin/pipeline/utils/deal-expected-close', () => ({
  calculateExpectedCloseDate: vi.fn().mockReturnValue('2026-11-15T00:00:00.000Z'),
}));

// Mock Firestore adminDb stores
const mockDealsStore = new Map<string, Deal>();
const mockStagesStore = new Map<string, OnboardingStage>();
const mockWorkspaceEntitiesStore = new Map<string, WorkspaceEntity>();
const mockNotesStore = new Map<string, Record<string, unknown>>();

vi.mock('@/lib/firebase-admin', () => {
  return {
    adminDb: {
      collection: vi.fn((name: string) => {
        if (name === 'deals') {
          return {
            doc: vi.fn((id?: string) => {
              const docId = id || `deal_${Math.random().toString(36).substring(2, 9)}`;
              return {
                id: docId,
                get: vi.fn().mockImplementation(async () => ({
                  exists: mockDealsStore.has(docId),
                  data: () => mockDealsStore.get(docId),
                })),
                update: vi.fn().mockImplementation(async (data: Partial<Deal>) => {
                  const existing = mockDealsStore.get(docId);
                  if (existing) {
                    mockDealsStore.set(docId, { ...existing, ...data } as Deal);
                  }
                }),
              };
            }),
          };
        }
        if (name === 'onboardingStages') {
          return {
            where: vi.fn((field: string, op: string, val: string) => ({
              get: vi.fn().mockImplementation(async () => {
                const stages = Array.from(mockStagesStore.values()).filter(s => s.pipelineId === val);
                return {
                  empty: stages.length === 0,
                  docs: stages.map(s => ({
                    id: s.id,
                    data: () => s,
                  })),
                };
              }),
            })),
            doc: vi.fn((id: string) => ({
              id,
              get: vi.fn().mockImplementation(async () => ({
                exists: mockStagesStore.has(id),
                data: () => mockStagesStore.get(id),
              })),
            })),
          };
        }
        if (name === 'workspace_entities') {
          return {
            doc: vi.fn((id: string) => ({
              id,
              get: vi.fn().mockImplementation(async () => ({
                exists: mockWorkspaceEntitiesStore.has(id),
                data: () => mockWorkspaceEntitiesStore.get(id),
              })),
            })),
            where: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(() => ({
                  get: vi.fn().mockImplementation(async () => {
                    const entities = Array.from(mockWorkspaceEntitiesStore.values());
                    return {
                      empty: entities.length === 0,
                      docs: entities.map(e => ({ id: e.id, data: () => e })),
                    };
                  }),
                })),
              })),
            })),
          };
        }
        if (name === 'notes') {
          return {
            doc: vi.fn((id?: string) => {
              const docId = id || `note_${Math.random().toString(36).substring(2, 9)}`;
              return { id: docId };
            }),
          };
        }
        return {
          doc: vi.fn((id: string) => ({
            id,
            get: vi.fn().mockResolvedValue({ exists: false }),
          })),
        };
      }),
      batch: vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation((ref: { id: string }, data: Record<string, unknown>, opts?: { merge?: boolean }) => {
          if (ref.id.startsWith('deal_')) {
            mockDealsStore.set(ref.id, data as unknown as Deal);
          } else if (ref.id.startsWith('note_')) {
            mockNotesStore.set(ref.id, data);
          } else {
            const existing = mockWorkspaceEntitiesStore.get(ref.id);
            if (existing && opts?.merge) {
              mockWorkspaceEntitiesStore.set(ref.id, { ...existing, ...data } as WorkspaceEntity);
            } else {
              mockWorkspaceEntitiesStore.set(ref.id, data as unknown as WorkspaceEntity);
            }
          }
        }),
        update: vi.fn().mockImplementation((ref: { id: string }, data: Record<string, unknown>) => {
          if (mockDealsStore.has(ref.id)) {
            mockDealsStore.set(ref.id, { ...mockDealsStore.get(ref.id)!, ...data } as Deal);
          }
        }),
        commit: vi.fn().mockResolvedValue(undefined),
      }),
    },
  };
});

describe('Phase 3 — CRM Activity Graph & Lead Conversion Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permissionGranted = true;
    mockDealsStore.clear();
    mockStagesStore.clear();
    mockWorkspaceEntitiesStore.clear();
    mockNotesStore.clear();
    loggedActivities = [];
  });

  describe('convertLeadToDealAction', () => {
    it('rejects conversion if user lacks pipeline create permission', async () => {
      permissionGranted = false;

      const res = await convertLeadToDealAction({
        leadEntityId: 'lead-1',
        pipelineId: 'pipe-1',
        userId: 'user-1',
        workspaceId: 'ws-1',
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('Permission denied');
      expect(mockDealsStore.size).toBe(0);
    });

    it('rejects conversion if lead entity record does not exist', async () => {
      const res = await convertLeadToDealAction({
        leadEntityId: 'non-existent-lead',
        pipelineId: 'pipe-1',
        userId: 'user-1',
        workspaceId: 'ws-1',
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('Lead entity not found');
    });

    it('converts lead into a first-class deal, preserving attribution and contacts', async () => {
      // Seed lead entity in workspace_entities
      const leadEntity: Partial<WorkspaceEntity> = {
        id: 'ws-1_lead-100',
        entityId: 'lead-100',
        workspaceId: 'ws-1',
        organizationId: 'org-1',
        displayName: 'Acme Academy',
        utmSource: 'inbound_webinar',
        utmCampaign: 'q3_launch',
        entityContacts: [
          {
            id: 'c-1',
            name: 'Dr. John Smith',
            email: 'john@acme.edu',
            phone: '+1234567890',
            typeKey: 'principal',
            typeLabel: 'Principal',
            isPrimary: true,
            isSignatory: true,
            order: 1,
          },
          {
            id: 'c-2',
            name: 'Mary Jane',
            email: 'mary@acme.edu',
            typeKey: 'billing',
            typeLabel: 'Billing',
            isPrimary: false,
            isSignatory: false,
            order: 2,
          },
        ],
        customData: { curriculum: 'Cambridge' },
        workspaceTags: ['priority_lead', 'webinar_attendee'],
      };
      mockWorkspaceEntitiesStore.set('ws-1_lead-100', leadEntity as unknown as WorkspaceEntity);

      // Seed pipeline stages
      mockStagesStore.set('stage-discovery', {
        id: 'stage-discovery',
        name: 'Discovery',
        pipelineId: 'pipe-1',
        order: 1,
        probability: 30,
        slaDays: 14,
      } as OnboardingStage);

      mockStagesStore.set('stage-demo', {
        id: 'stage-demo',
        name: 'Product Demo',
        pipelineId: 'pipe-1',
        order: 2,
        probability: 50,
      } as OnboardingStage);

      const conversionOptions: LeadConversionOptions = {
        leadEntityId: 'lead-100',
        pipelineId: 'pipe-1',
        dealName: 'Acme Academy Expansion Deal',
        value: 25000,
        focalContactIds: ['c-1'],
        assignedTo: {
          userId: 'rep-1',
          name: 'Sarah Connor',
          email: 'sarah@smartsapp.com',
        },
        notes: 'Customer attended live webinar and requested expedited onboarding.',
        userId: 'user-1',
        workspaceId: 'ws-1',
      };

      const res = await convertLeadToDealAction(conversionOptions);

      expect(res.success).toBe(true);
      expect(res.dealId).toBeDefined();

      // Verify created Deal document
      const createdDeal = mockDealsStore.get(res.dealId!);
      expect(createdDeal).toBeDefined();
      expect(createdDeal?.name).toBe('Acme Academy Expansion Deal');
      expect(createdDeal?.value).toBe(25000);
      expect(createdDeal?.pipelineId).toBe('pipe-1');
      expect(createdDeal?.stageId).toBe('stage-discovery');
      expect(createdDeal?.stageName).toBe('Discovery');
      expect(createdDeal?.source).toBe('inbound_webinar');
      expect(createdDeal?.campaignId).toBe('q3_launch');
      expect(createdDeal?.leadId).toBe('lead-100');
      expect(createdDeal?.probability).toBe(30);
      expect(createdDeal?.weightedValue).toBe(7500); // 25000 * 0.30
      expect(createdDeal?.assignedTo?.userId).toBe('rep-1');
      expect(createdDeal?.focalContacts?.[0].name).toBe('Dr. John Smith');
      expect(createdDeal?.contacts?.[0].name).toBe('Mary Jane');
      expect(createdDeal?.tags).toContain('priority_lead');

      // Verify lead entity was stamped with conversion metadata
      const updatedLead = mockWorkspaceEntitiesStore.get('ws-1_lead-100');
      expect(updatedLead?.isConverted).toBe(true);
      expect(updatedLead?.convertedDealId).toBe(res.dealId);
      expect(updatedLead?.convertedBy).toBe('user-1');

      // Verify activity was logged with top-level dealId
      expect(loggedActivities.length).toBe(1);
      expect(loggedActivities[0].type).toBe('lead_converted');
      expect(loggedActivities[0].dealId).toBe(res.dealId);
      expect(loggedActivities[0].entityId).toBe('lead-100');
    });
  });

  describe('logDealInteractionAction', () => {
    it('rejects interaction logging if user lacks edit permission', async () => {
      permissionGranted = false;

      const interaction: DealInteractionData = {
        type: 'call',
        subject: 'Introductory call',
      };

      const res = await logDealInteractionAction('deal-1', interaction, 'user-1', 'ws-1');
      expect(res.success).toBe(false);
      expect(res.error).toContain('Permission denied');
    });

    it('logs phone call interaction with disposition outcome and duration', async () => {
      mockDealsStore.set('deal-1', {
        id: 'deal-1',
        name: 'St. George High Deal',
        workspaceId: 'ws-1',
        entityId: 'school-1',
      } as Deal);

      const interaction: DealInteractionData = {
        type: 'call',
        subject: 'Discovery Call with Principal',
        outcome: 'connected',
        durationMinutes: 20,
        recipientName: 'Principal Skinner',
        description: 'Discussed timeline for term 1 rollout. Client asked for quote.',
      };

      const res = await logDealInteractionAction('deal-1', interaction, 'user-1', 'ws-1');

      expect(res.success).toBe(true);
      expect(loggedActivities.length).toBe(1);
      expect(loggedActivities[0].type).toBe('call_logged');
      expect(loggedActivities[0].dealId).toBe('deal-1');
      expect(loggedActivities[0].description).toContain('Discovery Call with Principal');
      expect((loggedActivities[0].metadata as Record<string, unknown>)?.outcome).toBe('connected');
      expect((loggedActivities[0].metadata as Record<string, unknown>)?.durationMinutes).toBe(20);
    });

    it('logs scheduled meeting interaction with platform and attendees', async () => {
      mockDealsStore.set('deal-2', {
        id: 'deal-2',
        name: 'Horizon Institute Contract',
        workspaceId: 'ws-1',
        entityId: 'school-2',
      } as Deal);

      const interaction: DealInteractionData = {
        type: 'meeting',
        subject: 'Executive Demonstration',
        locationOrPlatform: 'Zoom',
        outcome: 'scheduled',
        durationMinutes: 45,
        recipientName: 'Board of Directors',
        description: 'Live demo of onboarding dashboard and finance integration.',
      };

      const res = await logDealInteractionAction('deal-2', interaction, 'user-1', 'ws-1');

      expect(res.success).toBe(true);
      expect(loggedActivities.length).toBe(1);
      expect(loggedActivities[0].type).toBe('meeting_completed');
      expect(loggedActivities[0].dealId).toBe('deal-2');
      expect((loggedActivities[0].metadata as Record<string, unknown>)?.locationOrPlatform).toBe('Zoom');
    });

    it('logs email interaction tagged to the deal', async () => {
      mockDealsStore.set('deal-3', {
        id: 'deal-3',
        name: 'Apex Academy Deal',
        workspaceId: 'ws-1',
      } as Deal);

      const interaction: DealInteractionData = {
        type: 'email',
        subject: 'Proposal & Commercial Quote #1042',
        recipientEmail: 'headmaster@apex.edu',
        description: 'Sent standard enterprise agreement for review.',
      };

      const res = await logDealInteractionAction('deal-3', interaction, 'user-1', 'ws-1');

      expect(res.success).toBe(true);
      expect(loggedActivities.length).toBe(1);
      expect(loggedActivities[0].type).toBe('email_sent');
      expect(loggedActivities[0].dealId).toBe('deal-3');
    });
  });
});
