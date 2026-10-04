/**
 * @fileOverview Multi-Tenant Workflow Dead-Letter Queue (DLQ) Service (Phase 7 Milestone 4)
 *
 * ARCHITECTURAL INVARIANTS & SECURITY:
 * 1. ANTI-IDOR MULTI-TENANCY (Rule 8 & 47): Partitioned under `/organizations/{orgId}/workflow_dlq/{dlqId}`.
 *    Every lookup and mutation strictly checks tenant boundaries.
 * 2. ERROR SANITIZATION (Rule 48): Strips sensitive API keys, JWTs, DB connection strings, and internal stack traces
 *    using linear non-backtracking regex matchers (Rule 32) before persisting to DLQ.
 * 3. QUERY CLAMPING (Rule 9): Query results are clamped between 1 and 100 to prevent Firestore resource exhaustion.
 * 4. EVENTBUS AUDIT (Rule 40 & 62): Publishes `workflow.dlq_routed` and `workflow.dlq_remediated` for audit and real-time SSE updates.
 */

import { randomUUID } from 'node:crypto';
import type { EventBus } from '@/platform/events/event-bus';
import { defaultEventBus } from '@/platform/events/event-bus';
import { createDomainEvent } from '@/platform/capabilities/events/domain-event';
import type { TenantBoundary } from '../workflow-types';
import {
  type WorkflowDlqEntry,
  type RouteToDlqInput,
  type DlqFilter,
  type RemediateDlqInput,
  type DlqStatus,
  type DlqRemediationRecord,
  WorkflowDlqEntrySchema,
  WorkflowResilienceError,
} from './workflow-resilience-types';
import { classifyWorkflowError } from './workflow-retry-policy';

// ── 1. Linear Non-Backtracking Error Sanitizer (Rules 32 & 48) ───────────────

const SENSITIVE_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // OpenAI & Anthropic API keys (sk-...)
  { pattern: /\bsk-[a-zA-Z0-9_-]{20,}\b/g, replacement: '[REDACTED_SECRET:api_key]' },
  // Google API keys (AIza...)
  { pattern: /\bAIza[0-9A-Za-z_-]{30,45}\b/g, replacement: '[REDACTED_SECRET:api_key]' },
  // Bearer tokens & JWTs
  { pattern: /Bearer\s+(?:token:\s*)?[a-zA-Z0-9_\-.]{10,}/gi, replacement: 'Bearer [REDACTED_SECRET:jwt]' },
  // Database connection URIs
  {
    pattern: /\b(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql|redis):\/\/[^\s"']+/gi,
    replacement: '[REDACTED_SECRET:db_uri]',
  },
  // Private keys
  {
    pattern: /-----BEGIN [A-Z ]+ PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+ PRIVATE KEY-----/g,
    replacement: '[REDACTED_SECRET:private_key]',
  },
  // Credit card numbers (simple 16-digit patterns)
  { pattern: /\b(?:\d{4}[ -]?){3}\d{4}\b/g, replacement: '[REDACTED_SECRET:credit_card]' },
];

/**
 * Sanitizes an error message or stack trace, redacting all sensitive credentials and secrets.
 */
export function sanitizeErrorMessage(message: string): string {
  let sanitized = message;
  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement);
  }
  return sanitized;
}

// ── 2. DLQ Store Interface & In-Memory Adapter ───────────────────────────────

export interface WorkflowDlqStore {
  createEntry(entry: WorkflowDlqEntry): Promise<WorkflowDlqEntry>;
  getEntry(id: string, tenant: TenantBoundary): Promise<WorkflowDlqEntry | null>;
  listEntries(filter: DlqFilter, tenant: TenantBoundary): Promise<WorkflowDlqEntry[]>;
  updateEntryStatus(
    id: string,
    status: DlqStatus,
    remediation: DlqRemediationRecord | undefined,
    tenant: TenantBoundary
  ): Promise<WorkflowDlqEntry>;
  deleteEntry(id: string, tenant: TenantBoundary): Promise<boolean>;
}

