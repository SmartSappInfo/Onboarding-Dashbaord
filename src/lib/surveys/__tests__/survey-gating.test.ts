import { describe, it, expect } from 'vitest';
import { isSurveyAcceptingSubmissions } from '../survey-gating';
import type { Survey } from '@/lib/types';
import type { SurveyDeployment } from '../survey-v2-types';

describe('Survey Quota & Schedule Gating Engine', () => {
  const baseSurvey: Partial<Survey> = {
    id: 'srv_1',
    status: 'published',
  };

  const baseDeployment: Partial<SurveyDeployment> = {
    id: 'dep_1',
    status: 'active',
  };

  it('allows submissions when survey and deployment are active and within limits', () => {
    const res = isSurveyAcceptingSubmissions(baseSurvey, baseDeployment, 10);
    expect(res.allowed).toBe(true);
  });

  it('blocks submissions when survey is not published', () => {
    const res = isSurveyAcceptingSubmissions({ ...baseSurvey, status: 'draft' }, baseDeployment, 0);
    expect(res.allowed).toBe(false);
    expect(res.reason).toBe('CLOSED');
  });

  it('blocks submissions when deployment is paused', () => {
    const res = isSurveyAcceptingSubmissions(baseSurvey, { ...baseDeployment, status: 'paused' }, 0);
    expect(res.allowed).toBe(false);
    expect(res.reason).toBe('PAUSED');
  });

  it('blocks submissions when schedule start date is in the future', () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString(); // Tomorrow
    const res = isSurveyAcceptingSubmissions(
      baseSurvey,
      {
        ...baseDeployment,
        scheduleConfig: { startDate: futureDate },
      },
      0
    );
    expect(res.allowed).toBe(false);
    expect(res.reason).toBe('SCHEDULED_FUTURE');
  });

  it('blocks submissions when schedule end date is in the past', () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString(); // Yesterday
    const res = isSurveyAcceptingSubmissions(
      baseSurvey,
      {
        ...baseDeployment,
        scheduleConfig: { endDate: pastDate, redirectUrlOnExpiry: 'https://myschool.com/closed' },
      },
      0
    );
    expect(res.allowed).toBe(false);
    expect(res.reason).toBe('EXPIRED_PAST');
    expect(res.redirectUrl).toBe('https://myschool.com/closed');
  });

  it('blocks submissions when response quota is exceeded', () => {
    const res = isSurveyAcceptingSubmissions(
      baseSurvey,
      {
        ...baseDeployment,
        quotaConfig: { maxResponses: 100, redirectUrlOnQuota: 'https://myschool.com/thanks' },
      },
      100 // At cap
    );
    expect(res.allowed).toBe(false);
    expect(res.reason).toBe('QUOTA_EXCEEDED');
    expect(res.maxResponses).toBe(100);
  });
});
