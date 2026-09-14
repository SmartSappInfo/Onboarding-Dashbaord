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

  describe('Find Contact outcome evaluations', () => {
    it('evaluates is_found, is_created, not_found, and successful operators', async () => {
      const foundNode = {
        data: {
          config: {
            field: 'find_contact_status',
            operator: 'is_found',
          },
        },
      };

      const createdNode = {
        data: {
          config: {
            field: 'find_contact_status',
            operator: 'is_created',
          },
        },
      };

      const notFoundNode = {
        data: {
          config: {
            field: 'find_contact_status',
            operator: 'not_found',
          },
        },
      };

      const successfulNode = {
        data: {
          config: {
            field: 'find_contact_status',
            operator: 'successful',
          },
        },
      };

      // Case 1: Existing contact found
      const foundPayload = {
        contactFound: true,
        contactCreated: false,
        findContactStatus: 'found',
      };
      expect(await evaluateConditionNode(foundNode, foundPayload)).toBe(true);
      expect(await evaluateConditionNode(createdNode, foundPayload)).toBe(false);
      expect(await evaluateConditionNode(notFoundNode, foundPayload)).toBe(false);
      expect(await evaluateConditionNode(successfulNode, foundPayload)).toBe(true);

      // Case 2: New contact auto-created
      const createdPayload = {
        contactFound: false,
        contactCreated: true,
        findContactStatus: 'created',
      };
      expect(await evaluateConditionNode(foundNode, createdPayload)).toBe(false);
      expect(await evaluateConditionNode(createdNode, createdPayload)).toBe(true);
      expect(await evaluateConditionNode(notFoundNode, createdPayload)).toBe(false);
      expect(await evaluateConditionNode(successfulNode, createdPayload)).toBe(true);

      // Case 3: Contact not found
      const notFoundPayload = {
        contactFound: false,
        contactCreated: false,
        findContactStatus: 'not_found',
      };
      expect(await evaluateConditionNode(foundNode, notFoundPayload)).toBe(false);
      expect(await evaluateConditionNode(createdNode, notFoundPayload)).toBe(false);
      expect(await evaluateConditionNode(notFoundNode, notFoundPayload)).toBe(true);
      expect(await evaluateConditionNode(successfulNode, notFoundPayload)).toBe(false);
    });

    it('evaluates is and is_not operators with value criteria', async () => {
      const isFoundNode = {
        data: {
          config: {
            field: 'find_contact_status',
            operator: 'is',
            value: 'found',
          },
        },
      };

      const isCreatedNode = {
        data: {
          config: {
            field: 'find_contact_status',
            operator: 'is',
            value: 'created',
          },
        },
      };

      const isNotCreatedNode = {
        data: {
          config: {
            field: 'find_contact_status',
            operator: 'is_not',
            value: 'created',
          },
        },
      };

      expect(await evaluateConditionNode(isFoundNode, { findContactStatus: 'found', contactFound: true })).toBe(true);
      expect(await evaluateConditionNode(isFoundNode, { findContactStatus: 'created', contactCreated: true })).toBe(false);

      expect(await evaluateConditionNode(isCreatedNode, { findContactStatus: 'created', contactCreated: true })).toBe(true);
      expect(await evaluateConditionNode(isCreatedNode, { findContactStatus: 'not_found', contactFound: false })).toBe(false);

      expect(await evaluateConditionNode(isNotCreatedNode, { findContactStatus: 'found', contactFound: true })).toBe(true);
      expect(await evaluateConditionNode(isNotCreatedNode, { findContactStatus: 'created', contactCreated: true })).toBe(false);
    });

    it('evaluates boolean find_contact_found and find_contact_created conditions', async () => {
      const foundBoolNode = {
        data: {
          config: {
            field: 'find_contact_found',
            operator: 'is_true',
          },
        },
      };

      const createdBoolNode = {
        data: {
          config: {
            field: 'find_contact_created',
            operator: 'is_true',
          },
        },
      };

      expect(await evaluateConditionNode(foundBoolNode, { contactFound: true, contactCreated: false })).toBe(true);
      expect(await evaluateConditionNode(foundBoolNode, { contactFound: false, contactCreated: true })).toBe(false);

      expect(await evaluateConditionNode(createdBoolNode, { contactFound: false, contactCreated: true })).toBe(true);
      expect(await evaluateConditionNode(createdBoolNode, { contactFound: true, contactCreated: false })).toBe(false);
    });

    it('evaluates step-scoped search conditions with cond.stepId', async () => {
      const step1Condition = {
        data: {
          config: {
            groups: [
              {
                id: 'g1',
                relation: 'and' as const,
                conditions: [
                  {
                    id: 'c1',
                    field: 'find_contact_status',
                    operator: 'is_found',
                    stepId: 'step_search_phone',
                  },
                ],
              },
            ],
          },
        },
      };

      const step2Condition = {
        data: {
          config: {
            groups: [
              {
                id: 'g2',
                relation: 'and' as const,
                conditions: [
                  {
                    id: 'c2',
                    field: 'find_contact_status',
                    operator: 'is_created',
                    stepId: 'step_search_email',
                  },
                ],
              },
            ],
          },
        },
      };

      // Payload where step 1 was not found, but step 2 auto-created the contact
      const multiStepPayload: Record<string, unknown> = {
        'step_search_phone.contactFound': false,
        'step_search_phone.contactCreated': false,
        'step_search_phone.findContactStatus': 'not_found',
        'step_search_email.contactFound': false,
        'step_search_email.contactCreated': true,
        'step_search_email.findContactStatus': 'created',
        // Top-level payload represents the latest step (step 2)
        contactFound: false,
        contactCreated: true,
        findContactStatus: 'created',
      };

      expect(await evaluateConditionNode(step1Condition, multiStepPayload)).toBe(false);
      expect(await evaluateConditionNode(step2Condition, multiStepPayload)).toBe(true);
    });

    it('gracefully falls back to top-level payload if referenced step was deleted', async () => {
      const deletedStepCondition = {
        data: {
          config: {
            field: 'find_contact_status',
            operator: 'is_found',
            stepId: 'deleted_step_999',
          },
        },
      };

      // Payload has top-level contactFound: true from remaining search step
      const payloadWithFallback = {
        contactFound: true,
        contactCreated: false,
        findContactStatus: 'found',
      };

      expect(await evaluateConditionNode(deletedStepCondition, payloadWithFallback)).toBe(true);
    });

    it('returns false when no search action was ever executed in the run', async () => {
      const searchCondition = {
        data: {
          config: {
            field: 'find_contact_status',
            operator: 'not_found',
          },
        },
      };

      // Empty payload without any search keys
      expect(await evaluateConditionNode(searchCondition, {})).toBe(false);
    });
  });
});
