'use server';

/**
 * @fileOverview Governed Security, Adversarial Red-Team & Chaos Server Actions (Phase 15 Milestone 3)
 *
 * Implements Rules 4, 8, 10, 13, 14, 16, 17, 19, 22, 24, 27, 30, 40, 45, 46, 47, 48, 51, 60, 67, 68, 69.
 * Provides authenticated, Anti-IDOR protected, dead-man gated Server Actions for:
 * - Scanning untrusted ingress text across 10 vectors
 * - Running automated 10-vector red-team adversarial suites
 * - Ingesting and managing synthetic chaos fault rules
 * - Verifying live tool fingerprints against approved baselines
 * - Non-delegable human approval of drifted tool definitions (Rule 17)
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { requireAuth, type AuthContext } from '@/lib/auth/require-auth';
import {
  checkGovernanceDeadManSwitch,
  AgentGovernanceEmergencyPausedError,
} from '@/platform/policy/governance-dead-man';
import {
  AdversarialScanResult,
  ChaosFaultRule,
  ChaosFaultRuleSchema,
  ToolFingerprintRecord,
  SecurityDomainError,
} from '@/platform/security/contracts/security-types';
import {
  SecurityScanTextInput,
  SecurityScanTextInputSchema,
  SecurityRunAdversarialSuiteInput,
  SecurityRunAdversarialSuiteInputSchema,
  SecurityVerifyToolDriftInput,
  SecurityVerifyToolDriftInputSchema,
  SecurityVerifyToolDriftOutput,
  SecurityApproveToolFingerprintInput,
  SecurityApproveToolFingerprintInputSchema,
} from '@/platform/capabilities/security/security-capabilities';
import { getAdversarialScanner } from '@/platform/security/adversarial/adversarial-scanner';
import {
  getAdversarialInjectionRunner,
  AdversarialBatteryReport,
} from '@/platform/security/adversarial/adversarial-injection-runner';
import { getChaosInjectionEngine } from '@/platform/resilience/chaos/chaos-injection-engine';
import { getToolDriftMonitor } from '@/platform/security/drift/tool-drift-monitor';

export interface SecurityActionResult<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: {
    readonly code: string;
    readonly message: string;
  };
}

/**
 * Validates authenticated user organizational boundary against target organization (Rules 8 & 47).
 */
function assertTenantAccess(
  auth: AuthContext,
  targetOrganizationId?: string | null
): void {
  if (!targetOrganizationId) return;

  const userOrgId =
    auth.profile?.organizationId ||
    (auth as unknown as { organizationId?: string }).organizationId;
  if (!userOrgId || userOrgId !== targetOrganizationId) {
    throw new SecurityDomainError(
      'SECURITY_IDOR_VIOLATION',
      `Anti-IDOR Violation: Access denied across organizational boundaries (user: ${userOrgId}, target: ${targetOrganizationId})`,
      403
    );
  }
}

/**
 * 1. Scans untrusted input text for adversarial directives and credential leakage.
 */
export async function scanTextAction(
  input: SecurityScanTextInput
): Promise<SecurityActionResult<AdversarialScanResult>> {
  try {
    await requireAuth();
    const validated = SecurityScanTextInputSchema.parse(input);

    const scanner = getAdversarialScanner();
    const result = scanner.scanText({
      text: validated.text,
      source: validated.source,
      referenceId: validated.referenceId,
      sanitizeSecrets: validated.sanitizeSecrets,
    });

    return { success: true, data: result };
  } catch (error) {
    return handleError(error, 'Failed to scan text for adversarial directives');
  }
}

/**
 * 2. Executes automated 10-vector adversarial red-team battery in dry-run mode.
 */
export async function runAdversarialSuiteAction(
  input: SecurityRunAdversarialSuiteInput
): Promise<SecurityActionResult<AdversarialBatteryReport>> {
  try {
    const auth = await requireAuth();
    const validated = SecurityRunAdversarialSuiteInputSchema.parse(input);
    assertTenantAccess(auth, validated.organizationId);

    const runner = getAdversarialInjectionRunner();
    const report = await runner.runBattery({
      dryRun: validated.dryRun,
      organizationId: validated.organizationId,
      workspaceId: validated.workspaceId,
    });

    return { success: true, data: report };
  } catch (error) {
    return handleError(error, 'Failed to execute adversarial red-team battery');
  }
}

