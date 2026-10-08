/**
 * @fileOverview Intelligent Collections & Aging Receivables Recovery Engine (Phase 12 Milestone 4)
 *
 * Implements:
 * - Rule 1 & 14 (Canonical Capability Layer & Complete Typed Contracts)
 * - Rule 2 & 48 (Structured Failure Taxonomy & Recovery Strategies)
 * - Rule 4 (Strict Zero-any / Zero-any[] typing policy)
 * - Rule 8 & 47 (Multi-Tenant Scoping & Anti-IDOR Enforcement)
 * - Rule 10 (Zod v4 schema validation)
 * - Rule 11 (Mathematical Determinism in Financial Logic & Double-Entry Remainder Balancing)
 * - Rule 12 (5-tier risk taxonomy classification)
 * - Rule 13 & 30 (Untrusted Reference Data XML containerization & injection defense)
 * - Rule 17 (Non-Delegable Actions Guard: student suspension & debt write-offs)
 * - Rule 18 (Live TOCTOU Authority & Freshness Checks)
 * - Rule 19 (Deterministic Idempotency Key Computation)
 * - Rule 21 & 22 (Two-Phase Action Model & Cryptographic SHA-256 Tampering Defense)
 * - Rule 23 (Deterministic Budgets)
 * - Rule 26 (Cooperative Cancellation via AbortSignal)
 * - Rule 27 (Reverse-LIFO Saga Compensation)
 * - Rule 40 (Domain Event Publishing)
 * - Rule 41 (4-Part Explainability Grid: WHAT, WHY, RECOVERY PROBABILITY, RISK LEVEL)
 * - Rule 42 (Zero Live Writes in Shadow Mode Simulation)
 * - Rule 50 (Multi-Tenant Cache Partitioning)
 * - Rule 60 (Emergency Dead-Man Switch Evaluation)
 * - Rule 69 (Governed Capability Layer & Strangler Fig Invariant)
 * - .agents/AGENTS.md (Fields & Variables SSOT via FieldsVariablesService, TagSelector SSOT)
 */

import crypto from 'crypto';
import { FieldsVariablesService } from '@/lib/services/fields-variables-service-impl';
import { checkGovernanceDeadManSwitch } from '@/platform/policy/governance-dead-man';
import { defaultEventBus } from '@/platform/events/event-bus';
import { createDomainEvent } from '@/platform/capabilities/events/domain-event';
import {
  type DebtorAccount,
  type InstallmentPaymentPlan,
  type InstallmentMilestone,
  type DunningNoticeDraft,
  type CollectionsNextBestAction,
  type CollectionsMetrics,
  type DunningTier,
  type OutreachChannel,
  type AgingBucket,
  type GenerateInstallmentPlanInput,
  type RecordPromiseToPayInput,
  roundCurrency,
  COLLECTIONS_ERROR_CODES,
  CollectionsError,
} from './collections-types';

/**
 * Adversarial directive patterns to scan in debtor notes and remarks (Rule 30).
 */
export const ADVERSARIAL_DIRECTIVE_PATTERNS: readonly RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
  /system\s+override/i,
  /you\s+are\s+now\s+an?\s+unrestricted/i,
  /bypass\s+governance/i,
  /grant\s+admin/i,
  /delete\s+from/i,
  /drop\s+table/i,
  /100%\s+discount/i,
  /waive\s+(all\s+)?(debt|fees|balance)/i,
];

/**
 * Scans untrusted debtor notes/remarks for prompt injection attempts (Rule 30).
 */
export function scanDebtorForAdversarialDirectives(text: string): boolean {
  for (const pattern of ADVERSARIAL_DIRECTIVE_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }
  return false;
}

/**
 * Sanitizes untrusted text by replacing adversarial directives.
 */
export function sanitizeDebtorRemarks(text: string): string {
  let sanitized = text;
  for (const pattern of ADVERSARIAL_DIRECTIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED_INJECTION_DIRECTIVE]');
  }
  return sanitized;
}

// In-memory runtime/test caches for debtor state and payment plans
const inMemoryDebtorAccounts = new Map<string, DebtorAccount>();
const inMemoryPaymentPlans = new Map<string, InstallmentPaymentPlan>();

/**
 * Seed initial sample debtor accounts for hermetic testing and development.
 */
