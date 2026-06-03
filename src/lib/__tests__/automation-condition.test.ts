import { describe, it, expect } from 'vitest';
import { evaluateConditionNode } from '../automation-condition';

describe('evaluateConditionNode (Advanced Segment Logic)', () => {
  // Legacy flat configuration for backwards-compatibility
  const legacyNode = {
    data: {
      config: { field: 'status', operator: 'equals', value: 'active' },
    },
  };

  it('evaluates equals on legacy flat node', async () => {
    expect(await evaluateConditionNode(legacyNode, { status: 'active' })).toBe(true);
    expect(await evaluateConditionNode(legacyNode, { status: 'inactive' })).toBe(false);
  });

  it('evaluates contains operator on legacy flat node', async () => {
    const containsNode = {
      data: { config: { field: 'email', operator: 'contains', value: '@school.edu' } },
    };
    expect(await evaluateConditionNode(containsNode, { email: 'admin@school.edu' })).toBe(true);
    expect(await evaluateConditionNode(containsNode, { email: 'admin@gmail.com' })).toBe(false);
  });

  it('returns false when legacy node field or operator is missing', async () => {
    expect(await evaluateConditionNode({ data: { config: { field: 'x' } } }, {})).toBe(false);
  });

  // Nested Groups Evaluation
  it('evaluates condition groups with AND logic', async () => {
    const andGroupNode = {
      data: {
        config: {
          relation: 'AND' as const,
          groups: [
            {
              id: 'group_1',
              relation: 'AND' as const,
              conditions: [
                { id: 'c1', field: 'status', operator: 'is', value: 'active' },
                { id: 'c2', field: 'firstName', operator: 'contains', value: 'Jac' }
              ]
            }
          ]
        }
      }
    };

    expect(await evaluateConditionNode(andGroupNode, { status: 'active', firstName: 'Jacob' })).toBe(true);
    expect(await evaluateConditionNode(andGroupNode, { status: 'inactive', firstName: 'Jacob' })).toBe(false);
    expect(await evaluateConditionNode(andGroupNode, { status: 'active', firstName: 'John' })).toBe(false);
  });

  it('evaluates condition groups with OR logic within the group', async () => {
    const orGroupNode = {
      data: {
        config: {
          relation: 'AND' as const,
          groups: [
            {
              id: 'group_1',
              relation: 'OR' as const,
              conditions: [
                { id: 'c1', field: 'status', operator: 'is', value: 'active' },
                { id: 'c2', field: 'firstName', operator: 'contains', value: 'Jac' }
              ]
            }
          ]
        }
      }
    };

    expect(await evaluateConditionNode(orGroupNode, { status: 'active', firstName: 'John' })).toBe(true);
    expect(await evaluateConditionNode(orGroupNode, { status: 'inactive', firstName: 'Jacob' })).toBe(true);
    expect(await evaluateConditionNode(orGroupNode, { status: 'inactive', firstName: 'John' })).toBe(false);
  });

  it('evaluates multiple condition groups joined by OR', async () => {
    const multiGroupNode = {
      data: {
        config: {
          relation: 'OR' as const,
          groups: [
            {
              id: 'g1',
              relation: 'AND' as const,
              conditions: [{ id: 'c1', field: 'status', operator: 'is', value: 'active' }]
            },
            {
              id: 'g2',
              relation: 'AND' as const,
              conditions: [{ id: 'c2', field: 'lifecycleStatus', operator: 'is', value: 'Onboarding' }]
            }
          ]
        }
      }
    };

    expect(await evaluateConditionNode(multiGroupNode, { status: 'active', lifecycleStatus: 'Lead' })).toBe(true);
    expect(await evaluateConditionNode(multiGroupNode, { status: 'inactive', lifecycleStatus: 'Onboarding' })).toBe(true);
    expect(await evaluateConditionNode(multiGroupNode, { status: 'inactive', lifecycleStatus: 'Lead' })).toBe(false);
  });

  // Tag Operators Evaluation
  it('evaluates tag conditions', async () => {
    const tagNode = {
      data: {
        config: {
          relation: 'AND' as const,
          groups: [
            {
              id: 'g1',
              relation: 'AND' as const,
              conditions: [
                { id: 'c1', field: 'tags', operator: 'any_of', value: ['tag_vip', 'tag_active'] }
              ]
            }
          ]
        }
      }
    };

    expect(await evaluateConditionNode(tagNode, { tagIds: ['tag_vip', 'tag_new'] })).toBe(true);
    expect(await evaluateConditionNode(tagNode, { tagIds: ['tag_new', 'tag_warm'] })).toBe(false);
  });

  // Saved Audience Dependency Injection Resolution
  it('resolves saved audiences dynamically', async () => {
    const audienceConditionNode = {
      data: {
        config: {
          relation: 'AND' as const,
          groups: [
            {
              id: 'g1',
              relation: 'AND' as const,
              conditions: [
                { id: 'c1', field: 'saved_audience', operator: 'in_audience', value: 'audience_vip_id' }
              ]
            }
          ]
        }
      }
    };

    const mockResolveAudience = async (id: string) => {
      if (id === 'audience_vip_id') {
        return {
          filterLogic: 'AND',
          groups: [
            {
              id: 'ag1',
              relation: 'AND',
              conditions: [{ id: 'ac1', field: 'vip', operator: 'is', value: 'true' }]
            }
          ]
        };
      }
      return null;
    };

    expect(await evaluateConditionNode(audienceConditionNode, { vip: 'true' }, mockResolveAudience)).toBe(true);
    expect(await evaluateConditionNode(audienceConditionNode, { vip: 'false' }, mockResolveAudience)).toBe(false);
  });

  // Automation Status Checks
  it('evaluates automation conditions using injected checkAutomationStatus resolver', async () => {
    const automationConditionNode = {
      data: {
        config: {
          relation: 'AND' as const,
          groups: [
            {
              id: 'g1',
              relation: 'AND' as const,
              conditions: [
                { id: 'c1', field: 'automation', operator: 'currently_in', value: 'auto_welcome_id' }
              ]
            }
          ]
        }
      }
    };

    const mockCheckAutomation = async (entityId: string, automationId: string, operator: string) => {
      return entityId === 'contact_123' && automationId === 'auto_welcome_id' && operator === 'currently_in';
    };

    expect(
      await evaluateConditionNode(
        automationConditionNode,
        { id: 'contact_123' },
        undefined,
        mockCheckAutomation
      )
    ).toBe(true);

    expect(
      await evaluateConditionNode(
        automationConditionNode,
        { id: 'contact_other' },
        undefined,
        mockCheckAutomation
      )
    ).toBe(false);
  });
});
