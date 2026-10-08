import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupervisorShadowRunner } from '../../../agents/supervisor/evaluation/supervisor-shadow-mode';
import { type EventBus } from '../../../events/event-bus';
import { type DomainEvent } from '../../../capabilities/events/domain-event';
import * as deadManModule from '../../../policy/governance-dead-man';

describe('Supervisor Shadow Mode Simulation (Rule 42)', () => {
  let publishedEvents: DomainEvent[] = [];
  let mockEventBus: EventBus;

  beforeEach(() => {
    publishedEvents = [];
    mockEventBus = {
      publish: vi.fn(async (event: DomainEvent) => {
        publishedEvents.push(event);
      }),
      subscribe: vi.fn(),
    } as unknown as EventBus;
    vi.restoreAllMocks();
  });

  it('runs simulation with dryRun: true and produces MultiAgentBlastRadiusReport', async () => {
    const runner = new SupervisorShadowRunner({ eventBus: mockEventBus });

    const result = await runner.simulateGoal({
      goal: 'Recover tuition fee arrears for chronically absent Grade 11 students',
      organizationId: 'org_gis_accra',
      workspaceId: 'ws_secondary_division',
    });

    expect(result.missionId).toBeDefined();
    expect(result.blastRadiusReport).toBeDefined();
    expect(result.blastRadiusReport.totalStepsSimulated).toBe(4);
    expect(result.blastRadiusReport.affectedWorkspaces).toContain('ws_secondary_division');
    expect(result.blastRadiusReport.explainability.what).toContain('Simulated multi-agent execution');
    expect(result.totalStepsSimulated).toBe(4);
    expect(result.simulationDurationMs).toBeGreaterThanOrEqual(0);
    expect(result.meshTopology).toBeDefined();
    expect(result.meshTopology?.peers.length).toBeGreaterThanOrEqual(20);
    expect(result.meshTopology?.activeNodes).toBeGreaterThanOrEqual(20);

    // Verify simulation domain event published
    const simEvents = publishedEvents.filter((e) => e.type === 'supervisor.mission.simulated');
    expect(simEvents.length).toBe(1);
    expect(simEvents[0].organizationId).toBe('org_gis_accra');
  });

  it('fails closed with IDOR_VIOLATION when tenant context is missing', async () => {
    const runner = new SupervisorShadowRunner({ eventBus: mockEventBus });

    await expect(
      runner.simulateGoal({
        goal: 'Recover tuition fee arrears',
        organizationId: '',
        workspaceId: 'ws_test',
      })
    ).rejects.toThrowError(/organizationId and workspaceId are required/);
  });

  it('fails closed with DEAD_MAN_PAUSED (HTTP 503) when emergency switch is engaged', async () => {
    vi.spyOn(deadManModule, 'checkGovernanceDeadManSwitch').mockRejectedValue(
      new deadManModule.AgentGovernanceEmergencyPausedError()
    );

    const runner = new SupervisorShadowRunner({ eventBus: mockEventBus });

    await expect(
      runner.simulateGoal({
        goal: 'Recover tuition fee arrears',
        organizationId: 'org_paused',
        workspaceId: 'ws_test',
      })
    ).rejects.toThrowError(/emergency-paused/);
  });

  it('aborts cleanly when AbortSignal is cancelled before execution', async () => {
    const runner = new SupervisorShadowRunner({ eventBus: mockEventBus });
    const controller = new AbortController();
    controller.abort();

    await expect(
      runner.simulateGoal(
        {
          goal: 'Recover tuition fee arrears',
          organizationId: 'org_test',
          workspaceId: 'ws_test',
        },
        { abortSignal: controller.signal }
      )
    ).rejects.toThrowError(/aborted/);
  });
});
