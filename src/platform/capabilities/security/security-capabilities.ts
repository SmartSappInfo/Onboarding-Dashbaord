/**
 * @fileOverview Canonical Security & Chaos Capabilities (Phase 15 Milestone 3)
 *
 * Implements Rules 1, 4, 8, 12, 14, 16, 17, 19, 22, 24, 27, 40, 45, 46, 47, 48, 60, 67, 68, 69.
 * Exposes canonical capabilities for:
 * 1. `security.scan_text` (L0_READ)
 * 2. `security.run_adversarial_suite` (L0_READ)
 * 3. `chaos.inject_fault` (L2_STATE_MUTATION)
 * 4. `security.verify_tool_drift` (L0_READ)
 * 5. `security.approve_tool_fingerprint` (L2_STATE_MUTATION, Non-Delegable, Rule 17)
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { z } from 'zod/v4';
import {
  type CapabilityDefinition,
  type CapabilityExecutionContext,
  type CapabilityExecutionResult,
} from '../contracts/capability-definition';
import { registerCapability } from '../registry/capability-registry';
import {
  AdversarialIngressVectorSchema,
  AdversarialAttackPayloadSchema,
  AdversarialScanResultSchema,
  AdversarialScanResult,
  ChaosFaultRuleSchema,
  ChaosFaultRule,
  ToolFingerprintStatusSchema,
  ToolFingerprintRecordSchema,
  ToolFingerprintRecord,
  SecurityDomainError,
} from '@/platform/security/contracts/security-types';
import { getAdversarialScanner } from '@/platform/security/adversarial/adversarial-scanner';
import {
  getAdversarialInjectionRunner,
  AdversarialBatteryReport,
} from '@/platform/security/adversarial/adversarial-injection-runner';
import { getChaosInjectionEngine } from '@/platform/resilience/chaos/chaos-injection-engine';
import { getToolDriftMonitor } from '@/platform/security/drift/tool-drift-monitor';

/**
 * Validates caller tenant context against target organization (Rules 8 & 47).
 */
function assertTenantContext(
  context: CapabilityExecutionContext,
  organizationId: string
): void {
  if (
    context.principal.organizationId &&
    context.principal.organizationId !== organizationId
  ) {
    throw new SecurityDomainError(
      'SECURITY_IDOR_VIOLATION',
      `Anti-IDOR Violation: Access denied across organizational boundary (principal: ${context.principal.organizationId}, target: ${organizationId})`,
      403
    );
  }
}

// ── 1. security.scan_text ────────────────────────────────────────────────────

export const SecurityScanTextInputSchema = z.object({
  text: z.string().min(1),
  source: AdversarialIngressVectorSchema.default('CUSTOMER_CHAT'),
  referenceId: z.string().optional(),
  sanitizeSecrets: z.boolean().default(true),
});
export type SecurityScanTextInput = z.infer<typeof SecurityScanTextInputSchema>;

export const securityScanTextCapability: CapabilityDefinition<
  SecurityScanTextInput,
  AdversarialScanResult
> = {
  id: 'security.scan_text',
  version: '1.0.0',
  domain: 'ai_governance',
  description:
    'Scans untrusted input text across 10 ingress vectors for prompt injection directives, isolates malicious text in XML containers, and masks sensitive credentials in flight.',
  risk: {
    level: 'L0_READ',
    destructive: false,
    idempotent: true,
    requiresHumanApproval: false,
    nonDelegable: false,
  },
  permissions: ['security:read'],
  inputSchema: SecurityScanTextInputSchema,
  outputSchema: AdversarialScanResultSchema,
  policies: {
    requiresIdempotencyKey: false,
    auditRequired: false,
  },
  async execute(
    input: SecurityScanTextInput,
    _context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<AdversarialScanResult>> {
    const scanner = getAdversarialScanner();
    const result = scanner.scanText({
      text: input.text,
      source: input.source,
      referenceId: input.referenceId,
      sanitizeSecrets: input.sanitizeSecrets,
    });

    return {
      status: 'SUCCESS',
      data: result,
      audit: {
        summary: `Scanned text from ${input.source} (injection detected: ${result.isInjectionDetected})`,
      },
    };
  },
};

// ── 2. security.run_adversarial_suite ────────────────────────────────────────

export const SecurityRunAdversarialSuiteInputSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().optional(),
  dryRun: z.boolean().default(true),
});
export type SecurityRunAdversarialSuiteInput = z.infer<
  typeof SecurityRunAdversarialSuiteInputSchema
>;

