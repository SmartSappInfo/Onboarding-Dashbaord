/**
 * @fileOverview Unit & Integration Tests for Governance 2.0 Services
 */

import { describe, it, expect } from 'vitest';
import { SeparationOfDutyService } from '../separation-of-duty-service';

describe('SeparationOfDutyService Logic', () => {
  it('rejects creating SoD rules with identical roles', async () => {
    await expect(
      SeparationOfDutyService.createOrUpdateRule('org-test', {
        name: 'Invalid Rule',
        description: 'Testing identical roles',
        roleIdA: 'role-billing',
        roleNameA: 'Billing Officer',
        roleIdB: 'role-billing',
        roleNameB: 'Billing Officer',
        severity: 'high',
        enforcementMode: 'block',
      })
    ).rejects.toThrow('must specify two distinct roles');
  });
});