export function createMemoryWorkflowDlqStore(): WorkflowDlqStore {
  const entries = new Map<string, WorkflowDlqEntry>();

  return {
    async createEntry(entry: WorkflowDlqEntry): Promise<WorkflowDlqEntry> {
      entries.set(entry.id, entry);
      return entry;
    },

    async getEntry(id: string, tenant: TenantBoundary): Promise<WorkflowDlqEntry | null> {
      const entry = entries.get(id);
      if (!entry) return null;
      if (entry.organizationId !== tenant.organizationId) {
        throw new WorkflowResilienceError(
          'IDOR_VIOLATION',
          `Cannot access DLQ entry '${id}' across tenant boundaries`
        );
      }
      return entry;
    },

    async listEntries(filter: DlqFilter, tenant: TenantBoundary): Promise<WorkflowDlqEntry[]> {
      const limit = Math.max(1, Math.min(100, filter.limit ?? 50));
      const result: WorkflowDlqEntry[] = [];

      for (const entry of entries.values()) {
        if (entry.organizationId !== tenant.organizationId) continue;
        if (tenant.workspaceId && entry.workspaceId !== tenant.workspaceId) continue;
        if (filter.status && entry.status !== filter.status) continue;
        if (filter.workflowId && entry.workflowId !== filter.workflowId) continue;
        if (filter.capabilityId && entry.capabilityId !== filter.capabilityId) continue;

        result.push(entry);
        if (result.length >= limit) break;
      }

      // Sort descending by quarantinedAt
      return result.sort(
        (a, b) => new Date(b.quarantinedAt).getTime() - new Date(a.quarantinedAt).getTime()
      );
    },

    async updateEntryStatus(
      id: string,
      status: DlqStatus,
      remediation: DlqRemediationRecord | undefined,
      tenant: TenantBoundary
    ): Promise<WorkflowDlqEntry> {
      const entry = entries.get(id);
      if (!entry) {
        throw new WorkflowResilienceError('DLQ_ENTRY_NOT_FOUND', `DLQ entry '${id}' not found`);
      }
      if (entry.organizationId !== tenant.organizationId) {
        throw new WorkflowResilienceError('IDOR_VIOLATION', 'Tenant mismatch');
      }

      const updated: WorkflowDlqEntry = {
        ...entry,
        status,
        remediation: remediation ?? entry.remediation,
      };

      entries.set(id, updated);
      return updated;
    },

    async deleteEntry(id: string, tenant: TenantBoundary): Promise<boolean> {
      const entry = entries.get(id);
      if (!entry) return false;
      if (entry.organizationId !== tenant.organizationId) {
        throw new WorkflowResilienceError('IDOR_VIOLATION', 'Tenant mismatch');
      }
      entries.delete(id);
      return true;
    },
  };
}

export function createFirestoreWorkflowDlqStore(): WorkflowDlqStore {
  return {
    async createEntry(entry: WorkflowDlqEntry): Promise<WorkflowDlqEntry> {
      const { adminDb } = await import('@/lib/firebase-admin');
      const docRef = adminDb
        .collection('organizations')
        .doc(entry.organizationId)
        .collection('workflow_dlq')
        .doc(entry.id);

      await docRef.set(entry);
      return entry;
    },

    async getEntry(id: string, tenant: TenantBoundary): Promise<WorkflowDlqEntry | null> {
      const { adminDb } = await import('@/lib/firebase-admin');
      const docRef = adminDb
        .collection('organizations')
        .doc(tenant.organizationId)
        .collection('workflow_dlq')
        .doc(id);

      const snap = await docRef.get();
      if (!snap.exists) return null;
      const data = snap.data();
      if (!data) return null;

      const parsed = WorkflowDlqEntrySchema.parse(data);
      if (tenant.workspaceId && parsed.workspaceId !== tenant.workspaceId) {
        throw new WorkflowResilienceError('IDOR_VIOLATION', 'Workspace mismatch');
      }
      return parsed;
    },

    async listEntries(filter: DlqFilter, tenant: TenantBoundary): Promise<WorkflowDlqEntry[]> {
      const { adminDb } = await import('@/lib/firebase-admin');
      const limit = Math.max(1, Math.min(100, filter.limit ?? 50));

      let query: FirebaseFirestore.Query = adminDb
        .collection('organizations')
        .doc(tenant.organizationId)
        .collection('workflow_dlq')
        .orderBy('quarantinedAt', 'desc')
        .limit(limit);

      if (tenant.workspaceId) {
        query = query.where('workspaceId', '==', tenant.workspaceId);
      }
      if (filter.status) {
        query = query.where('status', '==', filter.status);
      }
      if (filter.workflowId) {
        query = query.where('workflowId', '==', filter.workflowId);
      }
      if (filter.capabilityId) {
        query = query.where('capabilityId', '==', filter.capabilityId);
      }

      const snap = await query.get();
      return snap.docs.map((d) => WorkflowDlqEntrySchema.parse(d.data()));
    },

    async updateEntryStatus(
      id: string,
      status: DlqStatus,
      remediation: DlqRemediationRecord | undefined,
      tenant: TenantBoundary
    ): Promise<WorkflowDlqEntry> {
      const { adminDb } = await import('@/lib/firebase-admin');
      const docRef = adminDb
        .collection('organizations')
        .doc(tenant.organizationId)
        .collection('workflow_dlq')
        .doc(id);

      const snap = await docRef.get();
      if (!snap.exists) {
        throw new WorkflowResilienceError('DLQ_ENTRY_NOT_FOUND', `DLQ entry '${id}' not found`);
      }

      const existing = WorkflowDlqEntrySchema.parse(snap.data());
      const updatePayload: Record<string, unknown> = { status };
      if (remediation) {
        updatePayload.remediation = remediation;
      }

      await docRef.update(updatePayload);
      return {
        ...existing,
        status,
        remediation: remediation ?? existing.remediation,
      };
    },

    async deleteEntry(id: string, tenant: TenantBoundary): Promise<boolean> {
      const { adminDb } = await import('@/lib/firebase-admin');
      const docRef = adminDb
        .collection('organizations')
        .doc(tenant.organizationId)
        .collection('workflow_dlq')
        .doc(id);

      const snap = await docRef.get();
      if (!snap.exists) return false;
      await docRef.delete();
      return true;
    },
  };
}

