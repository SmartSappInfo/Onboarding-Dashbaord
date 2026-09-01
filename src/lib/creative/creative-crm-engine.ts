/**
 * ARCHITECTURE:
 * Creative CRM Dynamic Variable Resolution Engine (Phase 6 - CRM Integration)
 * 
 * Complies with Rule 1 (Fields & Variables Single Source of Truth).
 * Routes token resolution through the standardized resolveTextWithMap compiler
 * to personalize creative elements for specific CRM contacts, campaigns, and deals.
 * 
 * CAUTION:
 * Never use independent regex replace. Always delegate to resolveTextWithMap.
 * Clones element arrays to ensure immutability.
 * Strict typing (0% any / any[]).
 * 
 * TESTABILITY:
 * Verified via unit tests in src/lib/creative/__tests__/creative-crm.test.ts
 */

import type {
  CreativeElement,
  CrmContactPreview,
  CrmCampaignContext,
} from './creative-types';
import { resolveTextWithMap } from '../utils/variable-replacer';
import { normalizeCanvasElements } from './creative-ai-gateway';

/**
 * Builds a standardized Map of variable keys for a contact record.
 */
export function buildContactValuesMap(
  contact: CrmContactPreview,
  campaign?: CrmCampaignContext
): Map<string, unknown> {
  const map = new Map<string, unknown>();

  // Standard Contact Keys
  map.set('contact.first_name', contact.firstName);
  map.set('contact_first_name', contact.firstName);
  map.set('contact.last_name', contact.lastName);
  map.set('contact_last_name', contact.lastName);
  map.set('contact.name', `${contact.firstName} ${contact.lastName}`.trim());
  map.set('contact_name', `${contact.firstName} ${contact.lastName}`.trim());
  map.set('contact.email', contact.email);
  map.set('contact_email', contact.email);
  map.set('contact.phone', contact.phone || '');
  map.set('contact_phone', contact.phone || '');
  map.set('contact.company', contact.company || 'Your Business');
  map.set('contact_company', contact.company || 'Your Business');

  // Custom Fields
  if (contact.customFields) {
    for (const [k, v] of Object.entries(contact.customFields)) {
      map.set(`contact.${k}`, v);
      map.set(`custom.${k}`, v);
    }
  }

  // Campaign Keys
  if (campaign) {
    map.set('campaign.name', campaign.campaignName || 'Growth Masterclass');
    map.set('campaign_name', campaign.campaignName || 'Growth Masterclass');
    map.set('campaign.audience', campaign.targetAudience || 'Decision Makers');
    map.set('campaign.objective', campaign.objective || 'Lead Generation');
  }

  return map;
}

/**
 * Personalizes canvas elements for a specific CRM contact.
 * Scales down text if length exceeds threshold to avoid canvas overflow.
 */
export function resolveElementsForContact(
  elements: CreativeElement[],
  contact: CrmContactPreview,
  campaign?: CrmCampaignContext
): CreativeElement[] {
  const valuesMap = buildContactValuesMap(contact, campaign);

  const personalized = elements.map((el) => {
    // 1. Text Resolution
    if (el.type === 'text' && el.text) {
      const resolvedText = resolveTextWithMap(el.text, valuesMap, true);

      // Auto-scale font size if text grew significantly
      let fontSize = el.fontSize || 48;
      if (resolvedText.length > 25 && fontSize > 36) {
        fontSize = Math.max(28, Math.round(fontSize * 0.85));
      }

      return {
        ...el,
        text: resolvedText,
        fontSize,
      };
    }

    // 2. Contact Avatar Dynamic Replacement
    if (el.type === 'image' && el.semanticRole === 'subject' && contact.avatarUrl) {
      return {
        ...el,
        imageSrc: contact.avatarUrl,
      };
    }

    return el;
  });

  return normalizeCanvasElements(personalized);
}

/**
 * Sample fallback CRM campaigns for preview and testing.
 */
export const SAMPLE_CAMPAIGNS: CrmCampaignContext[] = [
  {
    campaignId: 'camp-q3-enrollment',
    campaignName: 'Q3 School Admissions Growth',
    targetAudience: 'Private School Principals & Founders',
    objective: 'lead_generation',
    segmentId: 'seg-schools-k12',
    segmentName: 'K-12 Decision Makers',
  },
  {
    campaignId: 'camp-saas-founders',
    campaignName: 'B2B Founder Outreach Q3',
    targetAudience: 'Seed & Series A Tech Founders',
    objective: 'sales_conversion',
    segmentId: 'seg-tech-founders',
    segmentName: 'SaaS CEOs',
  },
  {
    campaignId: 'camp-podcast-vip',
    campaignName: 'VIP Podcast Invitation Series',
    targetAudience: 'Top 1% Industry Operators',
    objective: 'event_attendance',
    segmentId: 'seg-podcast-guests',
    segmentName: 'Podcast Guest Prospects',
  },
];

/**
 * Sample fallback CRM contacts for live preview switcher.
 */
export const SAMPLE_CONTACTS: CrmContactPreview[] = [
  {
    id: 'ct-101',
    firstName: 'Sarah',
    lastName: 'Jenkins',
    email: 'sarah.jenkins@stmarys.edu',
    company: 'St. Mary’s Preparatory',
    phone: '+1 555-0192',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&auto=format&fit=crop&q=80',
  },
  {
    id: 'ct-102',
    firstName: 'Marcus',
    lastName: 'Vance',
    email: 'marcus@apexcloud.io',
    company: 'Apex Cloud Systems',
    phone: '+1 555-0144',
    avatarUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&auto=format&fit=crop&q=80',
  },
  {
    id: 'ct-103',
    firstName: 'Elena',
    lastName: 'Rostova',
    email: 'elena@novacapital.com',
    company: 'Nova Capital Partners',
    phone: '+1 555-0188',
    avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&auto=format&fit=crop&q=80',
  },
  {
    id: 'ct-104',
    firstName: 'David',
    lastName: 'Mensah',
    email: 'david.mensah@ghanafintech.org',
    company: 'Ghana Fintech Association',
    phone: '+233 24 123 4567',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
  },
];
