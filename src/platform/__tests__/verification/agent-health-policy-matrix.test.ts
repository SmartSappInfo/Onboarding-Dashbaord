/**
 * @fileOverview Unit & Integration Tests for Agent Health Policy Matrix
 *
 * Implements Rule 1962, Rule 24, Rule 42, and Rules 1940-1953.
 *
 * Validates:
 * - Authoritative SLA thresholds across all domain personas (Sales, Finance, School, Knowledge, CRM, Supervisor).
 * - Lookup helpers: getPersonaHealthPolicy, evaluateHealthStatus, shouldTripCircuitBreaker, getDegradationMode.
 * - Dynamic fallback behavior for custom / dynamic subagent personas.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { describe, it, expect } from 'vitest';
import {
  AGENT_HEALTH_POLICY_MATRIX,
  getPersonaHealthPolicy,
  evaluateHealthStatus,
  shouldTripCircuitBreaker,
  getDegradationMode,
  getAllHealthPolicyEntries,
} from '../../verification/health/agent-health-policy-matrix';
import { AGENT_PERSONA_IDS } from '../../identity/agent-persona-types';

describe('Phase 14 Milestone 4 - Agent Health Policy Matrix', () => {
  describe('AGENT_HEALTH_POLICY_MATRIX Registrations', () => {
    it('defines authoritative policies for every built-in persona in AGENT_PERSONA_IDS', () => {
      for (const personaId of AGENT_PERSONA_IDS) {
        const policy = getPersonaHealthPolicy(personaId);
        expect(policy).toBeDefined();
        expect(policy.personaId).toBe(personaId);
        expect(policy.minSuccessRate).toBeGreaterThanOrEqual(80);
        expect(policy.maxFailureRate).toBeLessThanOrEqual(20);
        expect(policy.maxConsecutiveFailures).toBeGreaterThanOrEqual(1);
        expect(policy.coolOffPeriodMs).toBeGreaterThanOrEqual(60000);
        expect(policy.degradationMode).toBe('SHADOW_MODE');
      }
    });

    it('enforces stricter 95% SLA for mission-critical Finance personas', () => {
      const financePersonas = ['billing_analyst', 'reconciliation_agent', 'collections_agent'];
      for (const p of financePersonas) {
        const policy = getPersonaHealthPolicy(p);
        expect(policy.minSuccessRate).toBe(95);
        expect(policy.maxFailureRate).toBe(5);
        expect(policy.maxConsecutiveFailures).toBe(2);
      }
    });

    it('enforces stricter 95% SLA for Supervisor Swarm persona', () => {
      const supervisorPolicy = getPersonaHealthPolicy('supervisor');
      expect(supervisorPolicy.minSuccessRate).toBe(95);
      expect(supervisorPolicy.maxConsecutiveFailures).toBe(2);
    });

    it('enforces 85% SLA for Sales outreach personas', () => {
      const salesPersonas = ['lead_sdr', 'prospecting_agent', 'qualification_agent'];
      for (const p of salesPersonas) {
        const policy = getPersonaHealthPolicy(p);
        expect(policy.minSuccessRate).toBe(85);
        expect(policy.maxFailureRate).toBe(15);
        expect(policy.maxConsecutiveFailures).toBe(3);
      }
    });
  });

  describe('Lookup & Evaluation Utilities', () => {
    it('provides fallback threshold policy for unmapped / dynamic personas', () => {
      const fallbackPolicy = getPersonaHealthPolicy('custom_ad_hoc_subagent');
      expect(fallbackPolicy).toBeDefined();
      expect(fallbackPolicy.personaId).toBe('custom_ad_hoc_subagent');
      expect(fallbackPolicy.minSuccessRate).toBe(85);
      expect(fallbackPolicy.maxFailureRate).toBe(15);
      expect(fallbackPolicy.maxConsecutiveFailures).toBe(3);
      expect(fallbackPolicy.degradationMode).toBe('SHADOW_MODE');
    });

    it('evaluates status as HEALTHY when metrics are within healthy bounds', () => {
      const status = evaluateHealthStatus('lead_sdr', {
        successRate: 98,
        failureRate: 2,
        consecutiveFailures: 0,
        toolErrorsCount: 0,
      });
      expect(status).toBe('HEALTHY');
    });

    it('evaluates status as DEGRADED when failure rate is elevated but not yet breached', () => {
      // For lead_sdr, maxFailureRate is 15. Between 8 and 14 is degraded
      const status = evaluateHealthStatus('lead_sdr', {
        successRate: 88,
        failureRate: 12,
        consecutiveFailures: 1,
        toolErrorsCount: 5,
      });
      expect(status).toBe('DEGRADED');
    });

    it('evaluates status as TRIPPED and signals circuit tripping when SLA is breached', () => {
      const metrics = {
        successRate: 80, // breaches 85%
        failureRate: 20,
        consecutiveFailures: 1,
        toolErrorsCount: 2,
      };

      const status = evaluateHealthStatus('lead_sdr', metrics);
      expect(status).toBe('TRIPPED');

      const shouldTrip = shouldTripCircuitBreaker('lead_sdr', metrics);
      expect(shouldTrip).toBe(true);
    });

    it('trips circuit breaker immediately when consecutive failures reach threshold', () => {
      const metrics = {
        successRate: 95,
        failureRate: 5,
        consecutiveFailures: 3, // breaches max 3
        toolErrorsCount: 3,
      };

      expect(shouldTripCircuitBreaker('lead_sdr', metrics)).toBe(true);
      expect(evaluateHealthStatus('lead_sdr', metrics)).toBe('TRIPPED');
    });

    it('getDegradationMode returns SHADOW_MODE for all personas per Rule 42', () => {
      expect(getDegradationMode('billing_analyst')).toBe('SHADOW_MODE');
      expect(getDegradationMode('lead_sdr')).toBe('SHADOW_MODE');
      expect(getDegradationMode('unknown_persona')).toBe('SHADOW_MODE');
    });

    it('getAllHealthPolicyEntries returns registered policies list', () => {
      const entries = getAllHealthPolicyEntries();
      expect(entries.length).toBeGreaterThanOrEqual(AGENT_PERSONA_IDS.length);
    });
  });
});