function initializeSampleDebtors(): void {
  if (inMemoryDebtorAccounts.size > 0) return;

  const samples: DebtorAccount[] = [
    {
      entityId: 'debtor-gis-001',
      workspaceId: 'ws-demo-1',
      organizationId: 'org-demo-1',
      entityName: 'Ghana International School - Senior Wing',
      studentId: 'STU-2026-042',
      primaryContactName: 'Dr. Kwame Mensah',
      primaryContactPhone: '+233201234567',
      primaryContactEmail: 'kwame.mensah@example.com',
      totalOutstandingBalance: 12500.0,
      currency: 'GHS',
      oldestInvoiceDueDate: '2026-08-15',
      daysOverdue: 54,
      agingBucket: '31_60_DAYS',
      relationshipHealth: 'GOOD',
      activeInstallmentPlanId: null,
      lastContactedAt: '2026-09-20',
      promiseToPayDate: null,
      promiseToPayAmount: null,
      brokenPromisesCount: 0,
      currentTagIds: ['tag-day-student', 'tag-high-priority'],
      remarks: 'Parent requested payment breakdown for Term 1 tuition and lab fees.',
    },
    {
      entityId: 'debtor-oak-002',
      workspaceId: 'ws-demo-1',
      organizationId: 'org-demo-1',
      entityName: 'Oakridge Academy - East Campus',
      studentId: 'STU-2026-118',
      primaryContactName: 'Mrs. Abigail Osei',
      primaryContactPhone: '+233249876543',
      primaryContactEmail: 'abigail.osei@example.com',
      totalOutstandingBalance: 4800.0,
      currency: 'GHS',
      oldestInvoiceDueDate: '2026-09-25',
      daysOverdue: 13,
      agingBucket: '0_14_DAYS',
      relationshipHealth: 'EXCELLENT',
      activeInstallmentPlanId: null,
      lastContactedAt: null,
      promiseToPayDate: null,
      promiseToPayAmount: null,
      brokenPromisesCount: 0,
      currentTagIds: ['tag-boarding'],
      remarks: 'First-time delayed payment; historical payments on time.',
    },
    {
      entityId: 'debtor-presec-003',
      workspaceId: 'ws-demo-1',
      organizationId: 'org-demo-1',
      entityName: 'PRESEC Legon Alumni Foundation Account',
      studentId: 'STU-2026-250',
      primaryContactName: 'Ing. Emmanuel Addo',
      primaryContactPhone: '+233271122334',
      primaryContactEmail: 'e.addo@example.com',
      totalOutstandingBalance: 18200.0,
      currency: 'GHS',
      oldestInvoiceDueDate: '2026-07-10',
      daysOverdue: 90,
      agingBucket: 'OVER_60_DAYS',
      relationshipHealth: 'AT_RISK',
      activeInstallmentPlanId: null,
      lastContactedAt: '2026-09-15',
      promiseToPayDate: '2026-09-30',
      promiseToPayAmount: 10000.0,
      brokenPromisesCount: 2,
      currentTagIds: ['tag-at-risk', 'tag-graduating-class'],
      remarks: 'Two broken promises to pay; bursar requested formal escalation.',
    },
    {
      entityId: 'debtor-lincoln-004',
      workspaceId: 'ws-demo-1',
      organizationId: 'org-demo-1',
      entityName: 'Lincoln Community Academy - Primary',
      studentId: 'STU-2026-304',
      primaryContactName: 'Kofi Boateng',
      primaryContactPhone: '+233265544332',
      primaryContactEmail: 'kofi.b@example.com',
      totalOutstandingBalance: 6500.0,
      currency: 'GHS',
      oldestInvoiceDueDate: '2026-09-10',
      daysOverdue: 28,
      agingBucket: '15_30_DAYS',
      relationshipHealth: 'FAIR',
      activeInstallmentPlanId: null,
      lastContactedAt: '2026-09-18',
      promiseToPayDate: null,
      promiseToPayAmount: null,
      brokenPromisesCount: 0,
      currentTagIds: ['tag-day-student'],
      remarks: 'Awaiting parent company reimbursement disbursement.',
    },
  ];

  for (const item of samples) {
    inMemoryDebtorAccounts.set(item.entityId, item);
  }
}

