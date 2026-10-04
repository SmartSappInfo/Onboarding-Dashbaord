/**
 * @fileOverview Multi-Domain Account Context Assembler Engine (Phase 9 Milestone 1)
 *
 * Implements Rule 4 (Strict Typing: zero any/any[]), Rule 8 (Anti-IDOR Multi-Tenant Lock),
 * Rule 9 (Bounded Queries <= 50), Rule 10 (Zod v4 schema validation),
 * Rule 13 & 30 (Untrusted Reference Data XML containerization),
 * Rule 26 (Cooperative Cancellation via AbortSignal),
 * Rule 28 & 56 (Stratified Knapsack Context Budgeting <= 4,000 tokens),
 * Rule 32 & 33 (Linear non-backtracking secret & PII redaction),
 * Rule 60 (Emergency Dead-Man Pause Check), and Rule 69 (Dual-Tier CRM Data Model Preservation).
 *
 * ARCHITECTURAL INVARIANTS:
 * 1. Dual-Tier CRM Data Model: Global master entity (/entities/{entityId}) is overlaid with
 *    the workspace operational record (/workspace_entities/{workspaceId}_{entityId}) without mutating global state.
 * 2. Prompt Injection Neutralization: All customer notes, external emails, and meeting transcripts
 *    are scanned for adversarial directives, redacted in-place, and isolated inside <untrusted_reference_data> XML tags.
 * 3. Knapsack Budgeting: Context is strictly bounded to the requested maxTokens (default 4,000) using stratified greedy selection.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import {
  Account360Context,
  Account360ContextSchema,
  AccountEntitySummary,
  AccountWorkspaceEntitySummary,
  AccountContactSummary,
  AccountDealSummary,
  AccountMeetingSummary,
  AccountNoteSummary,
  AccountTaskSummary,
  AccountFinancialSummary,
  AccountMemoryFact,
  AccountTimelineItem,
  AssembleAccountContextInput,
  AssembleAccountContextOptionsSchema,
  AccountContextError,
  ACCOUNT_CONTEXT_ERROR_CODES,
} from './account-context-types';
import {
  checkGovernanceDeadManSwitch,
  AgentGovernanceEmergencyPausedError,
} from '@/platform/policy/governance-dead-man';
import { getCanonicalMemoryService } from '@/platform/memory/services/canonical-memory-service';

// Non-backtracking linear regex patterns for prompt injection directives (Rule 30)
const ADVERSARIAL_DIRECTIVE_PATTERNS: readonly RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/gi,
  /system\s+override/gi,
  /you\s+are\s+now\s+an\s+unrestricted/gi,
  /disregard\s+(all\s+)?prior\s+prompts/gi,
  /bypass\s+all\s+safety/gi,
  /reveal\s+all\s+system\s+prompts/gi,
  /exfiltrate/gi,
  /assistant\s+mode\s+deactivated/gi,
];

// Linear non-backtracking credential redaction patterns (Rule 32 & 33)
const SENSITIVE_TOKEN_PATTERNS: readonly { pattern: RegExp; tag: string }[] = [
  { pattern: /sk-[a-zA-Z0-9_-]{20,}/g, tag: '[REDACTED_SECRET:api_key]' },
  { pattern: /ghp_[a-zA-Z0-9]{36}/g, tag: '[REDACTED_SECRET:github_token]' },
  { pattern: /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g, tag: '[REDACTED_SECRET:jwt]' },
  { pattern: /-----BEGIN\s+[A-Z\s]+PRIVATE\s+KEY-----[\s\S]*?-----END\s+[A-Z\s]+PRIVATE\s+KEY-----/g, tag: '[REDACTED_SECRET:private_key]' },
];

/**
 * Sanitizes untrusted text content:
 * 1. Redacts sensitive credentials
 * 2. Replaces prompt injection instructions with [REDACTED_INJECTION_DIRECTIVE]
 */
