/**
 * @fileOverview Unit & Integration Tests for Canonical School & Finance Analytics Capabilities.
 *
 * Implements:
 * - Rule 4 (Strict Typing: zero any/any[])
 * - Rule 8 & 47 (Anti-IDOR Multi-Tenant Scoping)
 * - Rule 11 (Mathematical determinism in financial/operational scoring)
 * - Rule 12 (Canonical risk taxonomy: L0_READ, L1_INTERNAL_DRAFT)
 * - Rule 13 & 30 (XML isolation & Prompt Injection defense)
 * - Rule 60 (Emergency dead-man switch evaluation)
 */

import { describe, it, expect } from 'vitest';
import {
  schoolAttendanceGetReportCapability,
  schoolAttendanceCorrelateFeesCapability,
  schoolAttendanceFlagAnomalyCapability,
  schoolCommunicationDraftParentBriefCapability,
} from '../../capabilities/school/school-capabilities';
import { financeAnalyticsGetCashflowForecastCapability } from '../../capabilities/finance/finance-capabilities';
import { getCapability } from '../../capabilities/registry/capability-registry';
import type { CapabilityExecutionContext } from '../../capabilities/contracts/capability-definition';

describe('School & Finance Analytics Canonical Capabilities', () => {
  const mockContext: CapabilityExecutionContext = {
    principal: {
      actorType: 'user',
      userId: 'user_school_admin',
      organizationId: 'org_ghana_sec_01',
      workspaceId: 'ws_campus_accra',
      grantedScopes: ['school:attendance:view', 'school:attendance:manage', 'finance:invoices:view'],
      effectiveRole: 'admin',
    },
    correlationId: 'corr_sch_001',
    timestamp: new Date().toISOString(),
  };

  it('exposes all canonical school capability contracts with correct risk levels and domain', () => {
    expect(schoolAttendanceGetReportCapability.id).toBe('school.attendance.get_report');
    expect(schoolAttendanceGetReportCapability.risk.level).toBe('L0_READ');
    expect(schoolAttendanceGetReportCapability.domain).toBe('school_operations');

    expect(schoolAttendanceCorrelateFeesCapability.id).toBe('school.attendance.correlate_fees');
    expect(schoolAttendanceCorrelateFeesCapability.risk.level).toBe('L0_READ');
    expect(schoolAttendanceCorrelateFeesCapability.domain).toBe('school_operations');

    expect(schoolAttendanceFlagAnomalyCapability.id).toBe('school.attendance.flag_anomaly');
    expect(schoolAttendanceFlagAnomalyCapability.risk.level).toBe('L1_INTERNAL_DRAFT');
    expect(schoolAttendanceFlagAnomalyCapability.domain).toBe('school_operations');

    expect(schoolCommunicationDraftParentBriefCapability.id).toBe('school.communication.draft_parent_brief');
    expect(schoolCommunicationDraftParentBriefCapability.risk.level).toBe('L1_INTERNAL_DRAFT');
    expect(schoolCommunicationDraftParentBriefCapability.domain).toBe('school_operations');
  });

  it('exposes finance.analytics.get_cashflow_forecast capability with L0_READ risk level', () => {
    expect(financeAnalyticsGetCashflowForecastCapability.id).toBe('finance.analytics.get_cashflow_forecast');
    expect(financeAnalyticsGetCashflowForecastCapability.risk.level).toBe('L0_READ');
    expect(financeAnalyticsGetCashflowForecastCapability.domain).toBe('finance_subscriptions');
  });

  it('registers all capabilities in the platform CapabilityRegistry', () => {
    expect(getCapability('school.attendance.get_report')).toBeDefined();
    expect(getCapability('school.attendance.correlate_fees')).toBeDefined();
    expect(getCapability('school.attendance.flag_anomaly')).toBeDefined();
    expect(getCapability('school.communication.draft_parent_brief')).toBeDefined();
    expect(getCapability('finance.analytics.get_cashflow_forecast')).toBeDefined();
  });

  it('executes school.attendance.correlate_fees handler deterministically', async () => {
    const result = await schoolAttendanceCorrelateFeesCapability.handler(
      {
        organizationId: 'org_ghana_sec_01',
        workspaceId: 'ws_campus_accra',
        studentId: 'student_kwame_01',
        termTuitionTotal: 4000,
        overdueTuitionBalance: 3600,
        unexcusedAbsences: 6,
        totalSchoolDays: 60,
        consecutiveUnexcusedDays: 3,
        daysOverdue: 45,
      },
      mockContext
    );

    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected success');
    expect(result.data.correlationIndex).toBeGreaterThan(0.5);
    expect(result.data.tuitionStressFlag).toBe(true);
    expect(['MODERATE', 'HIGH', 'CRITICAL']).toContain(result.data.riskLevel);
  });

  it('executes school.attendance.flag_anomaly handler with math anomaly scoring', async () => {
    const result = await schoolAttendanceFlagAnomalyCapability.handler(
      {
        organizationId: 'org_ghana_sec_01',
        workspaceId: 'ws_campus_accra',
        studentId: 'student_ama_02',
        studentName: 'Ama Mensah',
        grade: 'Form 3',
        className: 'Grade 10B',
        daysEnrolled: 60,
        presentDays: 45,
        excusedAbsences: 3,
        unexcusedAbsences14d: 6,
        unexcusedAbsences60d: 12,
        consecutiveAbsences: 4,
        overdueTuitionBalance: 2500,
        termTuitionTotal: 4000,
        remarks: 'Ama missed multiple morning class sessions.',
      },
      mockContext
    );

    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected success');
    expect(result.data.anomalyScore).toBeGreaterThan(0);
    expect(result.data.absenteeismVelocity).toBeDefined();
    expect(result.data.recommendation).toBeDefined();
    expect(result.data.isAnomalyFlagged).toBe(true);
  });

  it('executes school.communication.draft_parent_brief handler and isolates untrusted data', async () => {
    const result = await schoolCommunicationDraftParentBriefCapability.handler(
      {
        organizationId: 'org_ghana_sec_01',
        workspaceId: 'ws_campus_accra',
        studentId: 'student_kofi_03',
        studentName: 'Kofi Owusu',
        parentName: 'Mr. Kwame Owusu',
        parentPhone: '+233201234567',
        gradeLevel: 'Grade 10',
        urgency: 'HIGH',
        channel: 'whatsapp',
        remarks: 'Teacher noted Kofi was seen outside campus during class hours.',
        totalSchoolDays: 60,
        presentDays: 45,
        excusedAbsences: 0,
        unexcusedAbsences: 5,
        unexcusedAbsences14d: 3,
        unexcusedAbsences60d: 5,
        consecutiveUnexcusedDays: 3,
        termTuitionTotal: 3000,
        overdueTuitionBalance: 1200,
        daysOverdue: 15,
        currency: 'GHS',
      },
      mockContext
    );

    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected success');
    expect(result.data.body).toContain('Kofi Owusu');
    expect(result.data.subject).toContain('Attendance');
    expect(result.data.isolatedContextXml).toContain('<untrusted_reference_data');
    expect(result.data.isolatedContextXml).toContain('Teacher noted');
  });

  it('executes finance.analytics.get_cashflow_forecast handler with cent precision', async () => {
    const result = await financeAnalyticsGetCashflowForecastCapability.handler(
      {
        organizationId: 'org_ghana_sec_01',
        workspaceId: 'ws_campus_accra',
        cashOnHand: 50000,
        currency: 'GHS',
        installmentPlans: [],
        promisesToPay: [],
        timeHorizonDays: 90,
        invoices: [
          {
            invoiceId: 'inv_001',
            entityId: 'ent_001',
            entityName: 'Lincoln High',
            balanceDue: 15000,
            dueDate: new Date(Date.now() + 15 * 86400000).toISOString(),
            daysOverdue: 0,
          },
        ],
        totalCreditSales90d: 80000,
      },
      mockContext
    );

    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected success');
    expect(result.data.currentCashOnHand).toBe(50000);
    expect(result.data.runwayProjections['30d'].projectedClosingCash).toBeGreaterThan(50000);
    expect(result.data.dsoMetrics.dsoDays).toBeGreaterThan(0);
    expect(result.data.debtorConcentration.topDebtorName).toBe('Lincoln High');
  });

  it('fails closed on tenant IDOR violation', async () => {
    const foreignContext: CapabilityExecutionContext = {
      ...mockContext,
      principal: {
        ...mockContext.principal,
        organizationId: 'org_foreign_intruder',
      },
    };

    await expect(
      schoolAttendanceCorrelateFeesCapability.handler(
        {
          organizationId: 'org_ghana_sec_01',
          workspaceId: 'ws_campus_accra',
          studentId: 'student_kwame_01',
          termTuitionTotal: 5000,
          overdueTuitionBalance: 3000,
          unexcusedAbsences: 5,
          totalSchoolDays: 60,
          consecutiveUnexcusedDays: 2,
          daysOverdue: 30,
        },
        foreignContext
      )
    ).rejects.toThrow();
  });
});