// ── 3. Workflow Dead-Letter Queue Service ────────────────────────────────────

export interface WorkflowDlqServiceOptions {
  store?: WorkflowDlqStore;
  eventBus?: EventBus;
}

export class WorkflowDlqService {
  private readonly store: WorkflowDlqStore;
  private readonly eventBus: EventBus;

  constructor(options: WorkflowDlqServiceOptions = {}) {
    this.store = options.store || (process.env.NODE_ENV === 'test' ? createMemoryWorkflowDlqStore() : createFirestoreWorkflowDlqStore());
    this.eventBus = options.eventBus || defaultEventBus;
  }

  /**
   * Quarantines a failed workflow step into the DLQ, sanitizing errors and emitting an audit event.
   */
  public async routeToDlq(input: RouteToDlqInput): Promise<WorkflowDlqEntry> {
    const classification = classifyWorkflowError(input.rawError);

    // Extract raw error code and message
    let rawCode = 'EXECUTION_FAILED';
    let rawMessage = 'Workflow step execution failed';
    if (typeof input.rawError === 'object' && input.rawError !== null) {
      const rec = input.rawError as Record<string, unknown>;
      if (typeof rec.code === 'string') rawCode = rec.code;
      if (typeof rec.message === 'string') rawMessage = rec.message;
    } else if (typeof input.rawError === 'string') {
      rawMessage = input.rawError;
    }

    const sanitizedMessage = sanitizeErrorMessage(rawMessage);

    const entryId = `dlq_${randomUUID()}`;
    const entry: WorkflowDlqEntry = {
      id: entryId,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      workflowId: input.workflowId,
      stepId: input.stepId,
      stepIndex: input.stepIndex,
      capabilityId: input.capabilityId,
      attempt: input.attempt,
      maxAttempts: input.maxAttempts,
      errorCategory: classification.category,
      sanitizedError: {
        code: rawCode,
        message: sanitizedMessage,
        category: classification.category,
        occurredAt: new Date().toISOString(),
      },
      stepInput: input.stepInput,
      contextSnapshot: input.contextSnapshot ?? {},
      correlationId: input.correlationId,
      quarantinedAt: new Date().toISOString(),
      status: 'quarantined',
    };

    // Validate schema
    const validated = WorkflowDlqEntrySchema.parse(entry);
    await this.store.createEntry(validated);

    // Publish domain event for operator alerting and real-time SSE stream (Rule 40 & 62)
    await this.eventBus.publish(
      createDomainEvent({
        type: 'workflow.dlq_routed',
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        entity: { type: 'workflow', id: input.workflowId },
        actor: { type: 'system', id: 'workflow_dlq' },
        correlationId: input.correlationId || input.workflowId,
        source: 'workflow_dlq',
        payload: {
          dlqId: entryId,
          stepId: input.stepId,
          capabilityId: input.capabilityId,
          attempt: input.attempt,
          category: classification.category,
          errorCode: rawCode,
          errorMessage: sanitizedMessage,
        },
      })
    );

    return validated;
  }

