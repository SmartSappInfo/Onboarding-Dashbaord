/**
 * CRM Intelligence & Unified Activity Timeline Service (Lead Intelligence 2.0 - Phase 9)
 * UI Spec Sections 37-39, PRD Sections 3.5 & 4.4, Idea Doc Sections 15 & 38-39
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. Proactive multi-factor match heuristics (Domain, Phone, Token Similarity) prevent duplicate CRM records.
 * 2. Non-destructive union merge strategy preserves existing CRM notes and custom rep numbers.
 * 3. Unified polymorphic activity feed combines cross-system event streams chronologically.
 * 4. Strict Zero-`any` typing.
 */

import type { 
  Prospect, 
  LeadSignal, 
  ScoreMovementEvent, 
  CRMMatchCandidate, 
  UnifiedActivityItem,
  CRMEnrichmentMergePayload 
} from '../types';
import type { Entity, WorkspaceEntity, EntityContact } from '@/lib/types';
import { canonicalizeDomain } from '../identity-resolver';

export class CRMIntelligenceService {
  /**
   * Evaluates a prospect against workspace entities to detect existing CRM records (UI Spec Section 38).
   */
  public static detectCRMMatches(
    prospect: Prospect,
    workspaceEntities: WorkspaceEntity[]
  ): CRMMatchCandidate[] {
    const candidates: CRMMatchCandidate[] = [];
    const prospectDomain = canonicalizeDomain(prospect.domain || '');
    const prospectPhoneDigits = (prospect.phone || '').replace(/\D/g, '');
    const prospectNameClean = this.normalizeEntityName(prospect.name || '');

    for (const we of workspaceEntities) {
      // 1. Domain match (Exact slug or contact email domain)
      const weDomain = canonicalizeDomain(we.displayName || '');
      const hasEmailDomainMatch = we.entityContacts?.some(c => 
        c.email && prospectDomain && canonicalizeDomain(c.email.split('@')[1] || '') === prospectDomain
      );

      if (prospectDomain && (weDomain === prospectDomain || hasEmailDomainMatch)) {
        candidates.push({
          entityId: we.entityId,
          entityName: we.displayName,
          entityType: we.entityType,
          matchScore: 98,
          matchedBy: 'domain',
          matchReason: `Exact domain match (${prospectDomain})`,
          ownerName: we.primaryContactName,
          stageName: we.workspaceTags?.includes('won') ? 'Closed Won' : 'Active Lead',
          lastActivityAt: we.updatedAt || we.addedAt,
          contactsCount: we.entityContacts?.length || 0,
          entityUrl: `/admin/entities?highlight=${we.entityId}`
        });
        continue;
      }

      // 2. Phone match (Exact digits >= 7 characters)
      const wePhoneDigits = (we.primaryPhone || '').replace(/\D/g, '');
      if (prospectPhoneDigits.length >= 7 && wePhoneDigits.length >= 7) {
        if (prospectPhoneDigits.endsWith(wePhoneDigits) || wePhoneDigits.endsWith(prospectPhoneDigits)) {
          candidates.push({
            entityId: we.entityId,
            entityName: we.displayName,
            entityType: we.entityType,
            matchScore: 95,
            matchedBy: 'phone',
            matchReason: `Verified telephone match (${prospect.phone})`,
            ownerName: we.primaryContactName,
            stageName: 'Active Lead',
            lastActivityAt: we.updatedAt || we.addedAt,
            contactsCount: we.entityContacts?.length || 0,
            entityUrl: `/admin/entities?highlight=${we.entityId}`
          });
          continue;
        }
      }

      // 3. Name Similarity match
      const weNameClean = this.normalizeEntityName(we.displayName || '');
      if (prospectNameClean && weNameClean) {
        const similarity = this.calculateNameSimilarity(prospectNameClean, weNameClean);
        if (similarity >= 0.75) {
          candidates.push({
            entityId: we.entityId,
            entityName: we.displayName,
            entityType: we.entityType,
            matchScore: Math.round(similarity * 100),
            matchedBy: 'name',
            matchReason: `Name similarity match (${Math.round(similarity * 100)}%)`,
            ownerName: we.primaryContactName,
            stageName: 'Active Lead',
            lastActivityAt: we.updatedAt || we.addedAt,
            contactsCount: we.entityContacts?.length || 0,
            entityUrl: `/admin/entities?highlight=${we.entityId}`
          });
        }
      }
    }

    return candidates.sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * Combines multi-source events into a single unified customer history (UI Spec Section 39).
   */
  public static buildUnifiedActivityTimeline(
    prospect: Prospect,
    signals: LeadSignal[] = [],
    scoreHistory: ScoreMovementEvent[] = [],
    crmActivities: Array<{ id: string; type: string; content: string; createdAt: string; userName?: string }> = []
  ): UnifiedActivityItem[] {
    const items: UnifiedActivityItem[] = [];

    // 1. Initial Discovery Event
    if (prospect.createdAt) {
      items.push({
        id: `act_disc_${prospect.id}`,
        timestamp: prospect.createdAt,
        source: 'intelligence',
        type: 'prospect_discovered',
        title: 'Prospect Discovered',
        description: `Discovered via ${prospect.source || 'Places API'} with initial rating & firmographics`,
        actorName: 'Lead Intelligence Radar',
        iconType: 'check'
      });
    }

    // 2. Technographic Scan Event
    if (prospect.websiteScan?.scannedAt) {
      items.push({
        id: `act_tech_${prospect.id}`,
        timestamp: prospect.websiteScan.scannedAt,
        source: 'intelligence',
        type: 'tech_audit_completed',
        title: 'Website Technology Audit Completed',
        description: `Identified ${prospect.websiteScan.technologies.length} technologies (${prospect.websiteScan.technologies.slice(0, 3).join(', ')})`,
        actorName: 'DOM Scanner',
        iconType: 'globe'
      });
    }

    // 3. AI Research Completed Event
    if (prospect.researchDossier?.researchedAt) {
      items.push({
        id: `act_dossier_${prospect.id}`,
        timestamp: prospect.researchDossier.researchedAt,
        source: 'ai',
        type: 'ai_research_completed',
        title: 'AI Research Dossier Synthesized',
        description: `Generated ICP diagnosis, root-cause pain points, and cold outreach playbooks`,
        actorName: 'SmartSapp AI Copilot',
        iconType: 'sparkles'
      });
    }

    // 4. Signals Events (Phase 7)
    for (const sig of signals) {
      items.push({
        id: `act_sig_${sig.id}`,
        timestamp: sig.detectedAt,
        source: 'signals',
        type: sig.type,
        title: sig.title,
        description: sig.headline,
        actorName: 'Intent Delta Monitor',
        iconType: sig.category === 'intent' ? 'flame' : 'activity',
        metadata: { scoreImpact: sig.scoreImpact, strength: sig.strength }
      });
    }

    // 5. Score History Events (Phase 8)
    for (const sh of scoreHistory) {
      items.push({
        id: `act_sh_${sh.id}`,
        timestamp: sh.timestamp,
        source: 'intelligence',
        type: 'score_adjusted',
        title: `Smart Score: ${sh.oldScore} → ${sh.newScore}`,
        description: sh.reason,
        actorName: 'Scoring Engine',
        iconType: 'activity',
        metadata: { change: sh.change }
      });
    }

    // 6. CRM Internal Activities
    for (const crm of crmActivities) {
      let iconType: UnifiedActivityItem['iconType'] = 'briefcase';
      if (crm.type.includes('email')) iconType = 'mail';
      else if (crm.type.includes('call')) iconType = 'phone';
      else if (crm.type.includes('deal')) iconType = 'briefcase';

      items.push({
        id: crm.id,
        timestamp: crm.createdAt,
        source: 'crm',
        type: crm.type,
        title: crm.type.replace(/_/g, ' ').toUpperCase(),
        description: crm.content,
        actorName: crm.userName || 'CRM User',
        iconType
      });
    }

    // Sort strictly descending by timestamp
    return items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Synthesizes a non-destructive enriched entity payload for existing CRM entities (UI Spec Section 38).
   */
  public static synthesizeEnrichedEntityPayload(
    prospect: Prospect,
    existingEntity: Entity,
    existingWorkspaceEntity: WorkspaceEntity,
    options: CRMEnrichmentMergePayload
  ): {
    updatedEntity: Entity;
    updatedWorkspaceEntity: WorkspaceEntity;
    newContactsAddedCount: number;
  } {
    const now = new Date().toISOString();
    const existingContacts = existingEntity.entityContacts || [];
    const existingEmails = new Set(existingContacts.map(c => (c.email || '').toLowerCase().trim()).filter(Boolean));
    const existingPhones = new Set(existingContacts.map(c => (c.phone || '').replace(/\D/g, '')).filter(Boolean));

    const newContactsToAppend: EntityContact[] = [];

    if (options.mergeContacts) {
      prospect.contacts.forEach((pc, idx) => {
        const cleanEmail = (pc.email || '').toLowerCase().trim();
        const cleanPhone = (pc.phone || '').replace(/\D/g, '');

        const isDuplicate = (cleanEmail && existingEmails.has(cleanEmail)) || 
                            (cleanPhone && existingPhones.has(cleanPhone));

        if (!isDuplicate) {
          newContactsToAppend.push({
            id: `contact_enrich_${Date.now()}_${idx}`,
            name: pc.name,
            email: pc.email || '',
            phone: pc.phone || '',
            typeKey: pc.role ? pc.role.toLowerCase().replace(/\s+/g, '_') : 'contact',
            typeLabel: pc.role || 'Contact',
            isPrimary: existingContacts.length === 0 && idx === 0,
            isSignatory: false,
            order: existingContacts.length + idx
          });
        }
      });
    }

    const mergedContacts = [...existingContacts, ...newContactsToAppend];

    // Tags union
    const existingTags = new Set(existingWorkspaceEntity.workspaceTags || []);
    existingTags.add('enriched-lead');
    existingTags.add('lead-intelligence-2.0');
    if (options.tagsToAdd) {
      options.tagsToAdd.forEach(t => existingTags.add(t));
    }

    const updatedEntity: Entity = {
      ...existingEntity,
      location: existingEntity.location || (prospect.address ? { locationString: prospect.address } : undefined),
      entityContacts: mergedContacts,
      updatedAt: now
    };

    const updatedWorkspaceEntity: WorkspaceEntity = {
      ...existingWorkspaceEntity,
      workspaceTags: Array.from(existingTags),
      primaryContactName: existingWorkspaceEntity.primaryContactName || mergedContacts[0]?.name,
      primaryEmail: existingWorkspaceEntity.primaryEmail || mergedContacts[0]?.email,
      primaryPhone: existingWorkspaceEntity.primaryPhone || mergedContacts[0]?.phone,
      entityContacts: mergedContacts,
      updatedAt: now
    };

    return {
      updatedEntity,
      updatedWorkspaceEntity,
      newContactsAddedCount: newContactsToAppend.length
    };
  }

  // --- Helper Methods ---

  private static normalizeEntityName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[\.,-\/#!$%\^&\*;:{}=\-_`~()]/g, '')
      .replace(/\b(international|school|academy|college|ghana|ltd|limited|inc|plc)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private static calculateNameSimilarity(a: string, b: string): number {
    if (a === b) return 1.0;
    if (!a || !b) return 0;
    if (a.includes(b) || b.includes(a)) return 0.85;

    const wordsA = new Set(a.split(' ').filter(w => w.length > 2));
    const wordsB = new Set(b.split(' ').filter(w => w.length > 2));

    if (wordsA.size === 0 || wordsB.size === 0) return 0;

    let overlap = 0;
    wordsA.forEach(w => {
      if (wordsB.has(w)) overlap++;
    });

    return overlap / Math.max(wordsA.size, wordsB.size);
  }
}
