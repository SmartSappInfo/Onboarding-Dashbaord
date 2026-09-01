/**
 * @fileOverview Unit Tests for Workforce Intelligence & Executive Analytics Services
 */

import { describe, it, expect } from 'vitest';
import { UserHealthService } from '../user-health-service';
import { TeamUtilizationService } from '../team-utilization-service';

describe('UserHealthService Formula', () => {
  it('calculates bounded health scores and assigns valid status', async () => {
    const health = await UserHealthService.evaluateUserHealth('org-test', 'person-test');
    expect(health.score).toBeGreaterThanOrEqual(0);
    expect(health.score).toBeLessThanOrEqual(100);
    expect(['flourishing', 'healthy', 'strained', 'at_risk', 'dormant']).toContain(health.status);
  });
});

describe('TeamUtilizationService Capacity Bounds', () => {
  it('returns valid squad workload capacities', async () => {
    const teams = await TeamUtilizationService.getTeamUtilizationOverview('org-test');
    expect(teams.length).toBeGreaterThan(0);
    expect(teams[0].capacityPercent).toBeGreaterThanOrEqual(0);
    expect(teams[0].capacityPercent).toBeLessThanOrEqual(100);
  });
});