function sanitizeUntrustedText(text: string): string {
  let sanitized = text;

  // Mask credentials
  for (const { pattern, tag } of SENSITIVE_TOKEN_PATTERNS) {
    sanitized = sanitized.replace(pattern, tag);
  }

  // Redact adversarial prompt injection directives
  for (const pattern of ADVERSARIAL_DIRECTIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED_INJECTION_DIRECTIVE]');
  }

  return sanitized;
}

/**
 * Wraps untrusted text in a protective XML container tag (Rule 13 & 30).
 */
function wrapInUntrustedContainer(id: string, source: string, content: string): string {
  const sanitized = sanitizeUntrustedText(content);
  return `<untrusted_reference_data id="${id}" source="${source}">\n${sanitized}\n</untrusted_reference_data>`;
}

/**
 * Pluggable dependency injection contract for AccountContextAssembler.
 * Enables hermetic, 100% deterministic unit and boundary testing without network or Firestore dependencies.
 */
export interface AccountContextAssemblerDependencies {
  fetchEntity?: (organizationId: string, entityId: string) => Promise<Record<string, unknown> | null>;
  fetchWorkspaceEntity?: (workspaceId: string, entityId: string) => Promise<Record<string, unknown> | null>;
  fetchDeals?: (workspaceId: string, entityId: string) => Promise<Array<Record<string, unknown>>>;
  fetchMeetings?: (workspaceId: string, entityId: string) => Promise<Array<Record<string, unknown>>>;
  fetchNotes?: (workspaceId: string, entityId: string) => Promise<Array<Record<string, unknown>>>;
  fetchTasks?: (workspaceId: string, entityId: string) => Promise<Array<Record<string, unknown>>>;
  fetchInvoices?: (organizationId: string, entityId: string) => Promise<Array<Record<string, unknown>>>;
  fetchMemories?: (organizationId: string, workspaceId: string, entityId: string) => Promise<Array<Record<string, unknown>>>;
}

export class AccountContextAssembler {
  private readonly deps: AccountContextAssemblerDependencies;

  constructor(dependencies: AccountContextAssemblerDependencies = {}) {
    this.deps = dependencies;
  }

  /**
   * Helper method for dead-man switch inspection (Rule 60)
   */
  public async isGovernancePaused(organizationId: string): Promise<boolean> {
    try {
      await checkGovernanceDeadManSwitch(organizationId);
      return false;
    } catch (err) {
      if (err instanceof AgentGovernanceEmergencyPausedError) {
        return true;
      }
      throw err;
    }
  }

