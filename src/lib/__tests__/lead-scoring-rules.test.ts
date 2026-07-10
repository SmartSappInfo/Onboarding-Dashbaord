import { describe, it, expect } from 'vitest';
import { resolveEngagementRuleKey } from '../scoring-performance-engine';

describe('Lead Scoring Key Resolver Tests', () => {
  it('should resolve campaign email bounce event correctly', async () => {
    const key = await resolveEngagementRuleKey('campaign_event', {
      channel: 'email',
      event: 'failed',
      campaignId: 'c123'
    });
    expect(key).toBe('email_bounced');
  });

  it('should resolve campaign sms failure event correctly', async () => {
    const key = await resolveEngagementRuleKey('campaign_event', {
      channel: 'sms',
      event: 'failed',
      campaignId: 'c123'
    });
    expect(key).toBe('sms_failed');
  });

  it('should resolve campaign sms link click event correctly', async () => {
    const key = await resolveEngagementRuleKey('campaign_event', {
      channel: 'sms',
      event: 'clicked',
      campaignId: 'c123'
    });
    expect(key).toBe('sms_link_clicked');
  });

  it('should resolve webpage visited event correctly', async () => {
    const key = await resolveEngagementRuleKey('webpage_visited');
    expect(key).toBe('page_visited');
  });

  it('should resolve button clicked event correctly', async () => {
    const key = await resolveEngagementRuleKey('button_clicked');
    expect(key).toBe('button_clicked');
  });

  it('should resolve survey started event correctly', async () => {
    const key = await resolveEngagementRuleKey('survey_started');
    expect(key).toBe('survey_started');
  });

  it('should resolve survey completed event correctly', async () => {
    const key = await resolveEngagementRuleKey('form_submission');
    expect(key).toBe('survey_completed');
  });

  it('should resolve document signed event from pdf submit correctly', async () => {
    const key = await resolveEngagementRuleKey('pdf_form_submitted');
    expect(key).toBe('document_signed');
  });

  it('should fallback to eventType for general activities', async () => {
    const key = await resolveEngagementRuleKey('meeting_attended');
    expect(key).toBe('meeting_attended');
  });
});