export const AdversarialBatteryReportSchema = z.object({
  totalAttacks: z.number(),
  neutralizedCount: z.number(),
  failedCount: z.number(),
  successRatePercent: z.number(),
  vectorResults: z.array(
    z.object({
      payload: AdversarialAttackPayloadSchema,
      scanResult: AdversarialScanResultSchema,
      neutralized: z.boolean(),
      latencyMs: z.number(),
    })
  ),
  executedAt: z.string().datetime(),
  organizationId: z.string(),
  dryRun: z.boolean(),
});

export const securityRunAdversarialSuiteCapability: CapabilityDefinition<
  SecurityRunAdversarialSuiteInput,
  AdversarialBatteryReport
> = {
  id: 'security.run_adversarial_suite',
  version: '1.0.0',
  domain: 'ai_governance',
  description:
    'Executes automated red-team adversarial injection suite across all 10 canonical ingress vectors in dry-run mode, verifying 100% neutralization.',
  risk: {
    level: 'L0_READ',
    destructive: false,
    idempotent: true,
    requiresHumanApproval: false,
    nonDelegable: false,
  },
  permissions: ['security:read'],
  inputSchema: SecurityRunAdversarialSuiteInputSchema,
  outputSchema: AdversarialBatteryReportSchema,
  policies: {
    requiresIdempotencyKey: false,
    auditRequired: true,
  },
  async execute(
    input: SecurityRunAdversarialSuiteInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<AdversarialBatteryReport>> {
    assertTenantContext(context, input.organizationId);

    const runner = getAdversarialInjectionRunner();
    const report = await runner.runBattery({
      dryRun: input.dryRun,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
    });

    return {
      status: 'SUCCESS',
      data: report,
      audit: {
        summary: `Executed 10-vector red-team battery for org ${input.organizationId} (success rate: ${report.successRatePercent}%)`,
      },
    };
  },
};

// ── 3. chaos.inject_fault ───────────────────────────────────────────────────

export const ChaosInjectFaultOutputSchema = z.object({
  ruleId: z.string(),
  success: z.boolean(),
});
export type ChaosInjectFaultOutput = z.infer<typeof ChaosInjectFaultOutputSchema>;

export const chaosInjectFaultCapability: CapabilityDefinition<
  ChaosFaultRule,
  ChaosInjectFaultOutput
> = {
  id: 'chaos.inject_fault',
  version: '1.0.0',
  domain: 'ai_governance',
  description:
    'Registers and activates synthetic chaos fault injection rule for resilience testing against 429 rate limits, 500 downtime, latency jitter, concurrency collisions, or partial saga failures.',
  risk: {
    level: 'L2_STATE_MUTATION',
    destructive: false,
    idempotent: true,
    requiresHumanApproval: true,
    nonDelegable: false,
  },
  permissions: ['chaos:inject'],
  inputSchema: ChaosFaultRuleSchema,
  outputSchema: ChaosInjectFaultOutputSchema,
  policies: {
    requiresIdempotencyKey: true,
    auditRequired: true,
  },
  async execute(
    input: ChaosFaultRule,
    _context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<ChaosInjectFaultOutput>> {
    const engine = getChaosInjectionEngine();
    engine.registerRule(input);

    return {
      status: 'SUCCESS',
      data: {
        ruleId: input.id,
        success: true,
      },
      audit: {
        summary: `Injected chaos fault '${input.faultType}' on capability '${input.targetCapabilityId}' (rule: ${input.id})`,
      },
    };
  },
};

// ── 4. security.verify_tool_drift ───────────────────────────────────────────

export const SecurityVerifyToolDriftInputSchema = z.object({
  toolId: z.string().min(1),
  liveDefinition: z.object({
    toolId: z.string().min(1),
    serverId: z.string().min(1),
    serverVersion: z.string().min(1),
    toolVersion: z.string().min(1),
    inputSchema: z.unknown(),
    description: z.string().min(1),
    permissions: z.array(z.string()),
    risk: z.unknown(),
  }),
  organizationId: z.string().min(1),
  workspaceId: z.string().optional(),
});
export type SecurityVerifyToolDriftInput = z.infer<
  typeof SecurityVerifyToolDriftInputSchema
>;

export const SecurityVerifyToolDriftOutputSchema = z.object({
  toolId: z.string(),
  status: ToolFingerprintStatusSchema,
  hasDrift: z.boolean(),
  isExecutionPermitted: z.boolean(),
});
export type SecurityVerifyToolDriftOutput = z.infer<
  typeof SecurityVerifyToolDriftOutputSchema
>;

export const securityVerifyToolDriftCapability: CapabilityDefinition<
  SecurityVerifyToolDriftInput,
  SecurityVerifyToolDriftOutput
> = {
  id: 'security.verify_tool_drift',
  version: '1.0.0',
  domain: 'ai_governance',
  description:
    'Verifies live tool definition against approved cryptographic SHA-256 fingerprint baseline to detect definition drift and rug-pulls.',
  risk: {
    level: 'L0_READ',
    destructive: false,
    idempotent: true,
    requiresHumanApproval: false,
    nonDelegable: false,
  },
  permissions: ['security:read'],
  inputSchema: SecurityVerifyToolDriftInputSchema,
  outputSchema: SecurityVerifyToolDriftOutputSchema,
  policies: {
    requiresIdempotencyKey: false,
    auditRequired: false,
  },
  async execute(
    input: SecurityVerifyToolDriftInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<SecurityVerifyToolDriftOutput>> {
    assertTenantContext(context, input.organizationId);

    const monitor = getToolDriftMonitor();
    const result = await monitor.verifyToolFingerprint(
      input.toolId,
      input.liveDefinition,
      { organizationId: input.organizationId, workspaceId: input.workspaceId }
    );

    return {
      status: 'SUCCESS',
      data: {
        toolId: result.toolId,
        status: result.status,
        hasDrift: result.hasDrift,
        isExecutionPermitted: result.isExecutionPermitted,
      },
      audit: {
        summary: `Verified tool fingerprint for '${input.toolId}' (status: ${result.status}, drift: ${result.hasDrift})`,
      },
    };
  },
};

// ── 5. security.approve_tool_fingerprint ────────────────────────────────────

export const SecurityApproveToolFingerprintInputSchema = z.object({
  toolId: z.string().min(1),
  definition: z.object({
    toolId: z.string().min(1),
    serverId: z.string().min(1),
    serverVersion: z.string().min(1),
    toolVersion: z.string().min(1),
    inputSchema: z.unknown(),
    description: z.string().min(1),
    permissions: z.array(z.string()),
    risk: z.unknown(),
  }),
  organizationId: z.string().min(1),
  workspaceId: z.string().optional(),
  idempotencyKey: z.string().min(1),
});
export type SecurityApproveToolFingerprintInput = z.infer<
  typeof SecurityApproveToolFingerprintInputSchema
>;

export const securityApproveToolFingerprintCapability: CapabilityDefinition<
  SecurityApproveToolFingerprintInput,
  ToolFingerprintRecord
> = {
  id: 'security.approve_tool_fingerprint',
  version: '1.0.0',
  domain: 'ai_governance',
  description:
    'Approves updated tool fingerprint baseline snapshot. Strictly non-delegable: only human administrators may approve (Rule 17).',
  risk: {
    level: 'L2_STATE_MUTATION',
    destructive: false,
    idempotent: true,
    requiresHumanApproval: true,
    nonDelegable: true,
  },
  permissions: ['security:manage'],
  inputSchema: SecurityApproveToolFingerprintInputSchema,
  outputSchema: ToolFingerprintRecordSchema,
  policies: {
    requiresIdempotencyKey: true,
    auditRequired: true,
  },
  async execute(
    input: SecurityApproveToolFingerprintInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<ToolFingerprintRecord>> {
    assertTenantContext(context, input.organizationId);

    // Rule 17 Non-Delegable Check
    if (context.principal.type !== 'user') {
      throw new SecurityDomainError(
        'SECURITY_UNAUTHORIZED_APPROVAL',
        `Agent principal '${context.principal.id}' cannot approve tool fingerprint. Only human administrators can re-approve tool baselines.`,
        403
      );
    }

    const monitor = getToolDriftMonitor();
    const record = await monitor.approveToolFingerprint({
      toolId: input.toolId,
      definition: input.definition,
      actor: { type: context.principal.type, id: context.principal.id },
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
    });

    return {
      status: 'SUCCESS',
      data: record,
      audit: {
        summary: `Approved tool fingerprint baseline for '${input.toolId}' (fingerprint: ${record.compositeFingerprint.slice(0, 12)}...)`,
      },
    };
  },
};

// ── Registration Function ───────────────────────────────────────────────────

export function registerSecurityCapabilities(): void {
  registerCapability(securityScanTextCapability);
  registerCapability(securityRunAdversarialSuiteCapability);
  registerCapability(chaosInjectFaultCapability);
  registerCapability(securityVerifyToolDriftCapability);
  registerCapability(securityApproveToolFingerprintCapability);
}

// Auto-register on import
registerSecurityCapabilities();
