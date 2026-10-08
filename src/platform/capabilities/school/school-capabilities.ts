/**
 * @fileOverview Canonical School Operations Capabilities (school.*)
 *
 * Implements:
 * - Rule 1 (Canonical Capability Layer)
 * - Rule 4 (Strict Typing: zero any/any[])
 * - Rule 8 & 47 (Anti-IDOR Multi-Tenant Scoping)
 * - Rule 11 (Mathematical determinism in attendance anomaly & fee correlation)
 * - Rule 12 (Canonical risk taxonomy: L0_READ, L1_INTERNAL_DRAFT)
 * - Rule 13 & 30 (XML reference isolation & Prompt Injection defense)
 * - Rule 40 (Mandatory Domain Event Publishing)
 * - Rule 60 (Emergency Dead-Man Switch Evaluation)
 * - Rule 69 (Strangler Fig Invariant)
 */

import { z } from 'zod/v4';
import {
  type CapabilityDefinition,
  type CapabilityExecutionContext,
  type CapabilityExecutionResult,
} from '../contracts/capability-definition';
import { registerCapability } from '../registry/capability-registry';
import { createDomainEvent } from '../events/domain-event';
import { checkGovernanceDeadManSwitch } from '@/platform/policy/governance-dead-man';
import {
  StudentAttendanceSummary,
  StudentAttendanceSummarySchema,
  StudentFeeStatus,
  AttendanceAnomalyResult,
  AttendanceAnomalyResultSchema,
  FeeAttendanceCorrelation,
  FeeAttendanceCorrelationSchema,
  DraftParentBriefInput,
  ParentCommunicationBrief,
  ParentCommunicationBriefSchema,
  SchoolOperationsError,
} from '../../agents/school/school-operations-types';
import { getSchoolOperationsService } from '../../agents/school/school-operations-service';

// Helper to enforce Anti-IDOR tenant scoping (Rules 8 & 47)
function assertTenantContext(
  context: CapabilityExecutionContext,
  organizationId: string
): void {
  if (
    context.principal.organizationId &&
    context.principal.organizationId !== organizationId
  ) {
    throw new SchoolOperationsError(
      'CROSS_TENANT_ACCESS_DENIED',
      `Anti-IDOR Violation: Access denied across organizational boundary (principal: ${context.principal.organizationId}, target: ${organizationId})`,
      403
    );
  }
}

// ============================================================================
// 1. school.attendance.get_report (L0_READ)
// ============================================================================

export const SchoolAttendanceGetReportInputSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  studentId: z.string().optional(),
  termId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export type SchoolAttendanceGetReportInput = z.infer<typeof SchoolAttendanceGetReportInputSchema>;

export const SchoolAttendanceGetReportOutputSchema = z.object({
  records: z.array(StudentAttendanceSummarySchema),
  totalCount: z.number(),
  asOfDate: z.string(),
});

export type SchoolAttendanceGetReportOutput = z.infer<typeof SchoolAttendanceGetReportOutputSchema>;

export const schoolAttendanceGetReportCapability: CapabilityDefinition<
  SchoolAttendanceGetReportInput,
  SchoolAttendanceGetReportOutput
> = {
  id: 'school.attendance.get_report',
  version: '1.0.0',
  name: 'Get Student Attendance Report',
  description: 'Retrieves multi-student attendance records, unexcused absence ratios, and streak tracking.',
  domain: 'school_operations',
  operation: 'read',
  inputSchema: SchoolAttendanceGetReportInputSchema,
  outputSchema: SchoolAttendanceGetReportOutputSchema,
  permissions: ['rbac:operations.attendance.view'],
  workspaceScoped: true,
  tenantScoped: true,
  risk: {
    level: 'L0_READ',
    destructive: false,
    idempotent: true,
    openWorld: false,
    requiresHumanApproval: false,
    nonDelegable: false,
  },
  execution: {
    synchronous: true,
    maxDurationMs: 10000,
    supportsDryRun: true,
    supportsCancellation: true,
    supportsCompensation: false,
    maxPayloadSizeBytes: 1048576,
  },
  policies: {
    requiresIdempotencyKey: false,
    requiresExpectedVersion: false,
    auditRequired: false,
    defaultEnabled: true,
  },
  handler: async (
    input: SchoolAttendanceGetReportInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<SchoolAttendanceGetReportOutput>> => {
    const startTime = Date.now();
    assertTenantContext(context, input.organizationId);
    await checkGovernanceDeadManSwitch(context.principal.organizationId);

    const service = getSchoolOperationsService();
    const records = await service.getAttendanceReport(input);

    return {
      success: true,
      data: {
        records,
        totalCount: records.length,
        asOfDate: new Date().toISOString(),
      },
      executionId: `exec_${Date.now()}`,
      emittedEvents: [],
      durationMs: Date.now() - startTime,
    };
  },
};

// ============================================================================
// 2. school.attendance.correlate_fees (L0_READ)
// ============================================================================

export const SchoolAttendanceCorrelateFeesInputSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  studentId: z.string().min(1),
  termTuitionTotal: z.number().min(0),
  overdueTuitionBalance: z.number().min(0),
  unexcusedAbsences: z.number().int().min(0).default(0),
  totalSchoolDays: z.number().int().min(1).default(60),
  consecutiveUnexcusedDays: z.number().int().min(0).default(0),
  daysOverdue: z.number().int().min(0).default(0),
});

