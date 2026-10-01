/**
 * @fileOverview Deal domain core (agents_mcp PR-1 / N1, mirrors the task core of §1.1a).
 *
 * WHY THIS FILE IS NOT `'use server'`: every export of a `'use server'` module is a public HTTP
 * endpoint. These functions trust their `actor` argument, so they must only be reachable from
 * server code that has ALREADY established who is calling (the session wrappers in
 * `src/app/actions/deal-actions.ts`, the automation engine, the call centre engine, the MCP
 * gateway, form and survey pipelines). Never re-export them from a `'use server'` module.
 *
 * Permission model (no blanket bypass):
 * - `{ kind: 'user' }`    — a verified uid. Checked with `canUser(operations/pipeline/…)` against
 *                           the deal's STORED workspace (or the target workspace on create).
 * - `{ kind: 'service' }` — trusted server code. It must name the one workspace it acts in, and
 *                           every record it touches must belong to that workspace.
 *
 * The organization of a new deal comes from its workspace document, never from the caller.
 */

import { z } from 'zod';
import { adminDb } from '@/lib/firebase-admin';
import type { Deal, DealFocalContact, DealStageHistory, EntityType, OnboardingStage, WorkspaceEntity } from '@/lib/types';
import { logActivity } from '@/lib/activity-logger';
import { canUser } from '@/lib/workspace-permissions';
import { calculateExpectedCloseDate } from '@/app/admin/pipeline/utils/deal-expected-close';
import { emitDealDomainEvent } from '@/lib/deals/deal-event-bus';
import { validateStageTransition, resolveStageTerminalStatus } from '@/lib/deals/deal-stage-validation';

/** Trusted server subsystems that may act on deals without a signed-in user. */
export type CrmService = 'automations' | 'call-centre' | 'forms' | 'surveys' | 'deal-bulk-job' | 'imports' | 'api' | 'signup' | 'contact-adapter';

export type CrmActor =
  | { kind: 'user'; uid: string }
  | {
      kind: 'service';
      service: CrmService;
      /** The only workspace this service call may read or write. */
      workspaceId: string;
      /** The user the service is working for, if any. Used for attribution only, never for access. */
      onBehalfOf?: string;
    };

export type DealPermissionAction = 'create' | 'edit' | 'delete';

export type PermissionOutcome = { granted: true } | { granted: false; reason: string };

/** The uid written to audit fields (activity log, stage history), or null for pure system work. */
export function actorAttributionUid(actor: CrmActor): string | null {
  return actor.kind === 'user' ? actor.uid : actor.onBehalfOf ?? null;
}

/**
 * Can this actor perform `action` on deals of `workspaceId`?
 * A missing workspace id is always refused: `canUser` skips its workspace check without one.
 */
export async function checkPipelinePermission(
  actor: CrmActor,
  workspaceId: string | undefined | null,
  action: DealPermissionAction
): Promise<PermissionOutcome> {
  if (!workspaceId) return { granted: false, reason: 'Deal not found.' };
  if (actor.kind === 'service') {
    return actor.workspaceId === workspaceId
      ? { granted: true }
      : { granted: false, reason: 'Deal not found.' };
  }
  const permission = await canUser(actor.uid, 'operations', 'pipeline', action, workspaceId);
  return permission.granted ? { granted: true } : { granted: false, reason: permission.reason ?? 'Permission denied.' };
}

export type AuthorizedDeal =
  | { ok: true; deal: Deal; ref: FirebaseFirestore.DocumentReference }
  | { ok: false; error: string };

/**
 * Loads a deal and authorizes the actor against the deal's STORED workspace.
 * Callers must use the returned `deal`, never a workspace id supplied by the client.
 */
export async function loadAuthorizedDeal(
  actor: CrmActor,
  dealId: string,
  action: DealPermissionAction
): Promise<AuthorizedDeal> {
  if (!dealId) return { ok: false, error: 'Deal not found.' };
  const ref = adminDb.collection('deals').doc(dealId);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: 'Deal not found.' };
  const deal = snap.data() as Deal;
  const permission = await checkPipelinePermission(actor, deal.workspaceId, action);
  if (!permission.granted) return { ok: false, error: permission.reason };
  return { ok: true, deal, ref };
}

