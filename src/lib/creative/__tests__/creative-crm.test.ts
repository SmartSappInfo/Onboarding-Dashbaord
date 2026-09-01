import { describe, it, expect } from 'vitest';
import {
  buildContactValuesMap,
  resolveElementsForContact,
} from '../creative-crm-engine';
import type {
  CreativeElement,
  CrmContactPreview,
  CrmCampaignContext,
} from '../creative-types';

describe('Creative CRM & Dynamic Personalization Engine (Phase 6)', () => {
  const mockContact: CrmContactPreview = {
    id: 'ct-test-1',
    firstName: 'Marcus',
    lastName: 'Vance',
    email: 'marcus@apexcloud.io',
    company: 'Apex Cloud Systems',
    phone: '+1 555-0144',
    avatarUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a',
    customFields: {
      tier: 'Enterprise',
      industry: 'Technology',
    },
  };

  const mockCampaign: CrmCampaignContext = {
    campaignId: 'camp-1',
    campaignName: 'B2B Founder Growth Q3',
    targetAudience: 'SaaS CEOs',
    objective: 'sales_conversion',
  };

  it('should build standardized variable map from contact and campaign data', () => {
    const map = buildContactValuesMap(mockContact, mockCampaign);

    expect(map.get('contact.first_name')).toBe('Marcus');
    expect(map.get('contact.last_name')).toBe('Vance');
    expect(map.get('contact.company')).toBe('Apex Cloud Systems');
    expect(map.get('campaign.name')).toBe('B2B Founder Growth Q3');
    expect(map.get('contact.tier')).toBe('Enterprise');
  });

  it('should dynamically resolve text tokens for specific contacts', () => {
    const elements: CreativeElement[] = [
      {
        id: 'el-1',
        type: 'text',
        x: 10,
        y: 20,
        width: 80,
        height: 20,
        zIndex: 1,
        text: 'SPECIAL OFFER FOR {{contact.first_name}}',
        fontSize: 52,
        semanticRole: 'headline',
      },
      {
        id: 'el-2',
        type: 'text',
        x: 10,
        y: 50,
        width: 80,
        height: 15,
        zIndex: 2,
        text: 'Accelerate growth at {{contact.company}}',
        fontSize: 24,
        semanticRole: 'subtitle',
      },
    ];

    const resolved = resolveElementsForContact(elements, mockContact, mockCampaign);

    expect(resolved[0].text).toBe('SPECIAL OFFER FOR Marcus');
    expect(resolved[1].text).toBe('Accelerate growth at Apex Cloud Systems');
  });

  it('should dynamically inject contact avatar into subject image elements', () => {
    const elements: CreativeElement[] = [
      {
        id: 'img-1',
        type: 'image',
        x: 60,
        y: 20,
        width: 30,
        height: 30,
        zIndex: 1,
        imageSrc: 'https://placeholder.com/default-avatar.png',
        semanticRole: 'subject',
      },
    ];

    const resolved = resolveElementsForContact(elements, mockContact);
    expect(resolved[0].imageSrc).toBe(mockContact.avatarUrl);
  });

  it('should scale down text font size when resolved string exceeds threshold', () => {
    const longNameContact: CrmContactPreview = {
      id: 'ct-long',
      firstName: 'Alexander-Maximilian-Cornelius',
      lastName: 'Von-Hapsburg-Montgomery',
      email: 'alex@example.com',
      company: 'The International Global Logistics & Asset Management Consortium',
    };

    const elements: CreativeElement[] = [
      {
        id: 'el-1',
        type: 'text',
        x: 10,
        y: 20,
        width: 80,
        height: 20,
        zIndex: 1,
        text: 'WELCOME {{contact.first_name}}',
        fontSize: 54,
        semanticRole: 'headline',
      },
    ];

    const resolved = resolveElementsForContact(elements, longNameContact);
    expect(resolved[0].text).toContain('Alexander-Maximilian-Cornelius');
    // Font size should have auto-scaled down from 54 to prevent overflow
    expect(resolved[0].fontSize).toBeLessThan(54);
  });
});
