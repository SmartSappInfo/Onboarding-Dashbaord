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
              conditions: [{ id: 'c2', field: 'entityType', operator: 'is', value: 'institution' }]
            }
          ]
        }
      }
    };

    expect(await evaluateConditionNode(multiGroupNode, { status: 'active', entityType: 'person' })).toBe(true);
    expect(await evaluateConditionNode(multiGroupNode, { status: 'inactive', entityType: 'institution' })).toBe(true);
    expect(await evaluateConditionNode(multiGroupNode, { status: 'inactive', entityType: 'person' })).toBe(false);
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

  describe('Messaging Engagement Conditions', () => {
    it('evaluates email_action operators against messageLogs and activities', async () => {
      const emailNode = {
        data: {
          config: {
            field: 'email_action',
            operator: 'opened',
            emailTemplateId: 'tmpl-welcome-email',
          },
        },
      };

      // Scenario 1: Email opened activity exists
      expect(
        await evaluateConditionNode(emailNode, {
          openedEmails: ['tmpl-welcome-email'],
        })
      ).toBe(true);

      // Scenario 2: Email opened log exists
      expect(
        await evaluateConditionNode(emailNode, {
          messageLogs: [
            { templateId: 'tmpl-welcome-email', channel: 'email', status: 'opened' },
          ],
        })
      ).toBe(true);

      // Scenario 3: Email not opened
      const notOpenedNode = {
        data: {
          config: {
            field: 'email_action',
            operator: 'not_opened',
            emailTemplateId: 'tmpl-welcome-email',
          },
        },
      };
      expect(
        await evaluateConditionNode(notOpenedNode, {
          openedEmails: ['other-email'],
          messageLogs: [
            { templateId: 'tmpl-welcome-email', channel: 'email', status: 'sent' },
          ],
        })
      ).toBe(true);
    });

    it('evaluates sms_action operators correctly', async () => {
      const smsNode = {
        data: {
          config: {
            field: 'sms_action',
            operator: 'received',
            emailTemplateId: 'tmpl-sms-alert',
          },
        },
      };

      expect(
        await evaluateConditionNode(smsNode, {
          messageLogs: [
            { templateId: 'tmpl-sms-alert', channel: 'sms', status: 'delivered' },
          ],
        })
      ).toBe(true);

      expect(
        await evaluateConditionNode(smsNode, {
          messageLogs: [
            { templateId: 'tmpl-sms-alert', channel: 'sms', status: 'failed' },
          ],
        })
      ).toBe(false);
    });

    it('evaluates whatsapp_action operators correctly', async () => {
      const waNode = {
        data: {
          config: {
            field: 'whatsapp_action',
            operator: 'opened',
            emailTemplateId: 'tmpl-wa-hello',
          },
        },
      };

      // WhatsApp status 'read' counts as opened
      expect(
        await evaluateConditionNode(waNode, {
          messageLogs: [
            { templateId: 'tmpl-wa-hello', channel: 'whatsapp', status: 'read' },
          ],
        })
      ).toBe(true);

      // WhatsApp status 'sent' does not count as opened
      expect(
        await evaluateConditionNode(waNode, {
          messageLogs: [
            { templateId: 'tmpl-wa-hello', channel: 'whatsapp', status: 'sent' },
          ],
        })
      ).toBe(false);
    });
  });
});