const WorkspaceOrgSchema = z.object({ organizationId: z.string().nullish().catch(undefined) });

/** The organization that owns a workspace, or null when the workspace document does not exist. */
export async function workspaceOrganizationId(workspaceId: string): Promise<string | null> {
  if (!workspaceId) return null;
  const snap = await adminDb.collection('workspaces').doc(workspaceId).get();
  if (!snap.exists) return null;
  const parsed = WorkspaceOrgSchema.safeParse(snap.data());
  return parsed.success ? parsed.data.organizationId ?? '' : '';
}

/**
 * SECURITY (FU-15): a deal may only reference a pipeline shared to its workspace, and a stage of
 * such a pipeline. Pipelines are shared through `workspaceIds` (the same field every pipeline
 * list in the UI queries), so this never rejects a pipeline the user could pick in the app.
 */
export async function checkPipelineInWorkspace(pipelineId: string, workspaceId: string): Promise<PermissionOutcome> {
  if (!pipelineId) return { granted: false, reason: 'Pipeline not found.' };
  const snap = await adminDb.collection('pipelines').doc(pipelineId).get();
  const shared: unknown = snap.exists ? snap.data()?.workspaceIds : undefined;
  return Array.isArray(shared) && shared.includes(workspaceId)
    ? { granted: true }
    : { granted: false, reason: 'Pipeline not found.' };
}

/**
 * The stage must exist and belong to a pipeline shared to the workspace. When `pipelineId` is
 * given, the stage must belong to exactly that pipeline.
 */
export async function checkStageInWorkspace(
  stageId: string,
  workspaceId: string,
  pipelineId?: string
): Promise<PermissionOutcome> {
  if (!stageId) return { granted: false, reason: 'Stage not found.' };
  const snap = await adminDb.collection('onboardingStages').doc(stageId).get();
  const stagePipelineId: unknown = snap.exists ? snap.data()?.pipelineId : undefined;
  if (typeof stagePipelineId !== 'string' || (pipelineId && stagePipelineId !== pipelineId)) {
    return { granted: false, reason: 'Stage not found.' };
  }
  const pipelineCheck = await checkPipelineInWorkspace(stagePipelineId, workspaceId);
  return pipelineCheck.granted ? pipelineCheck : { granted: false, reason: 'Stage not found.' };
}

/**
 * Checks a requested pipeline / stage change for a deal in `workspaceId`. Only the values the
 * caller asks to set are checked, so deals already pointing at legacy values keep working.
 */
export async function checkDealPlacement(
  workspaceId: string,
  placement: { pipelineId?: string | null; stageId?: string | null }
): Promise<PermissionOutcome> {
  const { pipelineId, stageId } = placement;
  if (pipelineId) {
    const pipelineCheck = await checkPipelineInWorkspace(pipelineId, workspaceId);
    if (!pipelineCheck.granted) return pipelineCheck;
  }
  if (stageId) return checkStageInWorkspace(stageId, workspaceId, pipelineId ?? undefined);
  return { granted: true };
}

async function resolveAssigneeDetails(userId: string): Promise<{ userId: string; name: string; email: string }> {
  try {
    const userSnap = await adminDb.collection('users').doc(userId).get();
    if (userSnap.exists) {
      const userData = userSnap.data();
      return {
        userId,
        name: userData?.name || 'Assigned User',
        email: userData?.email || '',
      };
    }
  } catch (e) {
    console.error('Failed to resolve assignee details:', e);
  }
  return { userId, name: 'Assigned User', email: '' };
}

/**
 * ARCHITECTURAL NOTE & CAUTION (Zero Double-Prefix Entity ID & Multi-Pattern Resolution - Rule 10):
 * Safely resolves a workspace entity record across 4 storage patterns:
 * 1. Composite key: `${workspaceId}_${cleanEntityId}`
 * 2. Direct key: `cleanEntityId`
 * 3. Query lookup: where('workspaceId', '==', workspaceId).where('entityId', '==', cleanEntityId)
 * 4. Canonical entities collection fallback: doc('entities', cleanEntityId)
 * Guarantees zero "Entity not found" false negatives during pipeline deal creation or contact mapping.
 *
 * SECURITY (N1): this used to be exported from a `'use server'` module, so anyone could read any
 * entity by id. It is a server-only helper now; callers must already be authorized for `workspaceId`.
 */