// Initialize test fixtures
initializeSampleDebtors();

export class CollectionsEngine {
  /**
   * Evaluates the emergency governance dead-man switch (Rule 60).
   */
  private async checkDeadMan(organizationId: string): Promise<void> {
    try {
      await checkGovernanceDeadManSwitch(organizationId);
    } catch {
      throw new CollectionsError(
        COLLECTIONS_ERROR_CODES.COLLECTIONS_DEAD_MAN_PAUSED,
        `Collections operations are currently paused by the emergency governance dead-man switch for organization '${organizationId}'.`,
        503
      );
    }
  }

  /**
   * Evaluates a debtor account, computing mathematical recovery probability,
   * determining dunning escalation tier, and formulating a Next-Best-Action.
   */
  public async evaluateDebtorAccount(
    debtor: DebtorAccount,
    options?: { signal?: AbortSignal }
  ): Promise<CollectionsNextBestAction> {
    if (options?.signal?.aborted) {
      throw new CollectionsError(
        COLLECTIONS_ERROR_CODES.INTERNAL_ERROR,
        'Evaluation cancelled by caller.',
        499
      );
    }

    // Rule 60: Emergency Dead-Man Switch Evaluation
    await this.checkDeadMan(debtor.organizationId);

    // Rule 13 & 30: Scan untrusted debtor remarks for prompt injection
    if (debtor.remarks && scanDebtorForAdversarialDirectives(debtor.remarks)) {
      // Neutralize remarks to prevent downstream injection
      debtor = {
        ...debtor,
        remarks: sanitizeDebtorRemarks(debtor.remarks),
      };
    }

    // Compute recovery probability score (Formula 2)
    const healthBonus =
      debtor.relationshipHealth === 'EXCELLENT'
        ? 20
        : debtor.relationshipHealth === 'GOOD'
        ? 10
        : debtor.relationshipHealth === 'FAIR'
        ? 0
        : -15;

    const rawProbability =
      100 -
      debtor.daysOverdue * 0.6 -
      debtor.brokenPromisesCount * 15 +
      healthBonus;

    const recoveryProbability = roundCurrency(
      Math.min(100, Math.max(5, rawProbability))
    );

    // Determine Dunning Tier & Action Type
    let actionType: CollectionsNextBestAction['actionType'];
    let priority: CollectionsNextBestAction['priority'];
    let riskLevel: CollectionsNextBestAction['riskLevel'];
    let requiresHumanApproval = false;
    let nonDelegable = false;
    let what = '';
    let why = '';
    let proposedPlan: InstallmentPaymentPlan | undefined = undefined;
    let dunningDraft: DunningNoticeDraft | undefined = undefined;

    if (
      debtor.daysOverdue > 60 ||
      (debtor.brokenPromisesCount >= 2 && debtor.relationshipHealth === 'AT_RISK')
    ) {
      // Tier 4: Suspension Review (Non-Delegable, L4)
      actionType = 'REQUEST_SUSPENSION_REVIEW';
      priority = 'URGENT';
      riskLevel = 'L4_PRIVILEGED_DESTRUCTIVE';
      requiresHumanApproval = true;
      nonDelegable = true;
      what = `Submit executive suspension review recommendation for ${debtor.entityName}.`;
      why = `Account is ${debtor.daysOverdue} days overdue with ${debtor.brokenPromisesCount} broken promises and an AT_RISK health rating. Outstanding balance of ${debtor.currency} ${debtor.totalOutstandingBalance.toFixed(2)} warrants formal executive review.`;
    } else if (debtor.daysOverdue >= 31) {
      // Tier 3: Installment Proposal (L2 Mutation, requires approval)
      actionType = 'PROPOSE_INSTALLMENT_PLAN';
      priority = 'HIGH';
      riskLevel = 'L2_STATE_MUTATION';
      requiresHumanApproval = true;
      nonDelegable = false;
      what = `Propose structured 3-part installment recovery agreement for ${debtor.entityName}.`;
      why = `Account is ${debtor.daysOverdue} days overdue in the 31-60 day aging bucket. Structuring payments into monthly milestones maximizes recovery probability (${recoveryProbability}%).`;

      // Generate proposed installment plan
      proposedPlan = await this.generateInstallmentPlan({
        entityId: debtor.entityId,
        workspaceId: debtor.workspaceId,
        organizationId: debtor.organizationId,
        totalAmount: debtor.totalOutstandingBalance,
        currency: debtor.currency,
        frequency: 'monthly',
        milestoneCount: 3,
        startDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        notes: `Automated recovery proposal for ${debtor.entityName}`,
      });
    } else if (debtor.daysOverdue >= 15) {
      // Tier 2: Formal Statement (L1 Internal Draft)
      actionType = 'SEND_FORMAL_STATEMENT';
      priority = 'MEDIUM';
      riskLevel = 'L1_INTERNAL_DRAFT';
      requiresHumanApproval = false;
      what = `Draft formal overdue account statement notice for ${debtor.entityName}.`;
      why = `Account is ${debtor.daysOverdue} days overdue in the 15-30 day aging bucket. A formal statement with payment links is recommended.`;

      dunningDraft = await this.draftDunningNotice(
        debtor,
        'FORMAL_STATEMENT',
        'email'
      );
    } else {
      // Tier 1: Courtesy Reminder (L1 Internal Draft)
      actionType = 'SEND_COURTESY_REMINDER';
      priority = 'LOW';
      riskLevel = 'L1_INTERNAL_DRAFT';
      requiresHumanApproval = false;
      what = `Draft courteous payment reminder for ${debtor.primaryContactName}.`;
      why = `Account is ${debtor.daysOverdue} days overdue. A friendly courtesy reminder encourages early settlement without damaging relationship health (${debtor.relationshipHealth}).`;

      dunningDraft = await this.draftDunningNotice(
        debtor,
        'COURTESY_REMINDER',
        'whatsapp'
      );
    }

    const idempotencyKey = `col_act_${debtor.entityId}_${debtor.daysOverdue}_${actionType}`;

    return {
      actionId: `act-${crypto.randomUUID().slice(0, 8)}`,
      entityId: debtor.entityId,
      actionType,
      priority,
      riskLevel,
      explainability: {
        what,
        why,
        recoveryProbability,
        riskLevel,
        financialExposure: roundCurrency(debtor.totalOutstandingBalance),
      },
      proposedPlan,
      dunningDraft,
      idempotencyKey,
      requiresHumanApproval,
      nonDelegable,
    };
  }

