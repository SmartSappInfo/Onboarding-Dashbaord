/**
 * @fileOverview Unit Tests for AI Workforce Risk Engine & Role Advisor Services
 */

import { describe, it, expect } from 'vitest';
import { AiRoleAdvisorService } from '../ai-role-advisor-service';

describe('AiRoleAdvisorService Execution Gate', () => {
  it('throws an error when attempting to apply a non-existent recommendation', async () => {
    await expect(
      AiRoleAdvisorService.applyRecommendation('org-test', 'non-existent-rec-id', 'admin-1')
    ).rejects.toThrow(/not found/i);
  });
});
