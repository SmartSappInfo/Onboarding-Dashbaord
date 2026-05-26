import { describe, it, expect } from 'vitest';
import {
  buildCampaignAutomationJobPayload,
  campaignAutomationJobDocId,
} from '../campaign-automation-jobs';

describe('campaign-automation-jobs', () => {
  it('builds entity-first payload with action field', () => {
    const payload = buildCampaignAutomationJobPayload({
      entityId: 'ent-1',
      workspaceId: 'ws-1',
      organizationId: 'org-1',
      campaignId: 'camp-1',
      campaignName: 'Welcome',
      event: 'campaign_opened',
      channel: 'email',
    });

    expect(payload).toMatchObject({
      entityId: 'ent-1',
      workspaceId: 'ws-1',
      organizationId: 'org-1',
      action: 'campaign_opened',
    });
  });

  it('produces stable idempotency doc ids', () => {
    const a = campaignAutomationJobDocId('c1', 'campaign_opened', 'auto-1', 'ent-1');
    const b = campaignAutomationJobDocId('c1', 'campaign_opened', 'auto-1', 'ent-1');
    const c = campaignAutomationJobDocId('c1', 'campaign_opened', 'auto-1', 'ent-2');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a.startsWith('cj_')).toBe(true);
  });
});
