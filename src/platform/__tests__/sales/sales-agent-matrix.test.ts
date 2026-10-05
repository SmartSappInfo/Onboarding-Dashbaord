/**
 * @fileOverview Unit & Governance Tests for Sales Agent Permission, Tool, Failure & Rollback Matrices (Phase 10 M2)
 *
 * Implements Rules 2, 4, 10, 12, 14, 16, 27, 44, 48, 67, and 69.
 * Validates:
 * - SALES_PERMISSION_MATRIX: Explicit non-wildcard RBAC scopes per persona
 * - SALES_TOOL_MATRIX: Canonical mapping of 15 sales & SDR capabilities with risk levels
 * - SALES_FAILURE_MATRIX: 12 structured error taxonomy codes and recovery strategies
 * - SALES_ROLLBACK_MATRIX: Reverse-LIFO Saga compensation mapping for mutating tools
 */

import { describe, it, expect } from 'vitest';
import {
  SALES_PERMISSION_MATRIX,
  SALES_TOOL_MATRIX,
  SALES_FAILURE_MATRIX,
  SALES_ROLLBACK_MATRIX,
  SalesToolMatrixEntrySchema,
  SalesFailureMatrixEntrySchema,
  SalesRollbackMatrixEntrySchema,
} from '../../agents/sales/personas/sales-agent-matrix';
import { SALES_PERSONA_IDS } from '../../agents/sales/personas/sales-persona-definitions';

describe('Sales Governance Matrices', () => {
  it('defines explicit non-wildcard permissions for every persona (Rule 16)', () => {
    for (const personaId of SALES_PERSONA_IDS) {
      const perms = SALES_PERMISSION_MATRIX[personaId];
      expect(perms).toBeDefined();
      expect(perms.length).toBeGreaterThan(0);
      for (const p of perms) {
        expect(p).not.toContain('*');
        expect(p).not.toBe('all');
      }
    }
  });

  it('maps all 15 canonical sales & SDR capabilities in the Tool Matrix with valid risk levels (Rule 12 & 14)', () => {
    expect(SALES_TOOL_MATRIX.length).toBeGreaterThanOrEqual(15);
    const capIds = SALES_TOOL_MATRIX.map((e) => e.capabilityId);

    // 8 lead intelligence capabilities
    expect(capIds).toContain('lead.search');
    expect(capIds).toContain('lead.score');
    expect(capIds).toContain('lead.enrich');
    expect(capIds).toContain('lead.get_intelligence');
    expect(capIds).toContain('lead.get_decision_makers');
    expect(capIds).toContain('lead.get_buying_signals');
    expect(capIds).toContain('lead.get_recommended_pitch');
    expect(capIds).toContain('lead.get_objection_handlers');

    // 7 SDR capabilities
    expect(capIds).toContain('sdr.get_daily_briefing');
    expect(capIds).toContain('sdr.get_priority_queue');
    expect(capIds).toContain('sdr.generate_outreach_draft');
    expect(capIds).toContain('sdr.create_whatsapp_link');
    expect(capIds).toContain('sdr.request_outreach_approval');
    expect(capIds).toContain('sdr.record_outreach_outcome');
    expect(capIds).toContain('sdr.get_conversion_insights');

    // Schema validation for every entry
    for (const entry of SALES_TOOL_MATRIX) {
      const parsed = SalesToolMatrixEntrySchema.safeParse(entry);
      expect(parsed.success).toBe(true);
    }
  });

  it('handles at least 12 distinct failure codes in the Failure Matrix (Rule 48)', () => {
    expect(SALES_FAILURE_MATRIX.length).toBeGreaterThanOrEqual(12);
    const failureCodes = SALES_FAILURE_MATRIX.map((e) => e.failureCode);
    expect(failureCodes).toContain('LEAD_NOT_FOUND');
    expect(failureCodes).toContain('RATE_LIMITED');
    expect(failureCodes).toContain('PROMPT_INJECTION_DETECTED');
    expect(failureCodes).toContain('DEAD_MAN_SWITCH_ENGAGED');
    expect(failureCodes).toContain('IDOR_VIOLATION');
    expect(failureCodes).toContain('DNS_MX_UNRESOLVED');
    expect(failureCodes).toContain('SSRF_DISALLOWED');
    expect(failureCodes).toContain('DISPOSABLE_EMAIL');
    expect(failureCodes).toContain('MODEL_HALLUCINATION');
    expect(failureCodes).toContain('STALE_APPROVAL_PROPOSAL');
    expect(failureCodes).toContain('TOCTOU_CONCURRENCY_CONFLICT');
    expect(failureCodes).toContain('BUDGET_EXCEEDED');

    // Schema validation for every entry
    for (const entry of SALES_FAILURE_MATRIX) {
      const parsed = SalesFailureMatrixEntrySchema.safeParse(entry);
      expect(parsed.success).toBe(true);
    }
  });

  it('binds compensating capabilities in the Rollback Matrix for mutating operations (Rule 27)', () => {
    expect(SALES_ROLLBACK_MATRIX.length).toBeGreaterThanOrEqual(3);
    for (const entry of SALES_ROLLBACK_MATRIX) {
      const parsed = SalesRollbackMatrixEntrySchema.safeParse(entry);
      expect(parsed.success).toBe(true);
      expect(entry.mutatingCapabilityId).toBeTruthy();
      expect(entry.compensatingCapabilityId).toBeTruthy();
      expect(entry.strategy).toBe('REVERSE_LIFO');
    }
  });
});
