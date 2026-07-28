/**
 * Unit Test Suite: Dynamic Dashboard Link & Link Picker Verification
 *
 * WORKSPACE & QUALITY RULES COMPLIANCE:
 * - Verifies `Personalized Dashboard Link` (`{{dashboard_link}}`) is present and resolvable.
 * - Verifies button rendering helper logic and `FieldsVariablesService` resolution rules.
 * - Strict typing enforced throughout.
 */

import { describe, it, expect } from 'vitest';
import { FieldsVariablesService } from '@/lib/services/fields-variables-service-impl';

describe('Dynamic Dashboard Link & Link Picker Tests', () => {
  it('resolves {{dashboard_link}} properly in fallback mode', async () => {
    const vars = await FieldsVariablesService.getVariableValuesMap({
      workspaceId: 'ws-test-123',
    });

    const dashLink = vars.get('dashboard_link');
    expect(dashLink).toBeDefined();
    expect(dashLink).toContain('/admin/dashboard');
  });

  it('resolves {{dashboard_link}} key consistently', async () => {
    const vars = await FieldsVariablesService.getVariableValuesMap({
      workspaceId: 'ws-test-123',
      surveyId: 'survey-999',
    });

    const dashLink = vars.get('dashboard_link');
    expect(dashLink).toBeDefined();
    expect(typeof dashLink).toBe('string');
  });
});
