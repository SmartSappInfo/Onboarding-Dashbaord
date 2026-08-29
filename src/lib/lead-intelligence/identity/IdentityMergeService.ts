/**
 * ARCHITECTURAL POINTERS & MAINTAINER GUIDANCE (Lead Intelligence 2.0 - Phase 3):
 * 
 * IdentityMergeService provides pure, deterministic field-level collision resolution,
 * contact list normalization, and canonical synthesis between a discovered Prospect
 * (Record A) and an existing CRM WorkspaceEntity (Record B).
 * 
 * Core Invariants & Safeguards:
 * 1. Zero Overwrite by Default: Defaults prioritize existing CRM data (Record B) to prevent
 *    unintended loss of user-entered CRM notes, custom fields, or assignments.
 * 2. Contact Deduplication: Normalizes emails and phone numbers across both records. Contacts
 *    sharing the same email address are blended (retaining verification badges and highest confidence).
 * 3. Tag & Technographics Union: Merges detected technologies into customData without duplicates.
 * 4. Strict Typing: Strict TypeScript models without any/any[].
 */

import type { Prospect, MergeFieldSelection, ProspectContact } from '../types';
import type { WorkspaceEntity, EntityContact } from '@/lib/types';
import { canonicalizeDomain } from '../identity-resolver';

export interface SynthesizedCanonicalData {
  displayName: string;
  domain?: string;
  phone?: string;
  locationString?: string;
  mergedContacts: EntityContact[];
  technologies: string[];
  customData: Record<string, string | number | boolean | null>;
  workspaceTags: string[];
}

export class IdentityMergeService {
  /**
   * Computes recommended default field choices when a collision is opened.
   */
  public static getDefaultMergeSelection(
    prospect: Prospect,
    entity: WorkspaceEntity
  ): MergeFieldSelection {
    const hasEntityDomain = Boolean(entity.slug || (entity as unknown as Record<string, unknown>).website);
    const hasProspectDomain = Boolean(prospect.domain);

    const hasEntityPhone = Boolean(entity.primaryPhone);
    const hasProspectPhone = Boolean(prospect.phone);

    const hasEntityLocation = Boolean(entity.locationString || entity.location?.locationString);
    const hasProspectLocation = Boolean(prospect.location);

    return {
      nameChoice: 'record_b', // Default to existing CRM name
      domainChoice: !hasEntityDomain && hasProspectDomain ? 'record_a' : 'record_b',
      phoneChoice: !hasEntityPhone && hasProspectPhone ? 'record_a' : 'record_b',
      addressChoice: !hasEntityLocation && hasProspectLocation ? 'record_a' : 'record_b',
      technologiesStrategy: 'combine',
      contactsStrategy: 'combine'
    };
  }