export type SchoolAttendanceCorrelateFeesInput = z.infer<typeof SchoolAttendanceCorrelateFeesInputSchema>;

export const schoolAttendanceCorrelateFeesCapability: CapabilityDefinition<
  SchoolAttendanceCorrelateFeesInput,
  FeeAttendanceCorrelation
> = {
  id: 'school.attendance.correlate_fees',
  version: '1.0.0',
  name: 'Correlate Fees and Attendance',
  description: 'Calculates pure mathematical fee-to-attendance correlation risk index and tuition stress.',
  domain: 'school_operations',
  operation: 'analyze',
  inputSchema: SchoolAttendanceCorrelateFeesInputSchema,
  outputSchema: FeeAttendanceCorrelationSchema,
  permissions: ['rbac:operations.attendance.view', 'rbac:finance.invoices.view'],
  workspaceScoped: true,
  tenantScoped: true,
  risk: {
    level: 'L0_READ',
    destructive: false,
    idempotent: true,
    openWorld: false,
    requiresHumanApproval: false,
    nonDelegable: false,
  },
  execution: {
    synchronous: true,
    maxDurationMs: 5000,
    supportsDryRun: true,
    supportsCancellation: true,
    supportsCompensation: false,
    maxPayloadSizeBytes: 524288,
  },
  policies: {
    requiresIdempotencyKey: false,
    requiresExpectedVersion: false,
    auditRequired: false,
    defaultEnabled: true,
  },
  handler: async (
    input: SchoolAttendanceCorrelateFeesInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<FeeAttendanceCorrelation>> => {
    const startTime = Date.now();
    assertTenantContext(context, input.organizationId);
    await checkGovernanceDeadManSwitch(context.principal.organizationId);

    const student: StudentAttendanceSummary = {
      studentId: input.studentId,
      studentName: 'Student',
      gradeLevel: 'General',
      className: 'General',
      workspaceId: input.workspaceId,
      organizationId: input.organizationId,
      totalSchoolDays: input.totalSchoolDays,
      presentDays: Math.max(0, input.totalSchoolDays - input.unexcusedAbsences),
      excusedAbsences: 0,
      unexcusedAbsences: input.unexcusedAbsences,
      unexcusedAbsences14d: Math.min(input.unexcusedAbsences, 14),
      unexcusedAbsences60d: input.unexcusedAbsences,
      consecutiveUnexcusedDays: input.consecutiveUnexcusedDays,
      remarks: '',
    };

    const fees: StudentFeeStatus = {
      studentId: input.studentId,
      termTuitionTotal: input.termTuitionTotal,
      overdueTuitionBalance: input.overdueTuitionBalance,
      currency: 'GHS',
      isFullyPaid: input.overdueTuitionBalance === 0,
      daysOverdue: input.daysOverdue || (input.overdueTuitionBalance > 0 ? 30 : 0),
    };

    const service = getSchoolOperationsService();
    const result = await service.calculateFeeAttendanceCorrelation(student, fees);

    return {
      success: true,
      data: result,
      executionId: `exec_${Date.now()}`,
      emittedEvents: [],
      durationMs: Date.now() - startTime,
    };
  },
};

// ============================================================================
// 3. school.attendance.flag_anomaly (L1_INTERNAL_DRAFT)
// ============================================================================

export const SchoolAttendanceFlagAnomalyInputSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  studentId: z.string().min(1),
  studentName: z.string().min(1),
  grade: z.string().default('General'),
  className: z.string().optional().default('General'),
  daysEnrolled: z.number().int().default(60),
  presentDays: z.number().int().default(45),
  excusedAbsences: z.number().int().default(0),
  unexcusedAbsences14d: z.number().int().default(0),
  unexcusedAbsences60d: z.number().int().default(0),
  consecutiveAbsences: z.number().int().default(0),
  overdueTuitionBalance: z.number().default(0),
  termTuitionTotal: z.number().default(0),
  remarks: z.string().optional().default(''),
});

export type SchoolAttendanceFlagAnomalyInput = z.infer<typeof SchoolAttendanceFlagAnomalyInputSchema>;

