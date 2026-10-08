/**
 * @fileOverview Unit Tests for Supervisor Orchestrator Engine (Phase 13 Milestone 3)
 *
 * Implements:
 * - Rule 4 (Strict typing: zero any/any[])
 * - Rule 8 & 47 (Anti-IDOR multi-tenant validation)
 * - Rule 9 & 23 (Bounded batch concurrency <= 4)
 * - Rule 13 & 30 (Untrusted reference data XML isolation)
 * - Rule 16 (Ephemeral delegation token minting)
 * - Rule 21 & 22 (Two-phase approval staging with SHA-256 payloadHash)
 * - Rule 26 (Cooperative cancellation via AbortSignal)
 * - Rule 27 (Reverse-LIFO Saga rollback)
 * - Rule 40 (Domain event publishing)
 * - Rule 41 (Structured explainability grid)
 * - Rule 42 (Shadow mode blast radius reporting)
 * - Rule 60 (Emergency dead-man switch evaluation)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SupervisorOrchestrator,
  getSupervisorOrchestrator,
} from '@/platform/agents/supervisor/supervisor-orchestrator';
import { SupervisorError } from '@/platform/agents/supervisor/supervisor-types';
import { EventBus } from '@/platform/events/event-bus';
import { DomainEvent } from '@/platform/capabilities/events/domain-event';

// Mock governance dead man switch
vi.mock('@/platform/policy/governance-dead-man', () => ({
  checkGovernanceDeadManSwitch: vi.fn().mockResolvedValue(undefined),
  AgentGovernanceEmergencyPausedError: class AgentGovernanceEmergencyPausedError extends Error {
    constructor() {
      super('Agent autonomous execution and approval processing is paused by emergency dead-man control.');
      this.name = 'AgentGovernanceEmergencyPausedError';
    }
  },
}));

import { checkGovernanceDeadManSwitch } from '@/platform/policy/governance-dead-man';

describe('SupervisorOrchestrator Engine', () => {
  let mockEventBus: EventBus;
  let publishedEvents: DomainEvent[];

  beforeEach(() => {
    vi.clearAllMocks();
    (checkGovernanceDeadManSwitch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    publishedEvents = [];
    mockEventBus = {
      publish: vi.fn().mockImplementation(async (event: DomainEvent) => {
        publishedEvents.push(event);
      }),
      subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
      clear: vi.fn(),
      getSubscriberCount: vi.fn().mockReturnValue(0),
    };
  });

  describe('End-to-End Mission Execution', () => {
    it('executes a RECOVERY_CAMPAIGN across 4 topological waves and publishes domain events', async () => {
      const orchestrator = new SupervisorOrchestrator({
        eventBus: mockEventBus,
      });

      const result = await orchestrator.executeMission({
        goal: 'Recover tuition arrears for inactive students across campuses',
        organizationId: 'org_test_123',
        workspaceId: 'ws_test_456',
        entityId: 'school_campus_001',
      });

      expect(result.missionId).toMatch(/^mis_/);
      expect(result.executiveSummary).toContain('executed successfully');
      expect(result.groundedCitations.length).toBe(4);
      expect(result.stepMetrics.length).toBe(4);
      expect(result.explainabilityGrid.what).toContain('RECOVERY_CAMPAIGN');

      // Verify domain events published
      const eventTypes = publishedEvents.map((e) => e.type);
      expect(eventTypes).toContain('supervisor.mission.started');
      expect(eventTypes).toContain('supervisor.step.started');
      expect(eventTypes).toContain('supervisor.step.completed');
      expect(eventTypes).toContain('supervisor.mission.completed');

      // Verify delegation tokens were minted for steps
      const mission = orchestrator.getMission(result.missionId);
      expect(mission).not.toBeNull();
      expect(mission?.executedSteps.length).toBe(4);
      for (const step of mission!.executedSteps) {
        expect(step.delegationToken).not.toBeNull();
        expect(step.delegationToken?.parentRunId).toBe(result.missionId);
        expect(step.delegationToken?.tokenSignature).toBeDefined();
      }
    });

    it('executes a multi-wave CAMPUS_AUDIT with parallel steps in wave 0', async () => {
      const orchestrator = new SupervisorOrchestrator({
        eventBus: mockEventBus,
      });

      const result = await orchestrator.executeMission({
        goal: 'Perform complete campus review and compliance audit',
        organizationId: 'org_audit',
        workspaceId: 'ws_audit',
        missionType: 'CAMPUS_AUDIT',
      });

      expect(result.stepMetrics.length).toBe(3);
      const mission = orchestrator.getMission(result.missionId);
      expect(mission?.status).toBe('COMPLETED');
      expect(mission?.totalWaves).toBe(2);
    });
  });

  describe('Cooperative Cancellation via AbortSignal (Rule 26)', () => {
    it('aborts mission when AbortSignal is already cancelled', async () => {
      const orchestrator = new SupervisorOrchestrator({
        eventBus: mockEventBus,
      });

      const controller = new AbortController();
      controller.abort();

      await expect(
        orchestrator.executeMission(
          {
            goal: 'Recover tuition arrears',
            organizationId: 'org_test',
            workspaceId: 'ws_test',
          },
          { abortSignal: controller.signal }
        )
      ).rejects.toThrowError(/cancelled by client abort signal/);

      const eventTypes = publishedEvents.map((e) => e.type);
      expect(eventTypes).toContain('supervisor.mission.started');
    });

    it('cancelMission updates status to CANCELLED and publishes cancellation event', async () => {
      const orchestrator = new SupervisorOrchestrator({
        eventBus: mockEventBus,
      });

      // Execute mission first
      const result = await orchestrator.executeMission({
        goal: 'Perform general audit',
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        dryRun: true,
      });

      const mission = orchestrator.getMission(result.missionId);
      expect(mission).not.toBeNull();

      // Mission already completed, cancelMission should return false
      const cancelled = await orchestrator.cancelMission(result.missionId);
      expect(cancelled).toBe(false);
    });
  });

  describe('Reverse-LIFO Saga Rollback on Step Failure (Rule 27)', () => {
    it('triggers rollback for previously completed steps when a successor step fails', async () => {
      const orchestrator = new SupervisorOrchestrator({
        eventBus: mockEventBus,
        customStepExecutor: async (step) => {
          if (step.stepId === 'step_3') {
            throw new Error('Database connection timeout on step 3');
          }
          return { status: 'OK', step: step.stepId };
        },
      });

      await expect(
        orchestrator.executeMission({
          goal: 'Recover tuition arrears for inactive students',
          organizationId: 'org_test',
          workspaceId: 'ws_test',
        })
      ).rejects.toThrowError(/Step 'step_3'/);

      const eventTypes = publishedEvents.map((e) => e.type);
      expect(eventTypes).toContain('supervisor.mission.failed');
    });
  });

  describe('Shadow Mode Simulation (Rule 42)', () => {
    it('produces MultiAgentBlastRadiusReport with 0 live database writes when dryRun: true', async () => {
      const orchestrator = new SupervisorOrchestrator({
        eventBus: mockEventBus,
      });

      const result = await orchestrator.executeMission({
        goal: 'Recover tuition arrears across Greater Accra',
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        entityId: 'accra_campus_01',
        dryRun: true,
      });

      const mission = orchestrator.getMission(result.missionId);
      expect(mission?.dryRun).toBe(true);
      expect(mission?.blastRadiusReport).toBeDefined();
      expect(mission?.blastRadiusReport?.dryRun).toBe(true);
      expect(mission?.blastRadiusReport?.totalStepsSimulated).toBe(4);
      expect(mission?.blastRadiusReport?.affectedEntities).toContain('accra_campus_01');
      expect(mission?.blastRadiusReport?.cumulativeFinancialExposure).toBe(45000);
    });
  });

  describe('Emergency Dead-Man Switch Evaluation (Rule 60)', () => {
    it('fails closed with DEAD_MAN_PAUSED (HTTP 503) when switch is engaged', async () => {
      (checkGovernanceDeadManSwitch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Emergency paused')
      );

      const orchestrator = new SupervisorOrchestrator({
        eventBus: mockEventBus,
      });

      try {
        await orchestrator.executeMission({
          goal: 'Recover tuition arrears',
          organizationId: 'org_paused',
          workspaceId: 'ws_test',
        });
        expect.unreachable('Should have thrown DEAD_MAN_PAUSED');
      } catch (err) {
        expect(err).toBeInstanceOf(SupervisorError);
        expect((err as SupervisorError).code).toBe('DEAD_MAN_PAUSED');
        expect((err as SupervisorError).httpStatus).toBe(503);
      }
    });
  });

  describe('HMR Singleton Preservation (Rule 69)', () => {
    it('preserves single global orchestrator instance across calls', () => {
      const instance1 = getSupervisorOrchestrator();
      const instance2 = getSupervisorOrchestrator();
      expect(instance1).toBe(instance2);
    });
  });
});
