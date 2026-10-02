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
}

/** Non-delegable permissions that an agent or sub-agent can never automatically inherit */
export const NON_DELEGABLE_ACTIONS = [
  'admin.grant_permission',
  'admin.rotate_credentials',
  'admin.change_tenant_isolation',
  'admin.disable_audit_logging',
  'billing.change_owner',
  'organization.delete',
  'workspace.delete',
  // Canonical coordinates (PR-2 / D6 alignment)
  'app:system_admin',
  'app:contracts_delete',
  'rbac:management.users.edit',
  'rbac:management.users.delete',
  'rbac:finance.agreements.delete',
] as const;

export type NonDelegableAction = (typeof NON_DELEGABLE_ACTIONS)[number];

export function isNonDelegableAction(actionId: string): boolean {
  const normalized = actionId.trim().toLowerCase();
  return (NON_DELEGABLE_ACTIONS as readonly string[]).some(
    (nonDelegable) =>
      normalized === nonDelegable ||
      normalized.startsWith(`${nonDelegable}:`) ||
      normalized.startsWith(`${nonDelegable}.`)
  );
}