  /**
   * Lists DLQ entries with tenant isolation and clamped pagination (Rule 9).
   */
  public async listDlqEntries(
    filter: DlqFilter,
    tenant: TenantBoundary
  ): Promise<WorkflowDlqEntry[]> {
    return this.store.listEntries(filter, tenant);
  }

  /**
   * Convenience alias for Server Actions and UI tables.
   */
  public async listEntries(
    tenant: TenantBoundary,
    filter?: DlqFilter
  ): Promise<{ items: WorkflowDlqEntry[]; total: number }> {
    const items = await this.store.listEntries(filter ?? {}, tenant);
    return { items, total: items.length };
  }

  /**
   * Retrieves a single DLQ entry with Anti-IDOR validation.
   */
  public async getDlqEntry(
    dlqId: string,
    tenant: TenantBoundary
  ): Promise<WorkflowDlqEntry | null> {
    return this.store.getEntry(dlqId, tenant);
  }

  /**
   * Convenience alias for getDlqEntry.
   */
  public async getEntry(
    dlqId: string,
    tenant: TenantBoundary
  ): Promise<WorkflowDlqEntry | null> {
    return this.store.getEntry(dlqId, tenant);
  }

  /**
   * Records an operator remediation action (retry, skip, reparameterize, discard).
   */
  public async remediateDlqEntry(params: RemediateDlqInput): Promise<WorkflowDlqEntry> {
    const existing = await this.store.getEntry(params.dlqId, params.tenant);
    if (!existing) {
      throw new WorkflowResilienceError(
        'DLQ_ENTRY_NOT_FOUND',
        `DLQ entry '${params.dlqId}' not found for tenant '${params.tenant.organizationId}'`
      );
    }

    if (existing.status !== 'quarantined') {
      throw new WorkflowResilienceError(
        'DLQ_ALREADY_REMEDIATED',
        `DLQ entry '${params.dlqId}' is already in state '${existing.status}'`
      );
    }

    const remediation: DlqRemediationRecord = {
      action: params.action,
      remediatedBy: params.remediatedBy,
      remediatedAt: new Date().toISOString(),
      newStepInput: params.newStepInput,
      notes: params.notes,
    };

    const statusMap: Record<RemediateDlqInput['action'], DlqStatus> = {
      retry: 'replayed',
      reparameterize: 'replayed',
      skip: 'skipped',
      discard: 'discarded',
    };
    const targetStatus = statusMap[params.action];

    const updated = await this.store.updateEntryStatus(
      params.dlqId,
      targetStatus,
      remediation,
      params.tenant
    );

    // Publish domain event
    await this.eventBus.publish(
      createDomainEvent({
        type: 'workflow.dlq_remediated',
        organizationId: params.tenant.organizationId,
        workspaceId: params.tenant.workspaceId,
        entity: { type: 'workflow', id: existing.workflowId },
        actor: { type: 'user', id: params.remediatedBy },
        correlationId: existing.correlationId || existing.workflowId,
        source: 'workflow_dlq',
        payload: {
          dlqId: params.dlqId,
          stepId: existing.stepId,
          action: params.action,
          targetStatus,
          remediatedBy: params.remediatedBy,
        },
      })
    );

    return updated;
  }
}

// ── 4. Factory & Global Singleton Preservation (Rule 69) ────────────────────

declare global {
  var __smartsappWorkflowDlqService: WorkflowDlqService | undefined;
}

export function createWorkflowDlqService(
  options: WorkflowDlqServiceOptions = {}
): WorkflowDlqService {
  return new WorkflowDlqService(options);
}

export function getWorkflowDlqService(
  options: WorkflowDlqServiceOptions = {}
): WorkflowDlqService {
  if (process.env.NODE_ENV !== 'production') {
    if (!globalThis.__smartsappWorkflowDlqService) {
      globalThis.__smartsappWorkflowDlqService = new WorkflowDlqService(options);
    }
    return globalThis.__smartsappWorkflowDlqService;
  }

  return new WorkflowDlqService(options);
}