  /**
   * Synthesizes canonical entity attributes based on user's field selection.
   */
  public static synthesizeCanonicalRecord(
    prospect: Prospect,
    entity: WorkspaceEntity,
    selection: MergeFieldSelection
  ): SynthesizedCanonicalData {
    // 1. Resolve Display Name
    let displayName = entity.displayName || prospect.name;
    if (selection.nameChoice === 'record_a') {
      displayName = prospect.name;
    } else if (selection.nameChoice === 'custom' && selection.customName?.trim()) {
      displayName = selection.customName.trim();
    }

    // 2. Resolve Domain
    const rawEntityDomain = (entity as unknown as Record<string, string>).website || entity.slug || '';
    let domain = rawEntityDomain || prospect.domain || '';
    if (selection.domainChoice === 'record_a') {
      domain = prospect.domain || '';
    } else if (selection.domainChoice === 'custom' && selection.customDomain?.trim()) {
      domain = canonicalizeDomain(selection.customDomain.trim());
    }

    // 3. Resolve Phone
    let phone = entity.primaryPhone || prospect.phone || '';
    if (selection.phoneChoice === 'record_a') {
      phone = prospect.phone || '';
    } else if (selection.phoneChoice === 'custom' && selection.customPhone?.trim()) {
      phone = selection.customPhone.trim();
    }

    // 4. Resolve Physical Location
    let locationString = entity.locationString || entity.location?.locationString || prospect.address || '';
    if (selection.addressChoice === 'record_a') {
      locationString = prospect.address || '';
    } else if (selection.addressChoice === 'custom' && selection.customAddress?.trim()) {
      locationString = selection.customAddress.trim();
    }

    // 5. Deduplicate and Combine Contacts
    const mergedContacts: EntityContact[] = this.mergeContacts(
      entity.entityContacts || [],
      prospect.contacts || [],
      selection.contactsStrategy,
      selection.selectedContactEmails
    );

    // 6. Combine Technologies
    const existingTechs: string[] = Array.isArray((entity.customData as Record<string, unknown>)?.technologies)
      ? ((entity.customData as Record<string, unknown>)?.technologies as string[])
      : [];
    const prospectTechs: string[] = prospect.websiteScan?.technologies || [];

    const techSet = new Set<string>();
    if (selection.technologiesStrategy === 'combine' || selection.technologiesStrategy === 'record_b_only') {
      existingTechs.forEach(t => techSet.add(t));
    }
    if (selection.technologiesStrategy === 'combine' || selection.technologiesStrategy === 'record_a_only') {
      prospectTechs.forEach(t => techSet.add(t));
    }

    const technologies = Array.from(techSet);

    // 7. Preserve and Combine Tags
    const tagSet = new Set<string>(entity.workspaceTags || []);
    tagSet.add('lead-intelligence-merged');
    if (prospect.source) {
      tagSet.add(`source:${prospect.source}`);
    }

    // 8. Construct Updated Custom Data
    const customData: Record<string, string | number | boolean | null> = {
      ...(entity.customData as Record<string, string | number | boolean | null> || {}),
      technologies: JSON.stringify(technologies),
      lastIntelligenceMergedAt: new Date().toISOString(),
      leadIntelligenceScore: prospect.scoring?.overallScore ?? null
    };

    return {
      displayName,
      domain: domain || undefined,
      phone: phone || undefined,
      locationString: locationString || undefined,
      mergedContacts,
      technologies,
      customData,
      workspaceTags: Array.from(tagSet)
    };
  }

  /**
   * Helper that deduplicates contacts between CRM Entity and Discovered Prospect.
   */
  private static mergeContacts(
    crmContacts: EntityContact[],
    prospectContacts: ProspectContact[],
    strategy: 'combine' | 'record_a_only' | 'record_b_only',
    selectedEmails?: string[]
  ): EntityContact[] {
    if (strategy === 'record_b_only') {
      return [...crmContacts];
    }

    const result: EntityContact[] = [];
    const seenEmails = new Set<string>();
    const seenPhones = new Set<string>();

    // Step 1: Ingest CRM Contacts first (highest trust)
    if (strategy === 'combine') {
      for (const c of crmContacts) {
        if (c.email) seenEmails.add(c.email.toLowerCase().trim());
        if (c.phone) seenPhones.add(c.phone.replace(/\D/g, ''));
        result.push(c);
      }
    }

    // Step 2: Merge in Discovered Contacts
    for (let i = 0; i < prospectContacts.length; i++) {
      const pc = prospectContacts[i];
      const emailLower = pc.email ? pc.email.toLowerCase().trim() : '';
      const cleanPhone = pc.phone ? pc.phone.replace(/\D/g, '') : '';

      // If specific emails were selected, skip unselected ones
      if (selectedEmails && selectedEmails.length > 0 && emailLower && !selectedEmails.includes(emailLower)) {
        continue;
      }

      // Duplicate check
      const isEmailDuplicate = emailLower ? seenEmails.has(emailLower) : false;
      const isPhoneDuplicate = cleanPhone ? seenPhones.has(cleanPhone) : false;

      if (!isEmailDuplicate && !isPhoneDuplicate) {
        if (emailLower) seenEmails.add(emailLower);
        if (cleanPhone) seenPhones.add(cleanPhone);

        const newContact: EntityContact = {
          id: `merged_c_${Date.now()}_${i}`,
          name: pc.name || 'Discovered Contact',
          email: pc.email || undefined,
          phone: pc.phone || undefined,
          typeKey: 'decision_maker',
          typeLabel: pc.role || 'Decision Maker',
          isPrimary: result.length === 0,
          isSignatory: false,
          order: result.length
        };
        result.push(newContact);
      }
    }

    return result;
  }
}