export async function resolveWorkspaceEntityRecord(
  workspaceId: string,
  entityId: string,
  organizationId: string = 'default'
): Promise<WorkspaceEntity | null> {
  if (!workspaceId || !entityId) return null;
  const cleanEntityId = entityId.startsWith(`${workspaceId}_`) ? entityId.slice(workspaceId.length + 1) : entityId;

  // Tier 1: Composite key
  const compositeSnap = await adminDb.collection('workspace_entities').doc(`${workspaceId}_${cleanEntityId}`).get();
  if (compositeSnap.exists) {
    const data = compositeSnap.data();
    if (!data?.workspaceId || data.workspaceId === workspaceId) {
      return { id: compositeSnap.id, ...data } as WorkspaceEntity;
    }
  }

  // Tier 2: Direct key with tenant boundary verification
  const directSnap = await adminDb.collection('workspace_entities').doc(cleanEntityId).get();
  if (directSnap.exists) {
    const data = directSnap.data();
    if (!data?.workspaceId || data.workspaceId === workspaceId) {
      return { id: directSnap.id, ...data } as WorkspaceEntity;
    }
  }

  // Tier 3: Query lookup (strictly scoped to workspaceId)
  const querySnap = await adminDb.collection('workspace_entities')
    .where('workspaceId', '==', workspaceId)
    .where('entityId', '==', cleanEntityId)
    .limit(1)
    .get();
  if (!querySnap.empty) {
    return { id: querySnap.docs[0].id, ...querySnap.docs[0].data() } as WorkspaceEntity;
  }

  // Tier 4: Canonical entities collection fallback with tenant ownership verification
  const entSnap = await adminDb.collection('entities').doc(cleanEntityId).get();
  if (entSnap.exists) {
    const rawEnt = entSnap.data() || {};
    const wsIds: string[] = Array.isArray(rawEnt.workspaceIds) ? rawEnt.workspaceIds : [];
    const isWsAllowed = wsIds.length === 0 || wsIds.includes(workspaceId);
    const isOrgAllowed = !rawEnt.organizationId || rawEnt.organizationId === organizationId || organizationId === 'default';

    if (isWsAllowed && isOrgAllowed) {
      const entType: EntityType = (rawEnt.entityType === 'family' || rawEnt.entityType === 'person') ? rawEnt.entityType : 'institution';
      return {
        id: entSnap.id,
        entityId: entSnap.id,
        entityType: entType,
        workspaceId,
        organizationId: rawEnt.organizationId || organizationId,
        displayName: String(rawEnt.name || rawEnt.displayName || ''),
        entityName: String(rawEnt.name || rawEnt.displayName || ''),
        primaryEmail: String(rawEnt.primaryEmail || rawEnt.email || ''),
        primaryPhone: String(rawEnt.primaryPhone || rawEnt.phone || ''),
        entityContacts: Array.isArray(rawEnt.entityContacts) ? rawEnt.entityContacts : [],
        workspaceTags: Array.isArray(rawEnt.workspaceTags) ? rawEnt.workspaceTags : [],
        assignedTo: rawEnt.assignedTo || null,
        status: rawEnt.status === 'archived' ? 'archived' : 'active',
        addedAt: String(rawEnt.addedAt || rawEnt.createdAt || new Date().toISOString()),
        updatedAt: String(rawEnt.updatedAt || new Date().toISOString()),
      };
    }
  }

  return null;
}

export type AssignmentStrategy = 'direct' | 'round-robin' | 'value-based' | 'unassigned';

