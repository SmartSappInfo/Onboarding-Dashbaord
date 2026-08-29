import { describe, it, expect } from 'vitest';
import { TechnographicsCategorizer } from '../scraper/TechnographicsCategorizer';
import { SubdomainProberService } from '../scraper/SubdomainProberService';
import type { Prospect, SubdomainProbeResult } from '../types';

describe('TechnographicsCategorizer', () => {
  it('categorizes detected technologies into 5 structured dimensions', () => {
    const rawTechnologies = [
      'WordPress 6.4',
      'WooCommerce',
      'Paystack Gateway',
      'WhatsApp Click-to-Chat',
      'Google Tag Manager',
      'Meta Pixel'
    ];

    const mockPortals: SubdomainProbeResult[] = [
      {
        subdomain: 'portal',
        fullUrl: 'https://portal.myschool.edu.gh',
        status: 'online',
        httpStatus: 200,
        title: 'Student Portal Login',
        portalType: 'student_portal',
        latencyMs: 120,
        detectedAt: '2026-08-29T00:00:00.000Z'
      }
    ];

    const categorized = TechnographicsCategorizer.categorize(rawTechnologies, mockPortals);

    expect(categorized.cms).toContain('WordPress 6.4');
    expect(categorized.cms).toContain('WooCommerce');
    expect(categorized.payments).toContain('Paystack Gateway');
    expect(categorized.communication).toContain('WhatsApp Click-to-Chat');
    expect(categorized.analytics).toContain('Google Tag Manager');
    expect(categorized.analytics).toContain('Meta Pixel');
    expect(categorized.portals.length).toBe(1);
    expect(categorized.paymentGapDetected).toBe(false);
    expect(categorized.missingPortalDetected).toBe(false);
  });

  it('detects critical payment gap when commerce/admissions exist without payment gateways', () => {
    const rawTechnologies = [
      'WooCommerce Online Store',
      'Elementor',
      'Google Analytics'
    ];

    const categorized = TechnographicsCategorizer.categorize(rawTechnologies, []);

    expect(categorized.payments.length).toBe(0);
    expect(categorized.paymentGapDetected).toBe(true);
    expect(categorized.missingPortalDetected).toBe(true);
  });

  it('calculates 4-dimension enrichment scores accurately', () => {
    const mockProspect: Prospect = {
      id: 'pros_tech_123',
      workspaceId: 'ws_test',
      organizationId: 'org_test',
      name: 'Kumasi International Academy',
      domain: 'kumasiacademy.edu.gh',
      phone: '+233244112233',
      address: 'Kumasi, Ghana',
      claimed: true,
      syncStatus: 'unregistered',
      scoring: {
        overallScore: 85,
        needScore: 80,
        digitalMaturity: 70,
        buyingIntent: 90,
        budgetProbability: 75,
        decisionMakerFound: 90,
        engagement: 80
      },
      websiteScan: {
        scannedAt: '2026-08-29T00:00:00.000Z',
        technologies: ['WordPress', 'Paystack', 'Google Analytics'],
        sslValid: true,
        hasFacebook: true,
        hasInstagram: true,
        hasLinkedIn: false,
        hasTwitter: false
      },
      contacts: [
        {
          name: 'Mr. Kofi Boateng',
          email: 'principal@kumasiacademy.edu.gh',
          phone: '+233244112233',
          role: 'Principal',
          confidence: 95,
          verificationStatus: 'verified'
        }
      ],
      createdAt: '2026-08-29T00:00:00.000Z',
      updatedAt: '2026-08-29T00:00:00.000Z'
    };

    const dimensions = TechnographicsCategorizer.calculateEnrichmentDimensions(mockProspect);

    expect(dimensions.companyScore).toBe(100);
    expect(dimensions.techScore).toBeGreaterThanOrEqual(80);
    expect(dimensions.contactsScore).toBeGreaterThanOrEqual(75);
    expect(dimensions.verificationScore).toBe(100);
    expect(dimensions.overallEnrichmentPercent).toBeGreaterThanOrEqual(85);
  });
});

describe('SubdomainProberService', () => {
  it('rejects unsafe loopback / internal private hostnames safely', async () => {
    const results = await SubdomainProberService.probeDomain('127.0.0.1');
    expect(results).toEqual([]);

    const resultsLocal = await SubdomainProberService.probeDomain('localhost');
    expect(resultsLocal).toEqual([]);
  });
});
