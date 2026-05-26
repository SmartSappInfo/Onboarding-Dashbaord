import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CAMPAIGN_HOOK_EVENT_TO_TRIGGER,
  resolveCampaignAutomationTrigger,
  dispatchCampaignBlueprintTriggers,
} from '../campaign-automation-dispatch';

const mockTriggerAutomationProtocols = vi.fn();

vi.mock('../automation-processor', () => ({
  triggerAutomationProtocols: (...args: unknown[]) => mockTriggerAutomationProtocols(...args),
}));

describe('campaign-automation-dispatch', () => {
  beforeEach(() => {
    mockTriggerAutomationProtocols.mockReset();
  });

  it('maps hook events to blueprint triggers', () => {
    expect(resolveCampaignAutomationTrigger('campaign_opened')).toBe('CAMPAIGN_OPENED');
    expect(CAMPAIGN_HOOK_EVENT_TO_TRIGGER.campaign_delivered).toBe('CAMPAIGN_DELIVERED');
  });

  it('dispatches orchestrator with exclude list', async () => {
    await dispatchCampaignBlueprintTriggers({
      hookEvent: 'campaign_clicked',
      payload: {
        workspaceId: 'ws-1',
        organizationId: 'org-1',
        entityId: 'ent-1',
        campaignId: 'camp-1',
      },
      excludeAutomationIds: ['auto-hook-bound'],
    });

    expect(mockTriggerAutomationProtocols).toHaveBeenCalledWith(
      'CAMPAIGN_CLICKED',
      expect.objectContaining({
        workspaceId: 'ws-1',
        entityId: 'ent-1',
        campaignId: 'camp-1',
      }),
      { excludeAutomationIds: ['auto-hook-bound'] }
    );
  });

  it('skips dispatch when workspaceId is missing', async () => {
    await dispatchCampaignBlueprintTriggers({
      hookEvent: 'campaign_opened',
      payload: { organizationId: 'org-1' },
    });
    expect(mockTriggerAutomationProtocols).not.toHaveBeenCalled();
  });
});