export interface DealCreationData extends Partial<Deal> {
  entityId: string;
  workspaceId: string;
  /**
   * Ignored when the workspace document exists (the workspace's organization wins). Only a trusted
   * service writing into a legacy workspace id without a document falls back to this value.
   */
  organizationId?: string;
  pipelineId: string;
  name: string;
  value?: number;
  assignmentStrategy?: AssignmentStrategy;
  eligibleUserIds?: string[];
  suppressAutomations?: boolean;
}

export async function createDealCore(actor: CrmActor, data: DealCreationData): Promise<{ id?: string; error?: string }> {
  try {
    const { entityId, workspaceId, organizationId: suppliedOrganizationId, pipelineId, name, value, assignmentStrategy, eligibleUserIds = [], suppressAutomations = false, ...rest } = data;

    const permission = await checkPipelinePermission(actor, workspaceId, 'create');
    if (!permission.granted) return { error: permission.reason };

    // SECURITY (N1): the deal's organization is its workspace's organization, never the caller's.
    const fromWorkspace = await workspaceOrganizationId(workspaceId);
    if (fromWorkspace === null && actor.kind === 'user') return { error: 'Workspace not found.' };
    const organizationId = fromWorkspace ?? suppliedOrganizationId ?? '';

    const pipelineCheck = await checkPipelineInWorkspace(pipelineId, workspaceId);
    if (!pipelineCheck.granted) return { error: pipelineCheck.reason };
    if (data.stageId) {
      const stageCheck = await checkStageInWorkspace(data.stageId, workspaceId, pipelineId);
      if (!stageCheck.granted) return { error: stageCheck.reason };
    }

    const cleanEntityId = entityId.startsWith(`${workspaceId}_`) ? entityId.slice(workspaceId.length + 1) : entityId;
    const pipelineRef = adminDb.collection('pipelines').doc(pipelineId);

    let stageSnap: FirebaseFirestore.DocumentSnapshot | FirebaseFirestore.QuerySnapshot | null = null;
    if (!data.stageId) {
      stageSnap = await adminDb.collection('onboardingStages').where('pipelineId', '==', pipelineId).orderBy('order', 'asc').limit(1).get();
    } else if (!data.stageName) {
      stageSnap = await adminDb.collection('onboardingStages').doc(data.stageId).get();
    }

    const [entity, pipelineSnap] = await Promise.all([
      resolveWorkspaceEntityRecord(workspaceId, cleanEntityId, organizationId || 'default'),
      pipelineRef.get(),
    ]);

    if (!entity) throw new Error('Entity not found');

    const pipeline = pipelineSnap.exists ? pipelineSnap.data() : null;

    // Resolve final strategy and eligible assignees
    const activeStrategy = assignmentStrategy || pipeline?.assignmentStrategy || 'direct';
    const activeEligibleUserIds = eligibleUserIds.length > 0
      ? eligibleUserIds
      : (pipeline?.assignmentUserIds || []);

    let assignedTo = null;

    if (activeStrategy === 'direct') {
      assignedTo = entity.assignedTo || null;
    } else if (activeStrategy === 'round-robin' && activeEligibleUserIds.length > 0) {
      let minDeals = Infinity;
      let selectedUserId = activeEligibleUserIds[0];

      for (const uid of activeEligibleUserIds) {
        const snap = await adminDb.collection('deals').where('assignedTo.userId', '==', uid).where('status', '==', 'open').get();
        if (snap.size < minDeals) {
          minDeals = snap.size;
          selectedUserId = uid;
        }
      }
      assignedTo = await resolveAssigneeDetails(selectedUserId);
    } else if (activeStrategy === 'value-based' && activeEligibleUserIds.length > 0) {
      let minVal = Infinity;
      let selectedUserId = activeEligibleUserIds[0];

      for (const uid of activeEligibleUserIds) {
        const snap = await adminDb.collection('deals').where('assignedTo.userId', '==', uid).where('status', '==', 'open').get();
        let totalValue = 0;
        snap.forEach(doc => totalValue += (doc.data().value || 0));

        if (totalValue < minVal) {
          minVal = totalValue;
          selectedUserId = uid;
        }
      }
      assignedTo = await resolveAssigneeDetails(selectedUserId);
    } else if (activeStrategy === 'unassigned') {
      assignedTo = null;
    }

    let stageId = data.stageId;
    let stageName = data.stageName;

    if (stageSnap) {
      if (!stageId && 'docs' in stageSnap) {
        stageId = stageSnap.empty ? 'default_stage' : stageSnap.docs[0].id;
        stageName = stageSnap.empty ? undefined : (stageSnap.docs[0].data()?.name as string | undefined);
      } else if (!stageName && 'exists' in stageSnap && stageSnap.exists) {
        stageName = (stageSnap.data() as { name?: string } | undefined)?.name;
      }
    }

    const calculatedCloseDate = calculateExpectedCloseDate(
      pipeline,
      rest.expectedCloseDate
    );

    // ARCHITECTURAL NOTE & CAUTION: Contact Resolution for Deals
    // If focalContacts is not explicitly passed, automatically populate primary contact from entity
    // so pipeline cards display contact avatar/initials badges (Requirement 10 & 18).
    let resolvedFocalContacts: DealFocalContact[] = data.focalContacts ?? [];
    const legacyFocal = ((entity as unknown as Record<string, unknown>).focalContacts as Array<Record<string, string>> | undefined) || [];
    if (resolvedFocalContacts.length === 0 && entity.entityContacts && entity.entityContacts.length > 0) {
      const primary = entity.entityContacts.find(c => c.isPrimary) || entity.entityContacts[0];
      resolvedFocalContacts = [{
        id: primary.id,
        name: primary.name,
        role: primary.typeLabel || undefined,
        email: primary.email || undefined,
        phone: primary.phone || undefined,
      }];
    } else if (resolvedFocalContacts.length === 0 && legacyFocal.length > 0) {
      const legacy = legacyFocal[0];
      resolvedFocalContacts = [{
        id: legacy.id || 'contact_1',
        name: legacy.name || 'Contact',
        role: legacy.role || legacy.typeLabel || undefined,
        email: legacy.email || undefined,
        phone: legacy.phone || undefined,
      }];
    }

    // ARCHITECTURAL POINTER:
    // Automatically sanitize deal names: strip legacy 'Deal for ' / 'Deal For ' prefix
    let cleanDealName = (name || '').trim();
    if (/^deal\s+for\s+/i.test(cleanDealName)) {
      cleanDealName = cleanDealName.replace(/^deal\s+for\s+/i, '').trim();
    }
    if (!cleanDealName && entity) {
      cleanDealName = entity.displayName || (entity as unknown as Record<string, string>).name || 'Deal';
    }

    const resolvedDefaultDealValue = typeof pipeline?.defaultDealValue === 'number' && !Number.isNaN(pipeline.defaultDealValue)
      ? Math.max(0, pipeline.defaultDealValue)
      : 0;
    const resolvedValue = typeof value === 'number' && !Number.isNaN(value) && value > 0
      ? value
      : resolvedDefaultDealValue;

    const newDeal: Omit<Deal, 'id'> = {
      organizationId,
      workspaceId,
      entityId: cleanEntityId,
      pipelineId,
      stageId: stageId || 'default_stage',
      ...(stageName ? { stageName } : {}),
      name: cleanDealName,
      value: resolvedValue,
      status: data.status || 'open',
      assignedTo: data.assignedTo !== undefined ? data.assignedTo : assignedTo,
      expectedCloseDate: calculatedCloseDate,
      description: rest.description || null,
      focalContacts: resolvedFocalContacts,
      customFields: rest.customFields || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const docRef = await adminDb.collection('deals').add(newDeal);

    if (!suppressAutomations) {
      emitDealDomainEvent('deal.created', {
        dealId: docRef.id,
        dealName: cleanDealName,
        workspaceId,
        organizationId,
        entityId: cleanEntityId,
        pipelineId,
        stageId: stageId || 'default_stage',
        status: data.status || 'open',
        value: newDeal.value || 0,
        assignedTo: newDeal.assignedTo,
      });
    }

    return { id: docRef.id };
  } catch (e: unknown) {
    console.error('Failed to create deal:', e);
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export interface UpdateDealStageOptions {
  status?: 'open' | 'won' | 'lost' | 'cancelled';
  lostReason?: string;
  reason?: string;
  bypassValidation?: boolean;
}

export async function updateDealStageCore(
  actor: CrmActor,
  dealId: string,
  stageId: string,
  options: UpdateDealStageOptions = {}
): Promise<{ success: boolean; error?: string }> {
  try {
    const opts: UpdateDealStageOptions = { ...options };
    if (opts.reason && !opts.lostReason) {
      opts.lostReason = opts.reason;
    }

    // SECURITY (N1): always checked. It used to run only when the caller chose to pass a userId.
    const loaded = await loadAuthorizedDeal(actor, dealId, 'edit');
    if (!loaded.ok) return { success: false, error: loaded.error };
    const { deal, ref: dealRef } = loaded;
    const actorUid = actorAttributionUid(actor);

    // The target stage must belong to a pipeline shared to the deal's workspace (FU-15).
    const stageCheck = await checkStageInWorkspace(stageId, deal.workspaceId);
    if (!stageCheck.granted) return { success: false, error: stageCheck.reason };
    const stageSnap = await adminDb.collection('onboardingStages').doc(stageId).get();
    const targetStage = stageSnap.data() as OnboardingStage;
    const stageName = targetStage?.name || stageId;

    // ARCHITECTURAL POINTER (Phase 2 — Entry Gate Validation):
    // Validate required fields before advancing stage unless explicitly bypassed
    if (!opts.bypassValidation) {
      const validation = validateStageTransition(deal, targetStage);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.message || `Deal does not meet the entry requirements for "${stageName}".`,
        };
      }
    }

    const oldStageName = deal.stageName || deal.stageId;
    const oldStageId = deal.stageId;

    const timestamp = new Date().toISOString();

    // Calculate duration spent in the stage being exited
    const lastEntered = deal.stageEnteredAt || deal.createdAt || timestamp;
    const lastEnteredTime = new Date(lastEntered).getTime();
    const durationSeconds = !isNaN(lastEnteredTime) ? Math.max(0, Math.floor((new Date(timestamp).getTime() - lastEnteredTime) / 1000)) : 0;

    const previousHistory = Array.isArray(deal.stageHistory) ? deal.stageHistory : [];
    const updatedHistory: DealStageHistory[] = oldStageId !== stageId ? [
      ...previousHistory,
      {
        stageId: oldStageId,
        stageName: oldStageName,
        enteredAt: lastEntered,
        exitedAt: timestamp,
        durationSeconds,
        changedByUserId: actorUid || 'system',
        notes: opts.lostReason || undefined
      }
    ] : previousHistory;

    // Automated Terminal State Resolution (PRD Section 14)
    let resolvedStatus: 'open' | 'won' | 'lost' | 'cancelled' = opts.status || deal.status || 'open';
    if (!opts.status) {
      const autoStatus = resolveStageTerminalStatus(targetStage);
      if (autoStatus === 'won' || autoStatus === 'lost') {
        resolvedStatus = autoStatus;
      } else if (deal.status === 'won' || deal.status === 'lost') {
        resolvedStatus = 'open';
      }
    }

    const updatePayload: Record<string, unknown> = {
      stageId,
      stageName,
      stageEnteredAt: oldStageId !== stageId ? timestamp : (deal.stageEnteredAt || timestamp),
      stageHistory: updatedHistory,
      status: resolvedStatus,
      updatedAt: timestamp
    };

    // Sync stage win probability if configured and moving to a new stage
    if (typeof targetStage.probability === 'number' && (deal.probability == null || deal.probability === 0 || oldStageId !== stageId)) {
      updatePayload.probability = targetStage.probability;
    }

    if (resolvedStatus === 'lost' && opts.lostReason) {
      updatePayload.lostReason = opts.lostReason;
    }

    await dealRef.update(updatePayload);

    // ARCHITECTURAL POINTER:
    // Broadcast stage change signal to Activity Log & trigger stage-scoped automations.
    await logActivity({
      organizationId: deal.organizationId,
      entityId: deal.entityId,
      userId: actorUid,
      workspaceId: deal.workspaceId,
      type: opts.status === 'lost' ? 'deal_lost' : (opts.status === 'won' ? 'deal_won' : 'deal_stage_changed'),
      source: actor.kind === 'user' ? 'user' : 'system',
      description: opts.status === 'lost'
        ? `marked deal "${deal.name}" as lost in "${stageName}"${opts.lostReason ? ` (${opts.lostReason})` : ''}`
        : (opts.status === 'won'
          ? `won deal "${deal.name}" in "${stageName}"`
          : `progressed deal "${deal.name}" from "${oldStageName}" to "${stageName}"`),
      metadata: {
        dealId,
        from: oldStageName,
        to: stageName,
        stageId,
        pipelineId: deal.pipelineId,
        status: opts.status || deal.status,
        lostReason: opts.lostReason
      }
    });

    // Emit Domain Events via Event Bus
    emitDealDomainEvent('deal.stage.changed', {
      dealId,
      dealName: deal.name,
      workspaceId: deal.workspaceId,
      organizationId: deal.organizationId,
      entityId: deal.entityId,
      pipelineId: deal.pipelineId,
      stageId,
      previousStageId: oldStageId,
      status: (opts.status === 'won' || opts.status === 'lost' ? opts.status : (deal.status || 'open')),
      value: deal.value || 0,
      assignedTo: deal.assignedTo,
      lostReason: opts.lostReason || null,
    });

    if (opts.status === 'won') {
      emitDealDomainEvent('deal.won', {
        dealId,
        dealName: deal.name,
        workspaceId: deal.workspaceId,
        organizationId: deal.organizationId,
        entityId: deal.entityId,
        pipelineId: deal.pipelineId,
        stageId,
        status: 'won',
        value: deal.value || 0,
        assignedTo: deal.assignedTo,
      });
    } else if (opts.status === 'lost') {
      emitDealDomainEvent('deal.lost', {
        dealId,
        dealName: deal.name,
        workspaceId: deal.workspaceId,
        organizationId: deal.organizationId,
        entityId: deal.entityId,
        pipelineId: deal.pipelineId,
        stageId,
        status: 'lost',
        value: deal.value || 0,
        assignedTo: deal.assignedTo,
        lostReason: opts.lostReason || null,
      });
    }

    return { success: true };
  } catch (e: unknown) {
    console.error('Failed to update deal stage:', e);
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function updateDealValueCore(
  actor: CrmActor,
  dealId: string,
  value: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const loaded = await loadAuthorizedDeal(actor, dealId, 'edit');
    if (!loaded.ok) return { success: false, error: loaded.error };
    const { deal, ref: dealRef } = loaded;

    const oldVal = deal.value || 0;
    if (oldVal === value) return { success: true };

    const timestamp = new Date().toISOString();
    await dealRef.update({
      value,
      updatedAt: timestamp
    });

    await logActivity({
      organizationId: deal.organizationId,
      entityId: deal.entityId,
      userId: actorAttributionUid(actor),
      workspaceId: deal.workspaceId,
      type: 'deal_value_changed',
      source: actor.kind === 'user' ? 'user' : 'system',
      description: `updated deal "${deal.name}" value from $${oldVal} to $${value}`,
      metadata: { dealId, fromValue: oldVal, toValue: value }
    });

    emitDealDomainEvent('deal.value.changed', {
      dealId,
      dealName: deal.name,
      workspaceId: deal.workspaceId,
      organizationId: deal.organizationId,
      entityId: deal.entityId,
      pipelineId: deal.pipelineId,
      stageId: deal.stageId,
      value,
      previousValue: oldVal,
      status: deal.status,
      assignedTo: deal.assignedTo,
    });

    return { success: true };
  } catch (e: unknown) {
    console.error('Failed to update deal value:', e);
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function updateDealStatusCore(
  actor: CrmActor,
  dealId: string,
  status: 'open' | 'won' | 'lost',
  lostReason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const loaded = await loadAuthorizedDeal(actor, dealId, 'edit');
    if (!loaded.ok) return { success: false, error: loaded.error };
    const { deal, ref: dealRef } = loaded;

    const oldStatus = deal.status || 'open';
    const finalLostReason = status === 'lost' ? (lostReason || 'Not Specified') : null;
    if (oldStatus === status && (status !== 'lost' || deal.lostReason === finalLostReason)) {
      return { success: true };
    }

    const timestamp = new Date().toISOString();
    await dealRef.update({
      status,
      lostReason: finalLostReason,
      updatedAt: timestamp
    });

    await logActivity({
      organizationId: deal.organizationId,
      entityId: deal.entityId,
      userId: actorAttributionUid(actor),
      workspaceId: deal.workspaceId,
      type: 'deal_status_changed',
      source: actor.kind === 'user' ? 'user' : 'system',
      description: status === 'lost'
        ? `marked deal "${deal.name}" as CLOSED LOST: ${finalLostReason}`
        : `marked deal "${deal.name}" as ${status.toUpperCase()}`,
      metadata: {
        dealId,
        fromStatus: oldStatus,
        toStatus: status,
        value: deal.value || 0,
        pipelineId: deal.pipelineId,
        lostReason: finalLostReason
      }
    });

    emitDealDomainEvent('deal.status.changed', {
      dealId,
      dealName: deal.name,
      workspaceId: deal.workspaceId,
      organizationId: deal.organizationId,
      entityId: deal.entityId,
      pipelineId: deal.pipelineId,
      stageId: deal.stageId,
      status,
      previousStatus: oldStatus,
      value: deal.value || 0,
      assignedTo: deal.assignedTo,
      lostReason: finalLostReason,
    });

    if (status === 'won') {
      emitDealDomainEvent('deal.won', {
        dealId,
        dealName: deal.name,
        workspaceId: deal.workspaceId,
        organizationId: deal.organizationId,
        entityId: deal.entityId,
        pipelineId: deal.pipelineId,
        stageId: deal.stageId,
        status: 'won',
        value: deal.value || 0,
        assignedTo: deal.assignedTo,
      });
    } else if (status === 'lost') {
      emitDealDomainEvent('deal.lost', {
        dealId,
        dealName: deal.name,
        workspaceId: deal.workspaceId,
        organizationId: deal.organizationId,
        entityId: deal.entityId,
        pipelineId: deal.pipelineId,
        stageId: deal.stageId,
        status: 'lost',
        value: deal.value || 0,
        assignedTo: deal.assignedTo,
        lostReason: finalLostReason,
      });
    }

    return { success: true };
  } catch (e: unknown) {
    console.error('Failed to update deal status:', e);
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function updateDealOwnerCore(
  actor: CrmActor,
  dealId: string,
  userId: string | null,
  userName: string | null,
  userEmail: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const loaded = await loadAuthorizedDeal(actor, dealId, 'edit');
    if (!loaded.ok) return { success: false, error: loaded.error };
    const { deal, ref: dealRef } = loaded;

    const assignedTo = userId ? { userId, name: userName, email: userEmail } : null;

    const timestamp = new Date().toISOString();
    await dealRef.update({
      assignedTo,
      updatedAt: timestamp
    });

    emitDealDomainEvent('deal.owner.changed', {
      dealId,
      dealName: deal.name,
      workspaceId: deal.workspaceId,
      organizationId: deal.organizationId,
      entityId: deal.entityId,
      pipelineId: deal.pipelineId,
      stageId: deal.stageId,
      status: deal.status,
      value: deal.value || 0,
      assignedTo,
    });

    await logActivity({
      organizationId: deal.organizationId,
      entityId: deal.entityId,
      userId: actorAttributionUid(actor),
      workspaceId: deal.workspaceId,
      type: 'deal_owner_changed',
      source: actor.kind === 'user' ? 'user' : 'system',
      description: `reassigned deal "${deal.name}" to ${userName || 'Unassigned'}`,
      metadata: { dealId, ownerId: userId, ownerName: userName }
    });

    return { success: true };
  } catch (e: unknown) {
    console.error('Failed to update deal owner:', e);
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}