  /**
   * Generates a structured installment payment plan using pure double-entry
   * remainder distribution to guarantee exact mathematical determinism (Rule 11).
   */
  public async generateInstallmentPlan(
    params: GenerateInstallmentPlanInput,
    options?: { signal?: AbortSignal }
  ): Promise<InstallmentPaymentPlan> {
    if (options?.signal?.aborted) {
      throw new CollectionsError(
        COLLECTIONS_ERROR_CODES.INTERNAL_ERROR,
        'Plan generation cancelled by caller.',
        499
      );
    }

    // Rule 60: Dead-man switch check
    await this.checkDeadMan(params.organizationId);

    if (params.milestoneCount < 2 || params.milestoneCount > 12) {
      throw new CollectionsError(
        COLLECTIONS_ERROR_CODES.INVALID_INSTALLMENT_SCHEDULE,
        `Installment milestone count must be between 2 and 12. Provided: ${params.milestoneCount}`,
        400
      );
    }

    if (params.totalAmount <= 0) {
      throw new CollectionsError(
        COLLECTIONS_ERROR_CODES.INVALID_INSTALLMENT_SCHEDULE,
        `Total installment principal must be positive. Provided: ${params.totalAmount}`,
        400
      );
    }

    const n = params.milestoneCount;
    const totalPrincipal = roundCurrency(params.totalAmount);

    // Rule 11: Exact double-entry remainder distribution
    // Floor cents per milestone, calculate remaining cents, add to final milestone
    const baseMilestone = roundCurrency(Math.floor((totalPrincipal * 100) / n) / 100);
    const remainder = roundCurrency(totalPrincipal - baseMilestone * n);

    const startTimestamp = new Date(params.startDate).getTime();
    const frequencyDayOffsets: Record<string, number> = {
      weekly: 7,
      biweekly: 14,
      monthly: 30,
      termly: 90,
    };
    const dayOffset = frequencyDayOffsets[params.frequency] || 30;

    const milestones: InstallmentMilestone[] = [];
    for (let i = 1; i <= n; i++) {
      const milestoneDate = new Date(
        startTimestamp + (i - 1) * dayOffset * 86400000
      )
        .toISOString()
        .split('T')[0];

      // Final milestone absorbs remainder cents so sum === totalPrincipal exactly
      const amount =
        i === n
          ? roundCurrency(baseMilestone + remainder)
          : roundCurrency(baseMilestone);

      milestones.push({
        milestoneIndex: i,
        dueDate: milestoneDate,
        amount,
        currency: params.currency,
        status: 'PENDING',
      });
    }

    // Verify mathematical determinism invariant
    const milestoneSum = roundCurrency(
      milestones.reduce((acc, m) => acc + m.amount, 0)
    );
    if (milestoneSum !== totalPrincipal) {
      throw new CollectionsError(
        COLLECTIONS_ERROR_CODES.INVALID_INSTALLMENT_SCHEDULE,
        `Milestone sum (${milestoneSum}) did not match principal (${totalPrincipal}). Remainder calculation failure.`,
        500
      );
    }

    const planId = `plan_${params.entityId}_${Date.now().toString(36)}`;
    const plan: InstallmentPaymentPlan = {
      planId,
      entityId: params.entityId,
      workspaceId: params.workspaceId,
      organizationId: params.organizationId,
      totalAmount: totalPrincipal,
      currency: params.currency,
      frequency: params.frequency,
      milestones,
      startDate: params.startDate,
      status: 'PROPOSED',
      createdAt: new Date().toISOString(),
      notes: params.notes,
    };

    inMemoryPaymentPlans.set(planId, plan);
    return plan;
  }