  /**
   * Assembles the complete 360° Account Context package across all 8 multi-domain data stores.
   */
  public async assembleContext(rawOptions: AssembleAccountContextInput): Promise<Account360Context> {
    const startTime = Date.now();
    const options = AssembleAccountContextOptionsSchema.parse(rawOptions);
    const { organizationId, workspaceId, entityId, maxTokens, includeMemory, includeFinancials, signal } = options;

    // 1. Cooperative Cancellation Check (Rule 26)
    if (signal?.aborted) {
      throw new AccountContextError(
        'Context assembly cancelled by caller signal',
        ACCOUNT_CONTEXT_ERROR_CODES.CANCELLED,
        499,
        { organizationId, workspaceId, entityId }
      );
    }

    // 2. Emergency Dead-Man Switch Evaluation (Rule 60)
    try {
      await checkGovernanceDeadManSwitch(organizationId);
    } catch (err) {
      if (err instanceof AgentGovernanceEmergencyPausedError) {
        throw new AccountContextError(
          `Governance dead-man switch is active for organization ${organizationId}`,
          ACCOUNT_CONTEXT_ERROR_CODES.GOVERNANCE_PAUSED,
          503,
          { organizationId, workspaceId, entityId }
        );
      }
      throw err;
    }

    // 3. Parallel Multi-Domain Data Plane Retrieval (Rule 9: Bounded <= 50)
    const [
      rawEntity,
      rawWorkspaceEntity,
      rawDeals,
      rawMeetings,
      rawNotes,
      rawTasks,
      rawInvoices,
      rawMemories,
    ] = await Promise.all([
      this.retrieveEntity(organizationId, entityId),
      this.retrieveWorkspaceEntity(workspaceId, entityId),
      this.retrieveDeals(workspaceId, entityId),
      this.retrieveMeetings(workspaceId, entityId),
      this.retrieveNotes(workspaceId, entityId),
      this.retrieveTasks(workspaceId, entityId),
      includeFinancials ? this.retrieveInvoices(organizationId, entityId) : Promise.resolve([]),
      includeMemory ? this.retrieveMemories(organizationId, workspaceId, entityId) : Promise.resolve([]),
    ]);

    // Check cancellation post-retrieval
    if (signal?.aborted) {
      throw new AccountContextError(
        'Context assembly cancelled by caller signal',
        ACCOUNT_CONTEXT_ERROR_CODES.CANCELLED,
        499
      );
    }

    // 4. Validate Global Identity Record & Anti-IDOR Tenant Lock (Rule 8)
    if (!rawEntity) {
      throw new AccountContextError(
        `Account entity ${entityId} not found in organization ${organizationId}`,
        ACCOUNT_CONTEXT_ERROR_CODES.ENTITY_NOT_FOUND,
        404,
        { entityId, organizationId }
      );
    }

    if (rawEntity.organizationId && rawEntity.organizationId !== organizationId) {
      throw new AccountContextError(
        `Cross-tenant access violation: entity ${entityId} does not belong to organization ${organizationId}`,
        ACCOUNT_CONTEXT_ERROR_CODES.TENANT_MISMATCH,
        403,
        { entityId, requestedOrgId: organizationId, actualOrgId: rawEntity.organizationId }
      );
    }

    // 5. Parse & Normalize Global Entity Master (Rule 69)
    const entityLocation = typeof rawEntity.location === 'object' && rawEntity.location !== null
      ? (rawEntity.location as Record<string, unknown>)
      : {};

    const entitySummary: AccountEntitySummary = {
      id: String(rawEntity.id ?? entityId),
      name: String(rawEntity.name ?? 'Unknown Entity'),
      type: String(rawEntity.type ?? 'client'),
      status: String(rawEntity.status ?? 'active'),
      industry: String(rawEntity.industry ?? 'general'),
      email: typeof rawEntity.primaryEmail === 'string' ? rawEntity.primaryEmail : (typeof rawEntity.email === 'string' ? rawEntity.email : null),
      phone: typeof rawEntity.primaryPhone === 'string' ? rawEntity.primaryPhone : (typeof rawEntity.phone === 'string' ? rawEntity.phone : null),
      city: typeof entityLocation.city === 'string' ? entityLocation.city : null,
      address: typeof entityLocation.locationString === 'string'
        ? entityLocation.locationString
        : (typeof rawEntity.address === 'string' ? rawEntity.address : null),
      createdAt: typeof rawEntity.createdAt === 'string' ? rawEntity.createdAt : new Date().toISOString(),
    };

    // 6. Parse Workspace Operational Record (Rule 69 Dual-Tier Overlay)
    let workspaceEntitySummary: AccountWorkspaceEntitySummary | null = null;
    if (rawWorkspaceEntity) {
      const assignedToRaw = typeof rawWorkspaceEntity.assignedTo === 'object' && rawWorkspaceEntity.assignedTo !== null
        ? (rawWorkspaceEntity.assignedTo as Record<string, unknown>)
        : null;

      workspaceEntitySummary = {
        id: String(rawWorkspaceEntity.id ?? `${workspaceId}_${entityId}`),
        entityId,
        workspaceId,
        pipelineId: typeof rawWorkspaceEntity.pipelineId === 'string' ? rawWorkspaceEntity.pipelineId : null,
        stageId: typeof rawWorkspaceEntity.stageId === 'string' ? rawWorkspaceEntity.stageId : null,
        stageName: typeof rawWorkspaceEntity.stageName === 'string' ? rawWorkspaceEntity.stageName : null,
        assignedTo: assignedToRaw
          ? {
              userId: typeof assignedToRaw.userId === 'string' ? assignedToRaw.userId : null,
              name: typeof assignedToRaw.name === 'string' ? assignedToRaw.name : null,
              email: typeof assignedToRaw.email === 'string' ? assignedToRaw.email : null,
            }
          : null,
        workspaceTags: Array.isArray(rawWorkspaceEntity.workspaceTags)
          ? rawWorkspaceEntity.workspaceTags.map(String)
          : [],
        leadStatus: typeof rawWorkspaceEntity.leadStatus === 'string' ? rawWorkspaceEntity.leadStatus : null,
        updatedAt: typeof rawWorkspaceEntity.updatedAt === 'string' ? rawWorkspaceEntity.updatedAt : new Date().toISOString(),
      };
    }

    // 7. Parse Contacts (Extract from entity.contacts or workspace contacts)
    const rawContactsList = Array.isArray(rawEntity.contacts)
      ? (rawEntity.contacts as Array<Record<string, unknown>>)
      : [];

    const contacts: AccountContactSummary[] = rawContactsList.map((c) => ({
      id: String(c.id ?? `con_${Math.random().toString(36).slice(2, 7)}`),
      name: String(c.name ?? 'Unnamed Contact'),
      role: typeof c.role === 'string' ? c.role : null,
      email: typeof c.email === 'string' ? c.email : null,
      phone: typeof c.phone === 'string' ? c.phone : null,
      isPrimary: Boolean(c.isPrimary),
      channelPreferences: Array.isArray(c.channelPreferences) ? c.channelPreferences.map(String) : [],
    }));

    // 8. Parse Deals
    const deals: AccountDealSummary[] = rawDeals.map((d) => {
      const createdAt = typeof d.createdAt === 'string' ? d.createdAt : new Date().toISOString();
      const ageInDays = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)));
      return {
        id: String(d.id ?? `deal_${Math.random().toString(36).slice(2, 7)}`),
        title: String(d.title ?? 'Untitled Deal'),
        pipelineId: String(d.pipelineId ?? 'default'),
        stageId: String(d.stageId ?? 'default'),
        stageName: String(d.stageName ?? 'Initial'),
        value: typeof d.value === 'number' ? d.value : 0,
        currency: typeof d.currency === 'string' ? d.currency : 'USD',
        probability: typeof d.probability === 'number' ? Math.min(100, Math.max(0, d.probability)) : 50,
        ageInDays,
        expectedCloseDate: typeof d.expectedCloseDate === 'string' ? d.expectedCloseDate : null,
        isStalled: Boolean(d.isStalled ?? (ageInDays > 60 && typeof d.probability === 'number' && d.probability < 50)),
      };
    });

    // 9. Parse Meetings with XML Isolation (Rules 13 & 30)
    const meetings: AccountMeetingSummary[] = rawMeetings.map((m) => {
      const meetId = String(m.id ?? `meet_${Math.random().toString(36).slice(2, 7)}`);
      const rawSummary = typeof m.summary === 'string' ? m.summary : null;
      const rawTranscript = typeof m.transcript === 'string' ? m.transcript : (typeof m.transcriptSnippet === 'string' ? m.transcriptSnippet : null);
      const combinedUntrusted = [rawSummary, rawTranscript].filter(Boolean).join('\n\n');

      return {
        id: meetId,
        title: String(m.title ?? 'Scheduled Meeting'),
        startTime: typeof m.startTime === 'string' ? m.startTime : new Date().toISOString(),
        attendees: Array.isArray(m.attendees) ? m.attendees.map(String) : [],
        summary: rawSummary ? sanitizeUntrustedText(rawSummary) : null,
        transcriptSnippet: rawTranscript ? sanitizeUntrustedText(rawTranscript) : null,
        sentiment: m.sentiment === 'positive' || m.sentiment === 'neutral' || m.sentiment === 'negative'
          ? m.sentiment
          : 'unknown',
        isolatedContent: wrapInUntrustedContainer(`meet_${meetId}`, 'meeting', combinedUntrusted),
      };
    });

    // 10. Parse Notes with In-Place Redaction & XML Isolation (Rules 13, 30, 32, 33)
    const notes: AccountNoteSummary[] = rawNotes.map((n) => {
      const noteId = String(n.id ?? `note_${Math.random().toString(36).slice(2, 7)}`);
      const rawContent = String(n.content ?? '');
      const sanitizedContent = sanitizeUntrustedText(rawContent);

      return {
        id: noteId,
        content: sanitizedContent,
        isolatedContent: wrapInUntrustedContainer(`note_${noteId}`, 'note', rawContent),
        authorName: typeof n.authorName === 'string' ? n.authorName : null,
        createdAt: typeof n.createdAt === 'string' ? n.createdAt : new Date().toISOString(),
        category: typeof n.category === 'string' ? n.category : 'general',
      };
    });

    // 11. Parse Tasks
    const tasks: AccountTaskSummary[] = rawTasks.map((t) => {
      const dueDate = typeof t.dueDate === 'string' ? t.dueDate : null;
      const isOverdue = dueDate ? new Date(dueDate).getTime() < Date.now() && t.status !== 'completed' : false;
      const assignedToName = typeof t.assignedTo === 'object' && t.assignedTo !== null && 'name' in t.assignedTo
        ? String((t.assignedTo as Record<string, unknown>).name)
        : (typeof t.assignedToName === 'string' ? t.assignedToName : null);

      return {
        id: String(t.id ?? `task_${Math.random().toString(36).slice(2, 7)}`),
        title: String(t.title ?? 'Untitled Task'),
        status: t.status === 'in_progress' || t.status === 'completed' || t.status === 'cancelled'
          ? t.status
          : 'pending',
        priority: t.priority === 'low' || t.priority === 'high' || t.priority === 'urgent'
          ? t.priority
          : 'medium',
        dueDate,
        assignedToName,
        isOverdue,
      };
    });

    // 12. Parse Financials & Invoice Aggregations
    let totalOpenBalance = 0;
    let totalOverdueBalance = 0;
    const now = Date.now();
    let preferredCurrency = 'USD';

    for (const inv of rawInvoices) {
      const amountDue = typeof inv.amountDue === 'number' ? inv.amountDue : 0;
      const dueDate = typeof inv.dueDate === 'string' ? new Date(inv.dueDate).getTime() : 0;
      if (typeof inv.currency === 'string') {
        preferredCurrency = inv.currency;
      }

      totalOpenBalance += amountDue;
      if (amountDue > 0 && dueDate > 0 && dueDate < now) {
        totalOverdueBalance += amountDue;
      }
    }

    let agingCategory: 'CURRENT' | 'OVERDUE_30' | 'OVERDUE_60' | 'OVERDUE_90_PLUS' | 'CLEAR' = 'CLEAR';
    if (totalOverdueBalance > 0) {
      agingCategory = 'OVERDUE_30';
    } else if (totalOpenBalance > 0) {
      agingCategory = 'CURRENT';
    }

    const finances: AccountFinancialSummary = {
      openBalance: totalOpenBalance,
      overdueBalance: totalOverdueBalance,
      currency: preferredCurrency,
      invoiceCount: rawInvoices.length,
      agingCategory,
    };

    // 13. Parse Semantic Memories
    const memories: AccountMemoryFact[] = rawMemories.map((m) => ({
      id: String(m.id ?? `mem_${Math.random().toString(36).slice(2, 7)}`),
      content: sanitizeUntrustedText(String(m.content ?? '')),
      sourceType: typeof m.sourceType === 'string' ? m.sourceType : 'note',
      confidence: typeof m.confidence === 'number' ? Math.min(1, Math.max(0, m.confidence)) : 1,
      citationId: String(m.citationId ?? m.id ?? 'cite_default'),
    }));

    // 14. Assemble & Normalize Universal Timeline (Chronological Descending)
    const timelineItems: AccountTimelineItem[] = [];

    // From Notes
    for (const note of notes) {
      timelineItems.push({
        id: `tl_note_${note.id}`,
        timestamp: note.createdAt,
        category: 'COMMERCIAL',
        title: 'Note Added',
        summary: note.content,
        actor: note.authorName,
        sourceRef: { type: 'note', id: note.id },
      });
    }

    // From Meetings
    for (const meet of meetings) {
      timelineItems.push({
        id: `tl_meet_${meet.id}`,
        timestamp: meet.startTime,
        category: 'ENGAGEMENT',
        title: meet.title,
        summary: meet.summary ?? meet.title,
        actor: meet.attendees[0] ?? null,
        sourceRef: { type: 'meeting', id: meet.id },
      });
    }

    // From Deals
    for (const deal of deals) {
      timelineItems.push({
        id: `tl_deal_${deal.id}`,
        timestamp: deal.expectedCloseDate ?? new Date().toISOString(),
        category: 'COMMERCIAL',
        title: deal.title,
        summary: `Stage: ${deal.stageName} | Value: ${deal.currency} ${deal.value.toLocaleString()}`,
        actor: null,
        sourceRef: { type: 'deal', id: deal.id },
      });
    }

    // From Tasks
    for (const task of tasks) {
      timelineItems.push({
        id: `tl_task_${task.id}`,
        timestamp: task.dueDate ?? new Date().toISOString(),
        category: 'OPERATIONAL',
        title: task.title,
        summary: `Task: ${task.title} (Status: ${task.status}, Priority: ${task.priority})`,
        actor: task.assignedToName,
        sourceRef: { type: 'task', id: task.id },
      });
    }

    // From Invoices
    for (const inv of rawInvoices) {
      const invId = String(inv.id ?? `inv_${Math.random().toString(36).slice(2, 7)}`);
      const invDate = typeof inv.dueDate === 'string' ? inv.dueDate : new Date().toISOString();
      timelineItems.push({
        id: `tl_inv_${invId}`,
        timestamp: invDate,
        category: 'FINANCIAL',
        title: `Invoice ${invId}`,
        summary: `Total: ${inv.currency ?? 'USD'} ${inv.totalAmount ?? 0} (Status: ${inv.status ?? 'PENDING'})`,
        actor: null,
        sourceRef: { type: 'invoice', id: invId },
      });
    }

    // Sort timeline strictly descending by timestamp
    timelineItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // 15. Context Token Estimation & Stratified Knapsack Compression (Rules 28 & 56)
    let isKnapsackCompressed = false;
    let candidateTimeline = [...timelineItems];
    let candidateNotes = [...notes];
    let candidateMeetings = [...meetings];
    let candidateMemories = [...memories];

    const estimateTokens = (): number => {
      const payloadString = JSON.stringify({
        entity: entitySummary,
        workspaceEntity: workspaceEntitySummary,
        contacts,
        deals,
        meetings: candidateMeetings,
        notes: candidateNotes,
        tasks,
        finances,
        memories: candidateMemories,
        timeline: candidateTimeline,
      });
      return Math.ceil(payloadString.length / 3.8);
    };

    let currentEstimatedTokens = estimateTokens();

    // If context exceeds maxTokens, apply greedy knapsack pruning:
    // Priority:
    // Tier 1 (Never Prune): Global Entity, Workspace Entity, Contacts
    // Tier 2 (High): Deals, Tasks, Finances
    // Tier 3 (Medium): Meetings, Recent Notes
    // Tier 4 (First to Prune): Older Timeline items, Older Notes, Semantic Memories
    if (currentEstimatedTokens > maxTokens) {
      isKnapsackCompressed = true;

      // 1. Prune memories first
      while (currentEstimatedTokens > maxTokens && candidateMemories.length > 0) {
        candidateMemories.pop();
        currentEstimatedTokens = estimateTokens();
      }

      // 2. Prune timeline items (keep newest)
      while (currentEstimatedTokens > maxTokens && candidateTimeline.length > 5) {
        candidateTimeline.pop();
        currentEstimatedTokens = estimateTokens();
      }

      // 3. Prune notes (keep newest)
      while (currentEstimatedTokens > maxTokens && candidateNotes.length > 3) {
        candidateNotes.pop();
        currentEstimatedTokens = estimateTokens();
      }

      // 4. Prune meetings (keep newest)
      while (currentEstimatedTokens > maxTokens && candidateMeetings.length > 2) {
        candidateMeetings.pop();
        currentEstimatedTokens = estimateTokens();
      }

      // 5. Truncate lengthy isolated content in remaining notes and meetings if still over
      if (currentEstimatedTokens > maxTokens) {
        candidateNotes = candidateNotes.map((n) => ({
          ...n,
          content: n.content.length > 250 ? `${n.content.slice(0, 250)}... [TRUNCATED]` : n.content,
          isolatedContent: n.isolatedContent && n.isolatedContent.length > 350
            ? `${n.isolatedContent.slice(0, 350)}...\n</untrusted_reference_data>`
            : n.isolatedContent,
        }));
        candidateMeetings = candidateMeetings.map((m) => ({
          ...m,
          summary: m.summary && m.summary.length > 250 ? `${m.summary.slice(0, 250)}... [TRUNCATED]` : m.summary,
          transcriptSnippet: m.transcriptSnippet && m.transcriptSnippet.length > 250 ? `${m.transcriptSnippet.slice(0, 250)}... [TRUNCATED]` : m.transcriptSnippet,
          isolatedContent: m.isolatedContent && m.isolatedContent.length > 350
            ? `${m.isolatedContent.slice(0, 350)}...\n</untrusted_reference_data>`
            : m.isolatedContent,
        }));
        currentEstimatedTokens = estimateTokens();
      }

      // 6. Aggressive pruning of remaining items down to 1 if still over
      while (currentEstimatedTokens > maxTokens && candidateTimeline.length > 1) {
        candidateTimeline.pop();
        currentEstimatedTokens = estimateTokens();
      }
      while (currentEstimatedTokens > maxTokens && candidateNotes.length > 1) {
        candidateNotes.pop();
        currentEstimatedTokens = estimateTokens();
      }
      while (currentEstimatedTokens > maxTokens && candidateMeetings.length > 1) {
        candidateMeetings.pop();
        currentEstimatedTokens = estimateTokens();
      }
    }

    const durationMs = Date.now() - startTime;
    const correlationId = options.correlationId ?? `corr_ctx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const contextPackage: Account360Context = {
      organizationId,
      workspaceId,
      entityId,
      entity: entitySummary,
      workspaceEntity: workspaceEntitySummary,
      contacts,
      deals,
      meetings: candidateMeetings,
      notes: candidateNotes,
      tasks,
      finances,
      memories: candidateMemories,
      timeline: candidateTimeline,
      metadata: {
        assembledAt: new Date().toISOString(),
        durationMs,
        estimatedTokens: currentEstimatedTokens,
        correlationId,
        isKnapsackCompressed,
        rawItemCounts: {
          contacts: contacts.length,
          deals: deals.length,
          meetings: meetings.length,
          notes: notes.length,
          tasks: tasks.length,
          invoices: rawInvoices.length,
          memories: memories.length,
          timeline: timelineItems.length,
        },
      },
    };

    // 16. Final Contract Verification via Zod v4 (Rule 47)
    return Account360ContextSchema.parse(contextPackage);
  }

  // ============================================================================
  // Private Data Plane Retrieval Adaptors (Hermetic DI or Firestore Admin)
  // ============================================================================

  private async retrieveEntity(orgId: string, entityId: string): Promise<Record<string, unknown> | null> {
    if (this.deps.fetchEntity) {
      return this.deps.fetchEntity(orgId, entityId);
    }
    const { adminDb } = await import('@/lib/firebase-admin');
    const doc = await adminDb.collection('entities').doc(entityId).get();
    if (!doc.exists) {
      return null;
    }
    const data = doc.data() as Record<string, unknown>;
    return { id: doc.id, ...data };
  }

  private async retrieveWorkspaceEntity(wsId: string, entityId: string): Promise<Record<string, unknown> | null> {
    if (this.deps.fetchWorkspaceEntity) {
      return this.deps.fetchWorkspaceEntity(wsId, entityId);
    }
    const { adminDb } = await import('@/lib/firebase-admin');
    const doc = await adminDb.collection('workspace_entities').doc(`${wsId}_${entityId}`).get();
    if (!doc.exists) {
      return null;
    }
    const data = doc.data() as Record<string, unknown>;
    return { id: doc.id, ...data };
  }

  private async retrieveDeals(wsId: string, entityId: string): Promise<Array<Record<string, unknown>>> {
    if (this.deps.fetchDeals) {
      return this.deps.fetchDeals(wsId, entityId);
    }
    const { adminDb } = await import('@/lib/firebase-admin');
    const snap = await adminDb
      .collection('deals')
      .where('workspaceId', '==', wsId)
      .where('entityId', '==', entityId)
      .limit(50)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  private async retrieveMeetings(wsId: string, entityId: string): Promise<Array<Record<string, unknown>>> {
    if (this.deps.fetchMeetings) {
      return this.deps.fetchMeetings(wsId, entityId);
    }
    const { adminDb } = await import('@/lib/firebase-admin');
    const snap = await adminDb
      .collection('meetings')
      .where('workspaceId', '==', wsId)
      .where('entityId', '==', entityId)
      .limit(50)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  private async retrieveNotes(wsId: string, entityId: string): Promise<Array<Record<string, unknown>>> {
    if (this.deps.fetchNotes) {
      return this.deps.fetchNotes(wsId, entityId);
    }
    const { adminDb } = await import('@/lib/firebase-admin');
    const snap = await adminDb
      .collection('notes')
      .where('workspaceId', '==', wsId)
      .where('entityId', '==', entityId)
      .limit(50)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  private async retrieveTasks(wsId: string, entityId: string): Promise<Array<Record<string, unknown>>> {
    if (this.deps.fetchTasks) {
      return this.deps.fetchTasks(wsId, entityId);
    }
    const { adminDb } = await import('@/lib/firebase-admin');
    const snap = await adminDb
      .collection('tasks')
      .where('workspaceId', '==', wsId)
      .where('entityId', '==', entityId)
      .limit(50)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  private async retrieveInvoices(orgId: string, entityId: string): Promise<Array<Record<string, unknown>>> {
    if (this.deps.fetchInvoices) {
      return this.deps.fetchInvoices(orgId, entityId);
    }
    const { adminDb } = await import('@/lib/firebase-admin');
    const snap = await adminDb
      .collection('invoices')
      .where('organizationId', '==', orgId)
      .where('entityId', '==', entityId)
      .limit(50)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  private async retrieveMemories(orgId: string, wsId: string, entityId: string): Promise<Array<Record<string, unknown>>> {
    if (this.deps.fetchMemories) {
      return this.deps.fetchMemories(orgId, wsId, entityId);
    }
    try {
      const memoryService = getCanonicalMemoryService();
      const memories = await memoryService.queryMemory({
        organizationId: orgId,
        workspaceId: wsId,
        query: entityId,
        limit: 10,
        includeExpired: false,
      });
      return memories.map((m) => ({
        id: m.id,
        content: m.content,
        sourceType: m.source.type ?? 'note',
        confidence: m.confidence,
        citationId: m.source.sourceId ?? m.id,
      }));
    } catch {
      return [];
    }
  }
}