export const schoolAttendanceFlagAnomalyCapability: CapabilityDefinition<
  SchoolAttendanceFlagAnomalyInput,
  AttendanceAnomalyResult
> = {
  id: 'school.attendance.flag_anomaly',
  version: '1.0.0',
  name: 'Flag Attendance Anomaly',
  description: 'Analyzes student attendance velocity, streaks, and fee risks to draft an anomaly flag with explainability.',
  domain: 'school_operations',
  operation: 'draft',
  inputSchema: SchoolAttendanceFlagAnomalyInputSchema,
  outputSchema: AttendanceAnomalyResultSchema,
  permissions: ['rbac:operations.attendance.manage'],
  workspaceScoped: true,
  tenantScoped: true,
  risk: {
    level: 'L1_INTERNAL_DRAFT',
    destructive: false,
    idempotent: true,
    openWorld: false,
    requiresHumanApproval: false,
    nonDelegable: false,
  },
  execution: {
    synchronous: true,
    maxDurationMs: 10000,
    supportsDryRun: true,
    supportsCancellation: true,
    supportsCompensation: false,
    maxPayloadSizeBytes: 1048576,
  },
  policies: {
    requiresIdempotencyKey: false,
    requiresExpectedVersion: false,
    auditRequired: true,
    defaultEnabled: true,
  },
  handler: async (
    input: SchoolAttendanceFlagAnomalyInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<AttendanceAnomalyResult>> => {
    const startTime = Date.now();
    assertTenantContext(context, input.organizationId);
    await checkGovernanceDeadManSwitch(context.principal.organizationId);

    const student: StudentAttendanceSummary = {
      studentId: input.studentId,
      studentName: input.studentName,
      gradeLevel: input.grade,
      className: input.className ?? 'General',
      workspaceId: input.workspaceId,
      organizationId: input.organizationId,
      totalSchoolDays: input.daysEnrolled,
      presentDays: input.presentDays,
      excusedAbsences: input.excusedAbsences,
      unexcusedAbsences: input.unexcusedAbsences60d,
      unexcusedAbsences14d: input.unexcusedAbsences14d,
      unexcusedAbsences60d: input.unexcusedAbsences60d,
      consecutiveUnexcusedDays: input.consecutiveAbsences,
      remarks: input.remarks ?? '',
    };

    const fees: StudentFeeStatus | undefined = input.termTuitionTotal > 0 ? {
      studentId: input.studentId,
      termTuitionTotal: input.termTuitionTotal,
      overdueTuitionBalance: input.overdueTuitionBalance,
      currency: 'GHS',
      isFullyPaid: input.overdueTuitionBalance === 0,
      daysOverdue: input.overdueTuitionBalance > 0 ? 30 : 0,
    } : undefined;

    const service = getSchoolOperationsService();
    const anomaly = await service.analyzeAttendanceAnomaly(student, fees);

    const emittedEvents = [
      createDomainEvent({
        type: 'school.attendance.anomaly_flagged',
        organizationId: context.principal.organizationId,
        workspaceId: context.principal.workspaceId,
        actor: {
          type: context.principal.actorType === 'user' ? 'user' : 'agent',
          id: context.principal.userId,
        },
        entity: { type: 'student_attendance', id: input.studentId },
        correlationId: context.correlationId,
        source: 'school_capability',
        payload: {
          studentId: input.studentId,
          anomalyScore: anomaly.anomalyScore,
          riskTier: anomaly.riskTier,
          absenteeismVelocity: anomaly.absenteeismVelocity,
        },
      }),
    ];

    return {
      success: true,
      data: anomaly,
      executionId: `exec_${Date.now()}`,
      emittedEvents,
      durationMs: Date.now() - startTime,
    };
  },
};

// ============================================================================
// 4. school.communication.draft_parent_brief (L1_INTERNAL_DRAFT)
// ============================================================================

export const SchoolCommunicationDraftParentBriefInputSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  studentId: z.string().min(1),
  studentName: z.string().min(1),
  parentName: z.string().min(1),
  parentPhone: z.string().default('+233200000000'),
  parentEmail: z.string().email().optional(),
  gradeLevel: z.string().default('General'),
  urgency: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('HIGH'),
  channel: z.enum(['sms', 'whatsapp', 'email', 'in_app']).default('whatsapp'),
  remarks: z.string().optional().default(''),
  totalSchoolDays: z.number().int().default(60),
  presentDays: z.number().int().default(45),
  excusedAbsences: z.number().int().default(0),
  unexcusedAbsences: z.number().int().default(5),
  unexcusedAbsences14d: z.number().int().default(3),
  unexcusedAbsences60d: z.number().int().default(5),
  consecutiveUnexcusedDays: z.number().int().default(3),
  termTuitionTotal: z.number().default(0),
  overdueTuitionBalance: z.number().default(0),
  daysOverdue: z.number().int().default(0),
  currency: z.string().default('GHS'),
});

