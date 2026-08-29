import { describe, it, expect } from 'vitest';
import { DeepResearchDossierEngine } from '../research/DeepResearchDossierEngine';
import type { Prospect } from '../types';

describe('DeepResearchDossierEngine', () => {
  const mockProspectWithPaymentGap: Prospect = {
    id: 'prospect_ghana_sec_1',
    organizationId: 'org_test',
    workspaceId: 'ws_test',
    name: 'St. Augustine International Academy',
    domain: 'staugustine.edu.gh',
    address: 'Cape Coast, Central Region, Ghana',
    phone: '+233244112233',
    rating: 4.6,
    reviewsCount: 38,
    claimed: true,
    websiteScan: {
      url: 'https://staugustine.edu.gh',
      scannedAt: new Date().toISOString(),
      technologies: ['WordPress', 'WooCommerce', 'Admissions Portal'],
      sslValid: true,
      hasFacebook: true,
      hasInstagram: true,
      hasLinkedIn: false,
      hasTwitter: false,
      hasWhatsApp: false
    },
    contacts: [
      {
        name: 'Rev. Father Mensah',
        email: 'principal@staugustine.edu.gh',
        role: 'Headmaster / Principal',
        confidence: 95,
        verificationStatus: 'verified',
        deliverabilityScore: 95,
        mxProvider: 'google_workspace'
      },
      {
        name: 'Mrs. Cynthia Appiah',
        email: 'bursar@staugustine.edu.gh',
        role: 'Chief Bursar',
        confidence: 90,
        verificationStatus: 'verified',
        deliverabilityScore: 90,
        mxProvider: 'google_workspace'
      }
    ],
    scoring: {
      overallScore: 88,
      needScore: 90,
      digitalMaturity: 65,
      buyingIntent: 85,
      budgetProbability: 80,
      decisionMakerFound: 95,
      engagement: 75
    },
    syncStatus: 'unregistered',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  it('synthesizes a complete, structured AI Research Dossier', async () => {
    const dossier = await DeepResearchDossierEngine.generateDossier(mockProspectWithPaymentGap);

    expect(dossier.prospectId).toBe(mockProspectWithPaymentGap.id);
    expect(dossier.prospectName).toBe(mockProspectWithPaymentGap.name);
    expect(dossier.domain).toBe(mockProspectWithPaymentGap.domain);
    expect(typeof dossier.executiveSummary).toBe('string');
    expect(dossier.executiveSummary.length).toBeGreaterThan(30);

    // 4 Score Metrics (UI Spec Section 26)
    expect(dossier.icpFitScore).toBeGreaterThanOrEqual(60);
    expect(dossier.intentScore).toBeGreaterThanOrEqual(50);
    expect(dossier.priorityScore).toBeGreaterThanOrEqual(60);
    expect(dossier.digitalMaturityScore).toBeGreaterThanOrEqual(40);
  });

  it('detects payment gaps and recommends SmartSapp Enterprise tier with high ACV', async () => {
    const dossier = await DeepResearchDossierEngine.generateDossier(mockProspectWithPaymentGap);

    expect(dossier.commercialPackaging.recommendedTier).toContain('SmartSapp Enterprise');
    expect(dossier.commercialPackaging.estimatedAnnualValue).toBe(4800);
    expect(dossier.commercialPackaging.urgency).toBe('critical');
    expect(dossier.commercialPackaging.targetProductModules.length).toBeGreaterThan(2);

    const feePainPoint = dossier.painPoints.find(p => p.problem.includes('Fee Payment Gateway'));
    expect(feePainPoint).toBeDefined();
    expect(feePainPoint?.smartSappSolution).toContain('SmartSapp Automated Fee Gateway');
  });

  it('generates multi-channel outreach playbooks for Email, WhatsApp, and Cold Call', async () => {
    const dossier = await DeepResearchDossierEngine.generateDossier(mockProspectWithPaymentGap);

    expect(dossier.outreachPlaybook.length).toBe(3);

    const email = dossier.outreachPlaybook.find(p => p.channel === 'email');
    expect(email).toBeDefined();
    expect(email?.scriptOrMessage).toContain('Rev. Father Mensah');
    expect(email?.scriptOrMessage).toContain('staugustine.edu.gh');

    const whatsapp = dossier.outreachPlaybook.find(p => p.channel === 'whatsapp');
    expect(whatsapp).toBeDefined();
    expect(whatsapp?.scriptOrMessage).toContain('WhatsApp');

    const phone = dossier.outreachPlaybook.find(p => p.channel === 'phone_script');
    expect(phone).toBeDefined();
    expect(phone?.scriptOrMessage).toContain('Opening:');
  });

  it('constructs verifiable evidence grounding items linking claims to observed sources', async () => {
    const dossier = await DeepResearchDossierEngine.generateDossier(mockProspectWithPaymentGap);

    expect(dossier.evidenceGrounding.length).toBeGreaterThan(1);
    const firstEvidence = dossier.evidenceGrounding[0];
    expect(firstEvidence).toBeDefined();
    expect(firstEvidence?.confidencePercent).toBeGreaterThanOrEqual(70);
    expect(firstEvidence?.observedSource).toBeDefined();
    expect(firstEvidence?.claim).toBeDefined();
  });
});
