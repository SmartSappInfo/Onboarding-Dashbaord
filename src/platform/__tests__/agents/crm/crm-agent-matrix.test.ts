/**
 * @fileOverview Unit & Architectural Tests for CRM Agent Matrices (Phase 9 Milestone 2)
 *
 * Implements verification for Rules 1, 2, 4, 8, 12, 16, 17, 27, 48, 59, 67, 68, and 69.
 */

import { describe, it, expect } from 'vitest';
import {
  CRM_PERMISSION_MATRIX,
  CRM_TOOL_MATRIX,
  CRM_FAILURE_MATRIX,
  CRM_ROLLBACK_MATRIX,
  CrmToolMatrixEntrySchema,
  CrmFailureMatrixEntrySchema,
  validateCrmPersonaToolAccess,
  getCrmRollbackCapability,
  resolveCrmFailureStrategy,
  getPersonaAllowedCapabilities,
  getPersonaPermissionList,
} from '@/platform/agents/crm/personas/crm-agent-matrix';
import { CRM_PERSONA_IDS } from '@/platform/agents/crm/personas/crm-persona-definitions';

describe('Phase 9 Milestone 2: CRM Agent Matrices', () => {
  describe('CRM_PERMISSION_MATRIX (Rules 8, 16, 17)', () => {
    it('should define an explicit permission list for all 6 CRM personas', () => {
      for (const personaId of CRM_PERSONA_IDS) {
        const permissions = CRM_PERMISSION_MATRIX[personaId];
        expect(permissions, `Persona ${personaId} missing from CRM_PERMISSION_MATRIX`).toBeDefined();
        expect(Array.isArray(permissions)).toBe(true);
        expect(permissions.length).toBeGreaterThan(0);
      }
    });

    it('should strictly ban wildcard permissions across all personas (Rule 16)', () => {
      for (const [personaId, permissions] of Object.entries(CRM_PERMISSION_MATRIX)) {
        for (const permission of permissions) {
          expect(permission, `Persona ${personaId} has wildcard permission: ${permission}`).not.toContain('*');
        }
      }
    });

    it('should exclude destructive non-delegable operations (Rule 17)', () => {
      const nonDelegable = ['workspace:delete', 'tenant:delete', 'billing:modify', 'admin:super'];
      for (const [personaId, permissions] of Object.entries(CRM_PERMISSION_MATRIX)) {
        for (const forbidden of nonDelegable) {
          expect(permissions, `Persona ${personaId} contains non-delegable: ${forbidden}`).not.toContain(forbidden);
        }
      }
    });

    it('should retrieve permissions via getPersonaPermissionList helper', () => {
      const perms = getPersonaPermissionList('crm_researcher');
      expect(perms).toContain('workspace:read');
      expect(perms).toContain('crm:timeline:view');
    });
  });

  describe('CRM_TOOL_MATRIX (Rules 12, 59)', () => {
    it('should define valid tool entries for all 6 CRM personas conforming to schema', () => {
      for (const personaId of CRM_PERSONA_IDS) {
        const tools = CRM_TOOL_MATRIX[personaId];
        expect(tools, `Persona ${personaId} missing from CRM_TOOL_MATRIX`).toBeDefined();
        expect(tools.length).toBeGreaterThan(0);

        for (const entry of tools) {
          const parsed = CrmToolMatrixEntrySchema.safeParse(entry);
          expect(parsed.success, `Tool entry for ${personaId} invalid: ${parsed.error?.message}`).toBe(true);
        }
      }
    });

    it('should restrict read-only personas to L0_READ tools', () => {
      const researcherTools = CRM_TOOL_MATRIX.crm_researcher;
      for (const tool of researcherTools) {
        expect(tool.riskLevel).toBe('L0_READ');
      }
    });

    it('should restrict analyst personas to L0_READ and L1_INTERNAL_DRAFT tools', () => {
      const analystTools = [...CRM_TOOL_MATRIX.lead_analyst, ...CRM_TOOL_MATRIX.deal_strategist];
      for (const tool of analystTools) {
        expect(['L0_READ', 'L1_INTERNAL_DRAFT']).toContain(tool.riskLevel);
      }
    });

    it('should validate tool access correctly using validateCrmPersonaToolAccess', () => {
      // Allowed: crm_researcher calling crm.account.get_context
      const check1 = validateCrmPersonaToolAccess('crm_researcher', 'crm.account.get_context');
      expect(check1.allowed).toBe(true);
      expect(check1.entry?.capabilityId).toBe('crm.account.get_context');

      // Disallowed: crm_researcher calling task.create (violates risk level and not in inventory)
      const check2 = validateCrmPersonaToolAccess('crm_researcher', 'task.create');
      expect(check2.allowed).toBe(false);
      expect(check2.reason).toContain('not in the allowed tool inventory');

      // Allowed: task_coordinator calling task.create
      const check3 = validateCrmPersonaToolAccess('task_coordinator', 'task.create');
      expect(check3.allowed).toBe(true);

      // Unknown persona
      const check4 = validateCrmPersonaToolAccess('unknown_persona', 'task.create');
      expect(check4.allowed).toBe(false);
      expect(check4.reason).toContain('Unknown CRM persona');
    });

    it('should list all allowed capabilities for a persona via getPersonaAllowedCapabilities', () => {
      const capabilities = getPersonaAllowedCapabilities('crm_assistant');
      expect(capabilities.length).toBeGreaterThan(0);
      expect(capabilities.some((c) => c.capabilityId === 'crm.account.get_context')).toBe(true);
    });
  });

  describe('CRM_FAILURE_MATRIX (Rules 2, 48)', () => {
    it('should define deterministic failure strategies conforming to schema', () => {
      for (const [code, entry] of Object.entries(CRM_FAILURE_MATRIX)) {
        expect(code).toBe(entry.failureCode);
        const parsed = CrmFailureMatrixEntrySchema.safeParse(entry);
        expect(parsed.success, `Failure matrix entry ${code} invalid: ${parsed.error?.message}`).toBe(true);
      }
    });

    it('should cover key operational edge cases', () => {
      const requiredCodes = [
        'ENTITY_NOT_FOUND',
        'STALE_RECORD',
        'EMPTY_TIMELINE',
        'MODEL_TIMEOUT',
        'UNAPPROVED_MUTATION',
        'RATE_LIMITED',
        'PERMISSION_DENIED',
        'CONTEXT_OVERFLOW',
      ];

      for (const code of requiredCodes) {
        expect(CRM_FAILURE_MATRIX[code], `Failure code ${code} missing from CRM_FAILURE_MATRIX`).toBeDefined();
      }
    });

    it('should resolve strategies deterministically via resolveCrmFailureStrategy', () => {
      const resolved = resolveCrmFailureStrategy('ENTITY_NOT_FOUND');
      expect(resolved.strategy).toBe('FAIL_CLOSED');
      expect(resolved.fallbackCode).toBe('ACCOUNT_NOT_FOUND');

      const timeout = resolveCrmFailureStrategy('MODEL_TIMEOUT');
      expect(timeout.strategy).toBe('DEGRADE_GRACEFULLY');
      expect(timeout.retryable).toBe(true);

      // Fallback for unknown codes
      const unknown = resolveCrmFailureStrategy('SOME_WEIRD_CODE');
      expect(unknown.strategy).toBe('FAIL_CLOSED');
      expect(unknown.fallbackCode).toBe('INTERNAL_FAILURE');
    });
  });

  describe('CRM_ROLLBACK_MATRIX (Rule 27)', () => {
    it('should define reverse-LIFO Saga compensations for every state-mutating capability', () => {
      expect(CRM_ROLLBACK_MATRIX['task.create']).toBe('task.cancel');
      expect(CRM_ROLLBACK_MATRIX['task.cancel']).toBe('task.create');
      expect(CRM_ROLLBACK_MATRIX['crm.entity.tag_add']).toBe('crm.entity.tag_remove');
      expect(CRM_ROLLBACK_MATRIX['crm.entity.tag_remove']).toBe('crm.entity.tag_add');
      expect(CRM_ROLLBACK_MATRIX['crm.entity.assign_owner']).toBe('crm.entity.assign_owner');
    });

    it('should resolve compensating capabilities via getCrmRollbackCapability', () => {
      expect(getCrmRollbackCapability('task.create')).toBe('task.cancel');
      expect(getCrmRollbackCapability('crm.entity.tag_add')).toBe('crm.entity.tag_remove');
      expect(getCrmRollbackCapability('crm.account.get_context')).toBeNull(); // Read-only tool has no compensation
    });
  });
});