export type SchoolCommunicationDraftParentBriefInput = z.infer<typeof SchoolCommunicationDraftParentBriefInputSchema>;

export const schoolCommunicationDraftParentBriefCapability: CapabilityDefinition<
  SchoolCommunicationDraftParentBriefInput,
  ParentCommunicationBrief
> = {
  id: 'school.communication.draft_parent_brief',
  version: '1.0.0',
  name: 'Draft Parent Communication Brief',
  description: 'Drafts a professional, empathetic attendance briefing for parents with XML isolation and injection defense.',
  domain: 'school_operations',
  operation: 'draft',
  inputSchema: SchoolCommunicationDraftParentBriefInputSchema,
  outputSchema: ParentCommunicationBriefSchema,
  permissions: ['rbac:operations.attendance.manage', 'rbac:communication.templates.manage'],
  workspaceScoped: true,
  tenantScoped: true,
  risk: {
    level: 'L1_INTERNAL_DRAFT',
    destructive: false,
    idempotent: true,
    openWorld: false,
    requiresHumanApproval: false,
    nonDelegable: false,
  },
  execution: {
    synchronous: true,
    maxDurationMs: 15000,
    supportsDryRun: true,
    supportsCancellation: true,
    supportsCompensation: false,
    maxPayloadSizeBytes: 1048576,
  },
  policies: {
    requiresIdempotencyKey: false,
    requiresExpectedVersion: false,
    auditRequired: true,
    defaultEnabled: true,
  },
  handler: async (
    input: SchoolCommunicationDraftParentBriefInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<ParentCommunicationBrief>> => {
    const startTime = Date.now();
    assertTenantContext(context, input.organizationId);
    await checkGovernanceDeadManSwitch(context.principal.organizationId);

    const briefInput: DraftParentBriefInput = {
      studentId: input.studentId,
      studentName: input.studentName,
      parentName: input.parentName,
      parentEmail: input.parentEmail,
      parentPhone: input.parentPhone,
      gradeLevel: input.gradeLevel,
      workspaceId: input.workspaceId,
      organizationId: input.organizationId,
      urgency: input.urgency,
      channel: input.channel,
      attendanceSummary: {
        studentId: input.studentId,
        studentName: input.studentName,
        gradeLevel: input.gradeLevel,
        className: 'General',
        workspaceId: input.workspaceId,
        organizationId: input.organizationId,
        totalSchoolDays: input.totalSchoolDays,
        presentDays: input.presentDays,
        excusedAbsences: input.excusedAbsences,
        unexcusedAbsences: input.unexcusedAbsences,
        unexcusedAbsences14d: input.unexcusedAbsences14d,
        unexcusedAbsences60d: input.unexcusedAbsences60d,
        consecutiveUnexcusedDays: input.consecutiveUnexcusedDays,
        remarks: input.remarks ?? '',
      },
      feeStatus: {
        studentId: input.studentId,
        termTuitionTotal: input.termTuitionTotal,
        overdueTuitionBalance: input.overdueTuitionBalance,
        currency: input.currency,
        isFullyPaid: input.overdueTuitionBalance === 0,
        daysOverdue: input.daysOverdue,
      },
    };

    const service = getSchoolOperationsService();
    const brief = await service.draftParentBrief(briefInput);

    const emittedEvents = [
      createDomainEvent({
        type: 'school.communication.brief_drafted',
        organizationId: context.principal.organizationId,
        workspaceId: context.principal.workspaceId,
        actor: {
          type: context.principal.actorType === 'user' ? 'user' : 'agent',
          id: context.principal.userId,
        },
        entity: { type: 'parent_brief', id: brief.briefId },
        correlationId: context.correlationId,
        source: 'school_capability',
        payload: {
          briefId: brief.briefId,
          studentId: input.studentId,
          parentName: input.parentName,
          draftSubject: brief.subject,
        },
      }),
    ];

    return {
      success: true,
      data: brief,
      executionId: `exec_${Date.now()}`,
      emittedEvents,
      durationMs: Date.now() - startTime,
    };
  },
};

// ============================================================================
// Canonical Registrar for School Capabilities (Rule 69)
// ============================================================================

export function registerSchoolCapabilities(): void {
  registerCapability(schoolAttendanceGetReportCapability, { allowOverride: true });
  registerCapability(schoolAttendanceCorrelateFeesCapability, { allowOverride: true });
  registerCapability(schoolAttendanceFlagAnomalyCapability, { allowOverride: true });
  registerCapability(schoolCommunicationDraftParentBriefCapability, { allowOverride: true });
}

// Auto-register upon module load
registerSchoolCapabilities();
