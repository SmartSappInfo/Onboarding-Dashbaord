import { describe, it, expect } from 'vitest';
import { ContinuousSignalMonitorService } from '../signals/ContinuousSignalMonitorService';
import type { Prospect } from '../types';

describe('ContinuousSignalMonitorService', () => {
  const baseProspect: Prospect = {
    id: 'prospect_gh_100',
    organizationId: 'org_test',
    workspaceId: 'ws_test',
    name: 'Prempeh International College',
    domain: 'prempehcollege.edu.gh',
    websiteScan: {
      url: 'https://prempehcollege.edu.gh',
      scannedAt: '2026-08-01T00:00:00.000Z',
      technologies: ['WordPress', 'Paystack', 'Google Analytics'],
      sslValid: true,
      hasFacebook: true,
      hasInstagram: true,
      hasLinkedIn: false,
      hasTwitter: false
    },
    contacts: [
      {
        name: 'Mr. Aaron Boateng',
        email: 'headmaster@prempehcollege.edu.gh',
        role: 'Headmaster',
        confidence: 90,
        verificationStatus: 'verified'
      }
    ],
    scoring: {
      overallScore: 80,
      needScore: 70,
      digitalMaturity: 80,
      buyingIntent: 75,
      budgetProbability: 80,
      decisionMakerFound: 90,
      engagement: 60
    },
    syncStatus: 'unregistered',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z'
  };

  it('detects a Critical Buying Intent signal when a payment gateway is removed', () => {
    const updatedProspect: Prospect = {
      ...baseProspect,
      websiteScan: {
        ...baseProspect.websiteScan!,
        technologies: ['WordPress', 'Google Analytics'], // Paystack removed
        scannedAt: '2026-08-29T00:00:00.000Z'
      },
      updatedAt: '2026-08-29T00:00:00.000Z'
    };

    const signals = ContinuousSignalMonitorService.detectDeltas(baseProspect, updatedProspect);

    expect(signals.length).toBeGreaterThan(0);
    const paymentSignal = signals.find(s => s.type === 'payment_gateway_removed');
    expect(paymentSignal).toBeDefined();
    expect(paymentSignal?.strength).toBe('critical');
    expect(paymentSignal?.scoreImpact).toBe(25);
    expect(paymentSignal?.category).toBe('intent');
    expect(paymentSignal?.previousValue).toContain('Paystack');
  });

  it('detects a Technology Change signal when a new subdomain portal is deployed', () => {
    const updatedProspect: Prospect = {
      ...baseProspect,
      websiteScan: {
        ...baseProspect.websiteScan!,
        technologies: ['WordPress', 'Paystack', 'moodle.prempehcollege.edu.gh'],
        scannedAt: '2026-08-29T00:00:00.000Z'
      },
      updatedAt: '2026-08-29T00:00:00.000Z'
    };

    const signals = ContinuousSignalMonitorService.detectDeltas(baseProspect, updatedProspect);

    const portalSignal = signals.find(s => s.type === 'subdomain_portal_detected');
    expect(portalSignal).toBeDefined();
    expect(portalSignal?.strength).toBe('high');
    expect(portalSignal?.category).toBe('technographic');
    expect(portalSignal?.scoreImpact).toBe(15);
  });

  it('detects a Leadership Change signal when a new key decision maker is identified', () => {
    const updatedProspect: Prospect = {
      ...baseProspect,
      contacts: [
        ...baseProspect.contacts,
        {
          name: 'Mrs. Janet Osei',
          email: 'bursar@prempehcollege.edu.gh',
          role: 'Chief Financial Officer / Bursar',
          confidence: 95,
          verificationStatus: 'verified'
        }
      ],
      updatedAt: '2026-08-29T00:00:00.000Z'
    };

    const signals = ContinuousSignalMonitorService.detectDeltas(baseProspect, updatedProspect);

    const contactSignal = signals.find(s => s.type === 'new_decision_maker');
    expect(contactSignal).toBeDefined();
    expect(contactSignal?.strength).toBe('high');
    expect(contactSignal?.category).toBe('leadership');
    expect(contactSignal?.currentValue).toContain('Mrs. Janet Osei');
  });

  it('detects a Compliance Alert when an SSL certificate becomes invalid or expired', () => {
    const updatedProspect: Prospect = {
      ...baseProspect,
      websiteScan: {
        ...baseProspect.websiteScan!,
        sslValid: false,
        scannedAt: '2026-08-29T00:00:00.000Z'
      },
      updatedAt: '2026-08-29T00:00:00.000Z'
    };

    const signals = ContinuousSignalMonitorService.detectDeltas(baseProspect, updatedProspect);

    const sslSignal = signals.find(s => s.type === 'ssl_expiring');
    expect(sslSignal).toBeDefined();
    expect(sslSignal?.strength).toBe('medium');
    expect(sslSignal?.category).toBe('compliance');
  });

  it('generates deterministic deduplication IDs for signals', () => {
    const id1 = ContinuousSignalMonitorService.generateSignalId('p1', 'payment_gap', 'admissions');
    const id2 = ContinuousSignalMonitorService.generateSignalId('p1', 'payment_gap', 'admissions');
    expect(id1).toBe(id2);
    expect(id1.startsWith('sig_p1_payment_gap_admissions')).toBe(true);
  });

  it('returns valid default account monitoring settings', () => {
    const config = ContinuousSignalMonitorService.getDefaultMonitoringConfig('p1', 'ws1');
    expect(config.prospectId).toBe('p1');
    expect(config.workspaceId).toBe('ws1');
    expect(config.status).toBe('healthy');
    expect(config.monitorWebsite).toBe(true);
    expect(config.monitorTechnology).toBe(true);
    expect(config.monitorDecisionMakers).toBe(true);
    expect(config.notifyInApp).toBe(true);
  });
});
