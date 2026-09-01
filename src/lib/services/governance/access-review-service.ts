/**
 * @fileOverview Access Review & Certification Service (Governance 2.0)
 *
 * Manages periodic (Quarterly/Annual) and ad-hoc compliance certification campaigns,
 * reviewer queues, 1-click certify/revoke decisions, and automated privilege de-provisioning.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Creates review decisions in batches of <= 250 write operations.
 * - On revocation, immediately calls `IdentityProjectionService.syncUserProjection()`.
 * - Zero `any` or `any[]` typing.
 *
 * @testability Covered in `governance-services.test.ts`.
 */

import { adminDb } from '@/lib/firebase-admin';
import type {
  AccessReviewCampaign,
  AccessReviewDecision,
  AccessReviewFrequency,
  AccessReviewStatus,
  PersonDetailView,
} from '@/lib/types';
import { PersonService } from '@/lib/services/identity/person-service';
import { IdentityProjectionService } from '@/lib/services/identity/identity-projection-service';
import { SecurityAuditService } from './security-audit-service';

export class AccessReviewService {
  private static campaignsCollection = 'access_review_campaigns';
  private static decisionsCollection = 'access_review_decisions';

  /**
   * Creates an access review campaign and generates review decisions for all members and roles in safe chunks.
   */
  static async createCampaign(
    organizationId: string,
    payload: {
      title: string;
      description?: string;
      frequency: AccessReviewFrequency;
      reviewerRoleIds?: string[];
      reviewerPersonIds?: string[];
      dueDate: string;
      createdBy: string;
    }
  ): Promise<AccessReviewCampaign> {
    const campaignRef = adminDb.collection(this.campaignsCollection).doc();
    const now = new Date().toISOString();

    // 1. Fetch all members with assigned roles
    const people = await PersonService.getOrganizationPeopleDirectory(organizationId);

    // 2. Generate Review Decision Items
    const decisionsToCreate: Array<Omit<AccessReviewDecision, 'id'>> = [];

    for (const p of people) {
      const userRoles = p.userProfileProjection.roles || [];
      const roleNames = p.userProfileProjection.roleNames || [];

      for (let i = 0; i < userRoles.length; i++) {
        const roleId = userRoles[i];
        const roleName = roleNames[i] || roleId;

        decisionsToCreate.push({
          campaignId: campaignRef.id,
          organizationId,
          personId: p.person.id,
          personName: p.person.displayName || p.person.email,
          personEmail: p.person.email,
          roleId,
          roleName,
          decision: 'pending',
        });
      }
    }

    // 3. Batch commit decisions in chunks of <= 250 operations
    const CHUNK_SIZE = 250;
    for (let i = 0; i < decisionsToCreate.length; i += CHUNK_SIZE) {
      const chunk = decisionsToCreate.slice(i, i + CHUNK_SIZE);
      const batch = adminDb.batch();

      for (const item of chunk) {
        const decisionDoc = adminDb.collection(this.decisionsCollection).doc();
        batch.set(decisionDoc, { ...item, id: decisionDoc.id });
      }

      await batch.commit();
    }

    const campaign: AccessReviewCampaign = {
      id: campaignRef.id,
      organizationId,
      title: payload.title.trim(),
      description: payload.description?.trim(),
      frequency: payload.frequency,
      status: 'in_progress',
      reviewerRoleIds: payload.reviewerRoleIds,
      reviewerPersonIds: payload.reviewerPersonIds,
      totalItems: decisionsToCreate.length,
      reviewedItems: 0,
      certifiedCount: 0,
      revokedCount: 0,
      dueDate: payload.dueDate,
      createdAt: now,
    };

    await campaignRef.set(campaign);

    // Audit log
    await SecurityAuditService.logEvent(organizationId, {
      eventType: 'access_certified',
      actorId: payload.createdBy,
      actorName: 'Security Admin',
      targetId: campaign.id,
      targetName: campaign.title,
      description: `Launched access certification campaign '${campaign.title}' with ${decisionsToCreate.length} review items.`,
    });

    return campaign;
  }

