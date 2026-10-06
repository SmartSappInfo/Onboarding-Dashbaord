/**
 * @fileOverview Capability Risk Classification & Execution Policy (Phase 0)
 *
 * Implements Rule 12, Rule 17, and Rule 21 of SmartSapp Agentic Development Rules.
 * Every capability has a server-side verified risk classification that controls
 * execution autonomy, delegation, and human approval gates.
 */

/**
 * The ONE canonical risk scale (one name per level). The roadmap (read/reversible/…), PRD
 * (read…critical) and tools doc (R0–R4) scales map onto it as documented in
 * docs/agentic/05-permission-model.md. Do not add aliases: two names for one level lets
 * code compare against the wrong string and silently skip an approval gate.
 */
export const RISK_LEVELS = [
  'L0_READ',
  'L1_INTERNAL_DRAFT',
  'L2_STATE_MUTATION',
  'L3_EXTERNAL_COMMUNICATION_FINANCE',
  'L4_PRIVILEGED_DESTRUCTIVE',
] as const;

export type RiskLevel = (typeof RISK_LEVELS)[number];

/**
 * Numeric rank/weight for comparing risk levels deterministically (Rule 12).
 */
export const RISK_LEVEL_WEIGHTS: Readonly<Record<RiskLevel, number>> = {
  L0_READ: 0,
  L1_INTERNAL_DRAFT: 1,
  L2_STATE_MUTATION: 2,
  L3_EXTERNAL_COMMUNICATION_FINANCE: 3,
  L4_PRIVILEGED_DESTRUCTIVE: 4,
};

export function isHighRiskLevel(level: RiskLevel): boolean {
  return level === 'L3_EXTERNAL_COMMUNICATION_FINANCE' || level === 'L4_PRIVILEGED_DESTRUCTIVE';
}

/** Whether an automated/delegated principal needs a verified human approval (Rules 21, 22). */
export function requiresAgentApproval(risk: Pick<RiskMetadata, 'level' | 'requiresHumanApproval'>): boolean {
  return risk.requiresHumanApproval || isHighRiskLevel(risk.level);
}

export interface RiskMetadata {
  level: RiskLevel;
  /** Whether the operation performs permanent or hard data deletion */
  destructive: boolean;
  /** Whether multiple identical executions produce the same state */
  idempotent: boolean;
  /** Whether the capability queries un-sandboxed external services */
  openWorld: boolean;
  /** High-risk operations (L3/L4) that require human approval before execution */
  requiresHumanApproval: boolean;
  /** Non-delegable operations that cannot be inherited by sub-agents (Rule 17) */
  nonDelegable: boolean;
  /** Optional Saga compensating capability ID to rollback this operation (Rule 27) */
  compensatingCapabilityId?: string;
}

/**
 * Permissions an agent or sub-agent can never exercise on a user's behalf (Rule 17).
 *
 * SECURITY (agents_mcp PR-2): these are D6 permission references (`permission-refs.ts`). The old
 * list used ids like `admin.grant_permission` that match no permission in the app, so it never
 * blocked anything. A test asserts every entry resolves in the vocabulary.
 */
export const NON_DELEGABLE_ACTIONS = [
  // Platform-level authority
  'app:system_admin',
  'app:system_user_switch',
  // Deciding agent proposals (Phase 11 M0 · T2): an agent must never approve agent actions
  'app:agent_approvals_decide',
  // Destroying signed agreements
  'app:contracts_delete',
  'rbac:finance.agreements.delete',
  // Granting or removing access
  'rbac:workforce.roles.edit',
  'rbac:workforce.users.create',
  'rbac:workforce.users.edit',
  'rbac:workforce.users.delete',
  'rbac:management.users.create',
  'rbac:management.users.edit',
  'rbac:management.users.delete',
  // Credentials, data egress, tenant and audit settings
  'rbac:management.developerApi.edit',
  'rbac:management.webhooks.create',
  'rbac:management.webhooks.edit',
  'rbac:management.systemSettings.edit',
  // Billing ownership
  'rbac:finance.billingSetup.edit',
] as const;

export type NonDelegableAction = (typeof NON_DELEGABLE_ACTIONS)[number];

const LEGACY_NON_DELEGABLE_ACTIONS = [
  // Bare flat id as it appears in session scopes (Phase 11 M0 · T2).
  'agent_approvals_decide',
  'admin.grant_permission',
  'admin.rotate_credentials',
  'admin.change_tenant_isolation',
  'admin.disable_audit_logging',
  'billing.change_owner',
  'organization.delete',
  'workspace.delete',
] as const;

export function isNonDelegableAction(actionId: string): boolean {
  const normalized = actionId.trim();
  return (
    (NON_DELEGABLE_ACTIONS as readonly string[]).includes(normalized) ||
    (LEGACY_NON_DELEGABLE_ACTIONS as readonly string[]).includes(normalized)
  );
}

