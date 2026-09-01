import { describe, it, expect } from 'vitest';
import {
  buildSurveyAttributionUrl,
  parseSurveyAttribution,
  generateTrackingToken,
  decodeTrackingToken,
  generateIframeEmbedSnippet,
  generateModalEmbedSnippet,
} from '../survey-attribution';

describe('Survey Attribution Engine', () => {
  it('builds canonical URL with UTM parameters and tracking ref', () => {
    const url = buildSurveyAttributionUrl('https://app.smartsapp.com', 'parent-feedback-2026', {
      utmSource: 'whatsapp',
      utmMedium: 'campaign',
      utmCampaign: 'wave_1',
      deploymentId: 'dep_123',
      trackingRef: 'ref_tok_456',
      kiosk: true,
      kioskReset: 15,
    });

    expect(url).toContain('/surveys/parent-feedback-2026');
    expect(url).toContain('utm_source=whatsapp');
    expect(url).toContain('utm_medium=campaign');
    expect(url).toContain('utm_campaign=wave_1');
    expect(url).toContain('dep=dep_123');
    expect(url).toContain('ref=ref_tok_456');
    expect(url).toContain('kiosk=true');
    expect(url).toContain('reset=15');
  });

  it('parses URL search parameters into structured attribution', () => {
    const searchParams = new URLSearchParams(
      '?utm_source=newsletter&utm_medium=email&utm_campaign=term_start&dep=dep_999&ref=tok_abc&embed=true&embedMode=drawer'
    );
    const parsed = parseSurveyAttribution(searchParams);

    expect(parsed.utmSource).toBe('newsletter');
    expect(parsed.utmMedium).toBe('email');
    expect(parsed.utmCampaign).toBe('term_start');
    expect(parsed.deploymentId).toBe('dep_999');
    expect(parsed.trackingRef).toBe('tok_abc');
    expect(parsed.embed).toBe(true);
    expect(parsed.embedMode).toBe('drawer');
  });

  it('encodes and decodes cryptographic tracking tokens safely', () => {
    const payload = {
      contactId: 'contact_456',
      entityId: 'school_789',
      workspaceId: 'ws_test',
      campaignId: 'cmp_101',
      timestamp: 1725177600000,
    };

    const token = generateTrackingToken(payload);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(10);

    const decoded = decodeTrackingToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.contactId).toBe('contact_456');
    expect(decoded?.entityId).toBe('school_789');
    expect(decoded?.workspaceId).toBe('ws_test');
    expect(decoded?.campaignId).toBe('cmp_101');
  });

  it('generates responsive iframe embed code with postMessage listener', () => {
    const snippet = generateIframeEmbedSnippet('https://app.smartsapp.com/surveys/annual-eval', 'Annual Evaluation');
    expect(snippet).toContain('SmartSapp Survey Responsive Embed');
    expect(snippet).toContain('title="Annual Evaluation"');
    expect(snippet).toContain('SURVEY_HEIGHT_CHANGED');
  });

  it('generates modal popup snippet with click trigger', () => {
    const snippet = generateModalEmbedSnippet('https://app.smartsapp.com/surveys/quick-poll', 'Give Feedback');
    expect(snippet).toContain('Give Feedback');
    expect(snippet).toContain('embedMode=popup');
  });
});