  /**
   * Submits a certification or revocation decision for a specific member-role pair.
   */
  static async submitDecision(
    organizationId: string,
    decisionId: string,
    decision: 'certified' | 'revoked',
    justification: string | undefined,
    reviewerUid: string
  ): Promise<AccessReviewDecision> {
    const decisionRef = adminDb.collection(this.decisionsCollection).doc(decisionId);
    const snap = await decisionRef.get();

    if (!snap.exists) {
      throw new Error(`Review decision not found: ${decisionId}`);
    }

    const currentDecision = snap.data() as AccessReviewDecision;
    if (currentDecision.organizationId !== organizationId) {
      throw new Error('Tenant boundary mismatch');
    }

    const now = new Date().toISOString();
    const updatedDecision: AccessReviewDecision = {
      ...currentDecision,
      decision,
      justification: justification?.trim(),
      reviewedBy: reviewerUid,
      reviewedAt: now,
    };

    await decisionRef.set(updatedDecision, { merge: true });

    // If revoked, unbind role and sync projection
    if (decision === 'revoked') {
      await this.revokeMemberRole(organizationId, currentDecision.personId, currentDecision.roleId);
    }

    // Update Campaign counters
    await this.updateCampaignCounters(organizationId, currentDecision.campaignId);

    // Audit log
    await SecurityAuditService.logEvent(organizationId, {
      eventType: decision === 'certified' ? 'access_certified' : 'role_revoked',
      actorId: reviewerUid,
      actorName: 'Access Reviewer',
      targetId: currentDecision.personId,
      targetName: currentDecision.personName,
      description: `${decision === 'certified' ? 'Certified' : 'Revoked'} role '${currentDecision.roleName}' for ${currentDecision.personName}.`,
    });

    return updatedDecision;
  }

  /**
   * Revokes a role assignment from a member.
   */
  private static async revokeMemberRole(
    organizationId: string,
    personId: string,
    roleId: string
  ): Promise<void> {
    // 1. Remove from workspace memberships
    const wsMems = await adminDb
      .collection('workspace_memberships')
      .where('organizationId', '==', organizationId)
      .where('personId', '==', personId)
      .get();

    const batch = adminDb.batch();
    for (const doc of wsMems.docs) {
      const data = doc.data();
      const roles: string[] = data.roleAssignmentIds || [];
      if (roles.includes(roleId)) {
        batch.update(doc.ref, {
          roleAssignmentIds: roles.filter((r) => r !== roleId),
          updatedAt: new Date().toISOString(),
        });
      }
    }
    await batch.commit();

    // 2. Synchronize user projection
    await IdentityProjectionService.syncUserProjection(organizationId, personId);
  }

  /**
   * Recalculates campaign progress statistics.
   */
  private static async updateCampaignCounters(organizationId: string, campaignId: string): Promise<void> {
    const decisionsSnap = await adminDb
      .collection(this.decisionsCollection)
      .where('campaignId', '==', campaignId)
      .get();

    const decisions = decisionsSnap.docs.map((d) => d.data() as AccessReviewDecision);
    const reviewed = decisions.filter((d) => d.decision !== 'pending');
    const certified = decisions.filter((d) => d.decision === 'certified');
    const revoked = decisions.filter((d) => d.decision === 'revoked');

    const isCompleted = reviewed.length === decisions.length && decisions.length > 0;

    const campaignRef = adminDb.collection(this.campaignsCollection).doc(campaignId);
    await campaignRef.update({
      reviewedItems: reviewed.length,
      certifiedCount: certified.length,
      revokedCount: revoked.length,
      status: isCompleted ? 'completed' : 'in_progress',
      completedAt: isCompleted ? new Date().toISOString() : undefined,
    });
  }

  /**
   * Lists campaigns for an organization.
   */
  static async listCampaigns(
    organizationId: string,
    status?: AccessReviewStatus
  ): Promise<AccessReviewCampaign[]> {
    let q = adminDb.collection(this.campaignsCollection).where('organizationId', '==', organizationId);

    if (status) {
      q = q.where('status', '==', status);
    }

    const snap = await q.get();
    const campaigns = snap.docs.map((d) => d.data() as AccessReviewCampaign);
    return campaigns.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /**
   * Lists decisions for a specific campaign.
   */
  static async listDecisions(
    campaignId: string,
    decision?: AccessReviewDecision['decision']
  ): Promise<AccessReviewDecision[]> {
    let q = adminDb.collection(this.decisionsCollection).where('campaignId', '==', campaignId);

    if (decision) {
      q = q.where('decision', '==', decision);
    }

    const snap = await q.get();
    return snap.docs.map((d) => d.data() as AccessReviewDecision);
  }
}