/**
 * 3. Injects a synthetic chaos fault rule (Gated by dead-man switch & Anti-IDOR).
 */
export async function injectChaosFaultAction(
  input: ChaosFaultRule
): Promise<SecurityActionResult<{ ruleId: string; success: boolean }>> {
  try {
    const auth = await requireAuth();

    // Emergency Dead-Man Switch Evaluation (Rule 60)
    await checkGovernanceDeadManSwitch();

    const ruleToValidate = {
      ...input,
      createdByUserId: input.createdByUserId || auth.uid,
    };
    const validated = ChaosFaultRuleSchema.parse(ruleToValidate);

    // Anti-IDOR Tenant Check
    const targetOrg =
      validated.organizationId ||
      (validated.metadata?.organizationId as string | undefined);
    assertTenantAccess(auth, targetOrg);

    const engine = getChaosInjectionEngine();
    engine.registerRule(validated);

    return {
      success: true,
      data: {
        ruleId: validated.id,
        success: true,
      },
    };
  } catch (error) {
    return handleError(error, 'Failed to inject chaos fault rule');
  }
}

/**
 * 4. Verifies live tool definition against approved cryptographic SHA-256 fingerprint baseline.
 */
export async function verifyToolDriftAction(
  input: SecurityVerifyToolDriftInput
): Promise<SecurityActionResult<SecurityVerifyToolDriftOutput>> {
  try {
    const auth = await requireAuth();
    const validated = SecurityVerifyToolDriftInputSchema.parse(input);
    assertTenantAccess(auth, validated.organizationId);

    const monitor = getToolDriftMonitor();
    const result = await monitor.verifyToolFingerprint(
      validated.toolId,
      validated.liveDefinition,
      {
        organizationId: validated.organizationId,
        workspaceId: validated.workspaceId,
      }
    );

    return {
      success: true,
      data: {
        toolId: result.toolId,
        status: result.status,
        hasDrift: result.hasDrift,
        isExecutionPermitted: result.isExecutionPermitted,
      },
    };
  } catch (error) {
    return handleError(error, 'Failed to verify tool definition drift');
  }
}

/**
 * 5. Approves updated tool fingerprint baseline snapshot.
 * Strictly non-delegable to agents (requires human administrator, Rule 17).
 */
export async function approveToolFingerprintAction(
  input: SecurityApproveToolFingerprintInput
): Promise<SecurityActionResult<ToolFingerprintRecord>> {
  try {
    const auth = await requireAuth();

    // Emergency Dead-Man Switch Evaluation (Rule 60)
    await checkGovernanceDeadManSwitch();

    const validated = SecurityApproveToolFingerprintInputSchema.parse(input);
    assertTenantAccess(auth, validated.organizationId);

    const monitor = getToolDriftMonitor();
    const record = await monitor.approveToolFingerprint({
      toolId: validated.toolId,
      definition: validated.definition,
      actor: { type: 'user', id: auth.uid },
      organizationId: validated.organizationId,
      workspaceId: validated.workspaceId,
    });

    return { success: true, data: record };
  } catch (error) {
    return handleError(error, 'Failed to approve tool fingerprint baseline');
  }
}

// ── Error Sanitizer & Handler ───────────────────────────────────────────────

function handleError<T>(error: unknown, fallbackMessage: string): SecurityActionResult<T> {
  if (
    error instanceof AgentGovernanceEmergencyPausedError ||
    (typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      (error as { name: string }).name === 'AgentGovernanceEmergencyPausedError')
  ) {
    return {
      success: false,
      error: {
        code: 'SECURITY_DEAD_MAN_PAUSED',
        message:
          'Security and resilience operations temporarily paused by emergency governance dead-man switch (Rule 60).',
      },
    };
  }

  if (
    error instanceof SecurityDomainError ||
    (typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof (error as { code: string }).code === 'string' &&
      (error as { code: string }).code.startsWith('SECURITY_'))
  ) {
    const err = error as { code: string; message: string };
    return {
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
    };
  }

  const message = error instanceof Error ? error.message : fallbackMessage;
  return {
    success: false,
    error: {
      code: 'SECURITY_INTERNAL_ERROR',
      message,
    },
  };
}
