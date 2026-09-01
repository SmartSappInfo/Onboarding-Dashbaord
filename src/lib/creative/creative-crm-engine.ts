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
