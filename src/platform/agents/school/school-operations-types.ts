/**
 * @fileoverview Canonical Contracts, Zod v4 Schemas & Error Taxonomy for School Operations Intelligence
 *
 * Part of Phase 12 Milestone 5: School Operations Intelligence & Attendance Anomaly Engine.
 *
 * Invariants Enforced:
 * 1. Rule 4: Zero `any` or `any[]` typing policy.
 * 2. Rule 10: Strict runtime validation on every system boundary using Zod v4.
 * 3. Rule 11: Mathematical determinism in anomaly scoring and correlation indices.
 * 4. Rule 12: Canonical 5-tier risk levels (L0_READ to L4_PRIVILEGED_DESTRUCTIVE).
 * 5. Rule 48: Standardized error taxonomy mapping to HTTP status codes.
 */

import { z } from 'zod/v4';
import { type RiskLevel } from '@/platform/agents/finance/collections/collections-types';

/**
 * Attendance Anomaly Risk Tiers.
 */
export const AttendanceRiskTierSchema = z.enum(['LOW', 'MODERATE', 'ELEVATED', 'CRITICAL']);
export type AttendanceRiskTier = z.infer<typeof AttendanceRiskTierSchema>;

/**
 * Correlation Severity Levels.
 */
export const CorrelationRiskLevelSchema = z.enum(['MINIMAL', 'LOW', 'MODERATE', 'HIGH', 'CRITICAL']);
export type CorrelationRiskLevel = z.infer<typeof CorrelationRiskLevelSchema>;

/**
 * Student Attendance Summary Schema.
 */
export const StudentAttendanceSummarySchema = z.object({
  studentId: z.string().min(1),
  studentName: z.string().min(1),
  gradeLevel: z.string().min(1),
  className: z.string().min(1),
  workspaceId: z.string().min(1),
  organizationId: z.string().min(1),
  totalSchoolDays: z.number().int().min(1),
  presentDays: z.number().int().min(0),
  excusedAbsences: z.number().int().min(0),
  unexcusedAbsences: z.number().int().min(0),
  unexcusedAbsences14d: z.number().int().min(0),
  unexcusedAbsences60d: z.number().int().min(0),
  consecutiveUnexcusedDays: z.number().int().min(0),
  remarks: z.string().optional().default(''),
});
export type StudentAttendanceSummary = z.infer<typeof StudentAttendanceSummarySchema>;

/**
 * Student Fee Status Schema.
 */
export const StudentFeeStatusSchema = z.object({
  studentId: z.string().min(1),
  termTuitionTotal: z.number().min(0),
  overdueTuitionBalance: z.number().min(0),
  currency: z.string().min(1).default('GHS'),
  isFullyPaid: z.boolean(),
  daysOverdue: z.number().int().min(0),
});
export type StudentFeeStatus = z.infer<typeof StudentFeeStatusSchema>;

/**
 * Attendance Anomaly Analysis Result Schema.
 */
export const AttendanceAnomalyResultSchema = z.object({
  studentId: z.string().min(1),
  studentName: z.string().min(1),
  anomalyScore: z.number().min(0).max(100),
  riskTier: AttendanceRiskTierSchema,
  absenteeismVelocity: z.number(),
  consecutiveMissedDays: z.number().int().min(0),
  isAnomalyFlagged: z.boolean(),
  recommendation: z.string().min(1),
  riskLevel: z.custom<RiskLevel>(),
  evaluatedAt: z.string().datetime(),
});
export type AttendanceAnomalyResult = z.infer<typeof AttendanceAnomalyResultSchema>;

/**
 * Fee-to-Attendance Correlation Schema.
 */
export const FeeAttendanceCorrelationSchema = z.object({
  studentId: z.string().min(1),
  correlationIndex: z.number().min(0).max(1),
  riskLevel: CorrelationRiskLevelSchema,
  tuitionStressFlag: z.boolean(),
  explanation: z.string().min(1),
  evaluatedAt: z.string().datetime(),
});
export type FeeAttendanceCorrelation = z.infer<typeof FeeAttendanceCorrelationSchema>;

/**
 * Input contract for drafting Parent Communication Brief.
 */
export const DraftParentBriefInputSchema = z.object({
  studentId: z.string().min(1),
  studentName: z.string().min(1),
  parentName: z.string().min(1),
  parentEmail: z.string().email().optional(),
  parentPhone: z.string().min(1),
  gradeLevel: z.string().min(1),
  workspaceId: z.string().min(1),
  organizationId: z.string().min(1),
  attendanceSummary: StudentAttendanceSummarySchema,
  feeStatus: StudentFeeStatusSchema,
  urgency: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  channel: z.enum(['sms', 'whatsapp', 'email', 'in_app']),
});
export type DraftParentBriefInput = z.infer<typeof DraftParentBriefInputSchema>;

/**
 * Parent Communication Brief Result Schema.
 */
export const ParentCommunicationBriefSchema = z.object({
  briefId: z.string().min(1),
  studentId: z.string().min(1),
  recipientName: z.string().min(1),
  recipientContact: z.string().min(1),
  channel: z.enum(['sms', 'whatsapp', 'email', 'in_app']),
  subject: z.string().min(1),
  body: z.string().min(1),
  isolatedContextXml: z.string().min(1),
  requiresHumanReview: z.boolean(),
  generatedAt: z.string().datetime(),
});
export type ParentCommunicationBrief = z.infer<typeof ParentCommunicationBriefSchema>;

/**
 * School Operations Error Taxonomy (Rule 48).
 */
export const SCHOOL_OPERATIONS_ERROR_CODES = {
  STUDENT_NOT_FOUND: 'STUDENT_NOT_FOUND',
  INVALID_ATTENDANCE_DATA: 'INVALID_ATTENDANCE_DATA',
  INVALID_FEE_DATA: 'INVALID_FEE_DATA',
  SCHOOL_DEAD_MAN_PAUSED: 'SCHOOL_DEAD_MAN_PAUSED',
  PROMPT_INJECTION_DETECTED: 'PROMPT_INJECTION_DETECTED',
  CROSS_TENANT_ACCESS_DENIED: 'CROSS_TENANT_ACCESS_DENIED',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type SchoolOperationsErrorCode =
  (typeof SCHOOL_OPERATIONS_ERROR_CODES)[keyof typeof SCHOOL_OPERATIONS_ERROR_CODES];

export class SchoolOperationsError extends Error {
  public readonly code: SchoolOperationsErrorCode;
  public readonly httpStatus: number;

  constructor(code: SchoolOperationsErrorCode, message: string, httpStatus = 400) {
    super(message);
    this.name = 'SchoolOperationsError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}