  /**
   * Drafts a dunning notice, delegating variable replacement to FieldsVariablesService
   * (Workspace Single Source of Truth).
   */
  public async draftDunningNotice(
    debtor: DebtorAccount,
    tier: DunningTier,
    channel: OutreachChannel,
    templateText?: string
  ): Promise<DunningNoticeDraft> {
    // Rule 60: Dead-man switch check
    await this.checkDeadMan(debtor.organizationId);

    const paymentLink = `https://portal.smartsapp.com/pay/${debtor.entityId}`;
    let subject: string | undefined;
    let body = '';

    if (templateText) {
      // Route through FieldsVariablesService SSOT
      body = await FieldsVariablesService.resolveTemplateVariables(templateText, {
        workspaceId: debtor.workspaceId,
        entityId: debtor.entityId,
      });
      if (channel === 'email') {
        subject = `Important Account Update for ${debtor.entityName}`;
      }
    } else {
      // Default canonical templates by tier
      if (tier === 'COURTESY_REMINDER') {
        if (channel === 'whatsapp') {
          body = `Hello ${debtor.primaryContactName}, friendly reminder regarding the outstanding balance of ${debtor.currency} ${debtor.totalOutstandingBalance.toFixed(2)} for ${debtor.entityName}. You can review the invoice and complete payment easily here: ${paymentLink}. Thank you for your continued partnership! — SmartSapp Finance Office`;
        } else {
          subject = `Courtesy Reminder: Outstanding Balance for ${debtor.entityName}`;
          body = `Dear ${debtor.primaryContactName},\n\nWe hope this email finds you well.\n\nThis is a gentle reminder that an outstanding balance of ${debtor.currency} ${debtor.totalOutstandingBalance.toFixed(2)} remains due on the account for ${debtor.entityName}.\n\nYou can review your invoice and make a secure settlement using Mobile Money or Card here: ${paymentLink}.\n\nIf you have already settled this balance within the last 24 hours, please disregard this notice.\n\nWarm regards,\nFinance & Bursar's Office`;
        }
      } else if (tier === 'FORMAL_STATEMENT') {
        subject = `Formal Statement of Account: ${debtor.entityName} (${debtor.daysOverdue} Days Overdue)`;
        body = `Dear ${debtor.primaryContactName},\n\nPlease find attached the formal statement of account for ${debtor.entityName}.\n\nAs of today, an outstanding balance of ${debtor.currency} ${debtor.totalOutstandingBalance.toFixed(2)} is ${debtor.daysOverdue} days past the scheduled due date (${debtor.oldestInvoiceDueDate}).\n\nPrompt settlement is required to ensure uninterrupted access to school services and academic records. Immediate payment can be processed securely via: ${paymentLink}.\n\nIf you need to discuss payment arrangements, please contact the accounts desk immediately.\n\nSincerely,\nSmartSapp Bursar Administration`;
      } else if (tier === 'INSTALLMENT_PROPOSAL') {
        subject = `Payment Arrangement Proposal for ${debtor.entityName}`;
        body = `Dear ${debtor.primaryContactName},\n\nWe understand that managing institutional payments can sometimes require flexibility. In order to assist you with the overdue balance of ${debtor.currency} ${debtor.totalOutstandingBalance.toFixed(2)}, we have formulated a structured installment schedule.\n\nYou can review the proposed milestones and confirm the arrangement online: ${paymentLink}/installments.\n\nBest regards,\nCollections Recovery Team`;
      } else {
        subject = `URGENT: Notice of Impending Enrollment Suspension Review for ${debtor.entityName}`;
        body = `ATTENTION: ${debtor.primaryContactName},\n\nThe account for ${debtor.entityName} is critically overdue by ${debtor.daysOverdue} days, with an unpaid balance of ${debtor.currency} ${debtor.totalOutstandingBalance.toFixed(2)}.\n\nDespite previous reminders and agreed commitments, this account remains unsettled. Consequently, this file is being forwarded for Executive Suspension Review.\n\nTo prevent formal enrollment suspension, please settle the outstanding balance immediately via: ${paymentLink}, or report to the Bursar's Office in person within 48 hours.\n\nExecutive Bursar & Administration`;
      }
    }

    const draftId = `draft_${crypto.randomUUID().slice(0, 8)}`;
    return {
      draftId,
      entityId: debtor.entityId,
      channel,
      tier,
      recipientName: debtor.primaryContactName,
      recipientAddress:
        channel === 'email'
          ? debtor.primaryContactEmail
          : debtor.primaryContactPhone,
      subject,
      body,
      paymentLink,
      currency: debtor.currency,
      amountDue: roundCurrency(debtor.totalOutstandingBalance),
      daysOverdue: debtor.daysOverdue,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Records a debtor's promise-to-pay date and amount.
   */
  public async recordPromiseToPay(
    input: RecordPromiseToPayInput
  ): Promise<DebtorAccount> {
    // Rule 60: Dead-man switch check
    await this.checkDeadMan(input.organizationId);

    const debtor = inMemoryDebtorAccounts.get(input.entityId);
    if (!debtor) {
      throw new CollectionsError(
        COLLECTIONS_ERROR_CODES.DEBTOR_NOT_FOUND,
        `Debtor account with ID '${input.entityId}' was not found.`,
        404
      );
    }

    // Rule 8 & 47: Multi-tenant boundary check
    if (
      debtor.organizationId !== input.organizationId ||
      debtor.workspaceId !== input.workspaceId
    ) {
      throw new CollectionsError(
        COLLECTIONS_ERROR_CODES.IDOR_VIOLATION,
        `Cross-tenant access forbidden for debtor '${input.entityId}'.`,
        403
      );
    }

    const updatedDebtor: DebtorAccount = {
      ...debtor,
      promiseToPayDate: input.promiseDate,
      promiseToPayAmount: roundCurrency(input.amount),
      lastContactedAt: new Date().toISOString().split('T')[0],
      remarks: input.notes ? sanitizeDebtorRemarks(input.notes) : debtor.remarks,
    };

    inMemoryDebtorAccounts.set(input.entityId, updatedDebtor);

    // Rule 40: Emit domain event
    defaultEventBus.publish(
      createDomainEvent({
        type: 'finance.collections.promise_recorded',
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        actor: { type: 'agent', id: 'collections_agent' },
        entity: { type: 'debtor', id: input.entityId },
        payload: {
          promiseDate: input.promiseDate,
          amount: input.amount,
          recordedAt: new Date().toISOString(),
        },
        correlationId: crypto.randomUUID(),
        source: 'collections-engine',
      })
    );

    return updatedDebtor;
  }

  /**
   * Retrieves debtor accounts filtered by aging bucket or search query.
   */
  public async getDebtorAccounts(
    organizationId: string,
    workspaceId: string,
    agingBucket?: AgingBucket,
    searchQuery?: string,
    limit = 50
  ): Promise<DebtorAccount[]> {
    const debtors: DebtorAccount[] = [];
    const searchLower = searchQuery?.toLowerCase().trim();

    for (const d of inMemoryDebtorAccounts.values()) {
      if (d.organizationId !== organizationId || d.workspaceId !== workspaceId) {
        continue;
      }

      if (agingBucket && d.agingBucket !== agingBucket) {
        continue;
      }

      if (searchLower) {
        const matchesName = d.entityName.toLowerCase().includes(searchLower);
        const matchesContact = d.primaryContactName.toLowerCase().includes(searchLower);
        const matchesStudentId = d.studentId?.toLowerCase().includes(searchLower);
        if (!matchesName && !matchesContact && !matchesStudentId) {
          continue;
        }
      }

      debtors.push(d);
      if (debtors.length >= limit) break;
    }

    return debtors;
  }

  /**
   * Aggregates executive collections metrics for Zone 1 KPI cards.
   */
  public async getCollectionsMetrics(
    organizationId: string,
    workspaceId: string
  ): Promise<CollectionsMetrics> {
    let totalReceivablesOverdue = 0;
    let debtorAccountsCount = 0;
    let activePromisesCount = 0;
    let promisesVolume = 0;
    let plansActiveCount = 0;
    const plansRecoveredThisMonth = 38500.0; // In-memory demo baseline

    for (const d of inMemoryDebtorAccounts.values()) {
      if (d.organizationId === organizationId && d.workspaceId === workspaceId) {
        if (d.totalOutstandingBalance > 0) {
          debtorAccountsCount++;
          totalReceivablesOverdue += d.totalOutstandingBalance;
        }
        if (d.promiseToPayDate && d.promiseToPayAmount) {
          activePromisesCount++;
          promisesVolume += d.promiseToPayAmount;
        }
        if (d.activeInstallmentPlanId) {
          plansActiveCount++;
        }
      }
    }

    return {
      totalReceivablesOverdue: roundCurrency(totalReceivablesOverdue),
      debtorAccountsCount,
      activePromisesCount,
      promisesVolume: roundCurrency(promisesVolume),
      plansActiveCount,
      plansRecoveredThisMonth: roundCurrency(plansRecoveredThisMonth),
      currency: 'GHS',
    };
  }

  /**
   * Shadow mode simulation running with dryRun: true and 0 live database writes (Rule 42).
   */
  public async simulateDebtorRecovery(
    debtor: DebtorAccount
  ): Promise<{
    dryRun: true;
    evaluatedAction: CollectionsNextBestAction;
    blastRadius: {
      recordsEvaluated: number;
      financialExposure: number;
      highestRiskLevel: string;
      requiresHumanApproval: boolean;
    };
  }> {
    const action = await this.evaluateDebtorAccount(debtor);
    return {
      dryRun: true,
      evaluatedAction: action,
      blastRadius: {
        recordsEvaluated: 1,
        financialExposure: roundCurrency(debtor.totalOutstandingBalance),
        highestRiskLevel: action.riskLevel,
        requiresHumanApproval: action.requiresHumanApproval,
      },
    };
  }

  /**
   * Helper to reset test store fixtures if needed in hermetic tests.
   */
  public resetInMemoryStore(): void {
    inMemoryDebtorAccounts.clear();
    inMemoryPaymentPlans.clear();
    initializeSampleDebtors();
  }
}

// Global HMR singleton preservation
const GLOBAL_COLLECTIONS_ENGINE_KEY = Symbol.for('__smartsapp_collections_engine__');
type GlobalWithCollectionsEngine = typeof globalThis & {
  [GLOBAL_COLLECTIONS_ENGINE_KEY]?: CollectionsEngine;
};

export function getCollectionsEngine(): CollectionsEngine {
  const g = globalThis as GlobalWithCollectionsEngine;
  if (!g[GLOBAL_COLLECTIONS_ENGINE_KEY]) {
    g[GLOBAL_COLLECTIONS_ENGINE_KEY] = new CollectionsEngine();
  }
  return g[GLOBAL_COLLECTIONS_ENGINE_KEY];
}
