import { describe, it, expect, vi, beforeEach } from 'vitest';

const docRegistry = new Map<string, { exists: boolean; data: () => Record<string, unknown> }>();
const queryRegistry = new Map<string, unknown>();

// 1. Mock firebase-admin
vi.mock('../../firebase-admin', () => {
  const collectionMock = vi.fn((colName: string) => {
    return createQueryMock(colName);
  });

  function createQueryMock(colName: string) {
    const q: Record<string, unknown> = {
      where: vi.fn().mockImplementation(() => q),
      orderBy: vi.fn().mockImplementation(() => q),
      limit: vi.fn().mockImplementation(() => q),
      get: vi.fn(() => {
        if (queryRegistry.has(colName)) {
          const val = queryRegistry.get(colName);
          if (typeof val === 'function') return val();
          return Promise.resolve(val);
        }
        return Promise.resolve({ empty: true, docs: [] });
      }),
      doc: vi.fn((docId: string) => {
        return createDocMock(colName, docId);
      }),
    };
    return q;
  }

  function createDocMock(colName: string, docId: string) {
    const d: Record<string, unknown> = {
      get: vi.fn(() => {
        const key = `${colName}/${docId}`;
        if (docRegistry.has(key)) {
          const val = docRegistry.get(key);
          return Promise.resolve(val);
        }
        return Promise.resolve({ exists: false, data: () => ({}) });
      }),
      collection: vi.fn((subColName: string) => {
        return createQueryMock(`${colName}/${docId}/${subColName}`);
      }),
      update: vi.fn().mockResolvedValue({}),
    };
    return d;
  }

  return {
    adminDb: {
      collection: collectionMock,
    },
  };
});

import { FieldsVariablesService } from '../fields-variables-service-impl';
import { TEMPLATES } from '../../messaging-templates-registry';
import { MESSAGING_TRIGGERS } from '../../messaging-triggers';

describe('Deal and Assignment Variable Resolution Suite', () => {
  beforeEach(() => {
    docRegistry.clear();
    queryRegistry.clear();
  });

  it('triggers registry includes deal_assigned and multi-channel assignment_notification', () => {
    const assignTrigger = MESSAGING_TRIGGERS.find(t => t.id === 'assignment_notification');
    expect(assignTrigger).toBeDefined();
    expect(assignTrigger?.supportedChannels).toContain('email');
    expect(assignTrigger?.supportedChannels).toContain('sms');
    expect(assignTrigger?.supportedChannels).toContain('whatsapp');

    const dealTrigger = MESSAGING_TRIGGERS.find(t => t.id === 'deal_assigned');
    expect(dealTrigger).toBeDefined();
    expect(dealTrigger?.supportedChannels).toContain('email');
    expect(dealTrigger?.supportedChannels).toContain('sms');
    expect(dealTrigger?.supportedChannels).toContain('whatsapp');
  });

  it('resolves Email assignment notification template for a deal with zero unescaped tags', async () => {
    // Mock workspace and organization
    docRegistry.set('workspaces/ws_1', {
      exists: true,
      data: () => ({ name: 'Accra Campus', organizationId: 'org_1' }),
    });
    docRegistry.set('organizations/org_1', {
      exists: true,
      data: () => ({ name: 'SmartSapp', email: 'hello@smartsapp.com' }),
    });

    // Mock Deal
    docRegistry.set('deals/deal_999', {
      exists: true,
      data: () => ({
        id: 'deal_999',
        name: 'Yes',
        value: 15000,
        assignedTo: {
          userId: 'usr_joseph',
          name: 'Joseph Aidoo',
          email: 'joseph@smartsapp.com',
        },
      }),
    });

    const emailTemplate = TEMPLATES.find(
      t => t.templateType === 'assignment_notification' && t.channel === 'email'
    );
    expect(emailTemplate).toBeDefined();

    const resolvedSubject = await FieldsVariablesService.resolveTemplateVariables(
      emailTemplate!.subject || '',
      {
        workspaceId: 'ws_1',
        dealId: 'deal_999',
        extraVars: {
          assigner_name: 'Sarah Connor',
        },
      }
    );

    const resolvedBody = await FieldsVariablesService.resolveTemplateVariables(
      emailTemplate!.body,
      {
        workspaceId: 'ws_1',
        dealId: 'deal_999',
        extraVars: {
          assigner_name: 'Sarah Connor',
        },
      }
    );

    // Subject check: "Yes has been assigned to you"
    expect(resolvedSubject).toBe('Yes has been assigned to you');
    expect(resolvedSubject).not.toMatch(/\{\{.*?\}\}/);

    // Body check
    expect(resolvedBody).toContain('Hi Joseph Aidoo');
    expect(resolvedBody).toContain('Yes has been assigned to you by Sarah Connor');
    expect(resolvedBody).toContain('SmartSapp');
    expect(resolvedBody).not.toMatch(/\{\{.*?\}\}/);
  });

  it('resolves SMS assignment notification template for a deal', async () => {
    docRegistry.set('workspaces/ws_1', {
      exists: true,
      data: () => ({ name: 'Accra Campus', organizationId: 'org_1' }),
    });
    docRegistry.set('deals/deal_999', {
      exists: true,
      data: () => ({
        id: 'deal_999',
        name: 'Enterprise License',
        assignedTo: {
          name: 'Kwame Nkrumah',
          userId: 'usr_kwame',
        },
      }),
    });

    const smsTemplate = TEMPLATES.find(
      t => t.templateType === 'assignment_notification' && t.channel === 'sms'
    );
    expect(smsTemplate).toBeDefined();

    const resolvedBody = await FieldsVariablesService.resolveTemplateVariables(
      smsTemplate!.body,
      {
        workspaceId: 'ws_1',
        dealId: 'deal_999',
        extraVars: {
          assigner_name: 'Director Mensah',
        },
      }
    );

    expect(resolvedBody).toContain('Hi Kwame Nkrumah');
    expect(resolvedBody).toContain('Enterprise License has been assigned to you by Director Mensah');
    expect(resolvedBody).toContain('/admin/deals/deal_999');
    expect(resolvedBody).not.toMatch(/\{\{.*?\}\}/);
  });

  it('resolves WhatsApp assignment notification template for a deal', async () => {
    docRegistry.set('workspaces/ws_1', {
      exists: true,
      data: () => ({ name: 'Accra Campus', organizationId: 'org_1' }),
    });
    docRegistry.set('organizations/org_1', {
      exists: true,
      data: () => ({ name: 'SmartSapp Tech' }),
    });
    docRegistry.set('deals/deal_777', {
      exists: true,
      data: () => ({
        id: 'deal_777',
        name: 'Global Rollout',
        assignedTo: {
          name: 'Ama Serwaa',
          userId: 'usr_ama',
        },
      }),
    });

    const waTemplate = TEMPLATES.find(
      t => t.templateType === 'assignment_notification' && t.channel === 'whatsapp'
    );
    expect(waTemplate).toBeDefined();

    const resolvedBody = await FieldsVariablesService.resolveTemplateVariables(
      waTemplate!.body,
      {
        workspaceId: 'ws_1',
        dealId: 'deal_777',
        extraVars: {
          assigner_name: 'Lead Architect',
        },
      }
    );

    expect(resolvedBody).toContain('Hi Ama Serwaa');
    expect(resolvedBody).toContain('*Global Rollout* has been assigned to you by Lead Architect');
    expect(resolvedBody).toContain('/admin/deals/deal_777');
    expect(resolvedBody).toContain('SmartSapp Tech');
    expect(resolvedBody).not.toMatch(/\{\{.*?\}\}/);
  });

  it('resolves Deal Assignment specific templates (Email, SMS, WhatsApp) with pipeline and value', async () => {
    docRegistry.set('workspaces/ws_1', {
      exists: true,
      data: () => ({ name: 'Accra Campus', organizationId: 'org_1' }),
    });
    docRegistry.set('organizations/org_1', {
      exists: true,
      data: () => ({ name: 'SmartSapp' }),
    });
    docRegistry.set('pipelines/pipe_1', {
      exists: true,
      data: () => ({ name: 'Enterprise Pipeline' }),
    });
    docRegistry.set('deals/deal_555', {
      exists: true,
      data: () => ({
        id: 'deal_555',
        entityId: 'ent_lead_999',
        name: 'University Contract',
        value: 50000,
        pipelineId: 'pipe_1',
        stageName: 'Negotiation',
        assignedTo: {
          name: 'Kofi Annan',
        },
      }),
    });

    const emailTemplate = TEMPLATES.find(
      t => t.templateType === 'deal_assigned' && t.channel === 'email'
    );
    const smsTemplate = TEMPLATES.find(
      t => t.templateType === 'deal_assigned' && t.channel === 'sms'
    );
    const waTemplate = TEMPLATES.find(
      t => t.templateType === 'deal_assigned' && t.channel === 'whatsapp'
    );

    expect(emailTemplate).toBeDefined();
    expect(smsTemplate).toBeDefined();
    expect(waTemplate).toBeDefined();

    const emailBody = await FieldsVariablesService.resolveTemplateVariables(
      emailTemplate!.body,
      {
        workspaceId: 'ws_1',
        dealId: 'deal_555',
        extraVars: {
          assigner_name: 'Regional VP',
        },
      }
    );

    expect(emailBody).toContain('Hi Kofi Annan');
    expect(emailBody).toContain('assigned to deal University Contract by Regional VP');
    expect(emailBody).toContain('Deal Value: 50000');
    expect(emailBody).toContain('Pipeline: Enterprise Pipeline');
    expect(emailBody).toContain('Stage: Negotiation');
    expect(emailBody).toContain('/admin/entities/ent_lead_999');
    expect(emailBody).toContain('/admin/deals/deal_555');
    expect(emailBody).not.toMatch(/\{\{.*?\}\}/);

    const smsBody = await FieldsVariablesService.resolveTemplateVariables(
      smsTemplate!.body,
      {
        workspaceId: 'ws_1',
        dealId: 'deal_555',
        extraVars: {
          assigner_name: 'Regional VP',
        },
      }
    );
    expect(smsBody).toContain('Hi Kofi Annan');
    expect(smsBody).toContain('University Contract');
    expect(smsBody).toContain('50000');
    expect(smsBody).toContain('/admin/entities/ent_lead_999');
    expect(smsBody).not.toMatch(/\{\{.*?\}\}/);

    const waBody = await FieldsVariablesService.resolveTemplateVariables(
      waTemplate!.body,
      {
        workspaceId: 'ws_1',
        dealId: 'deal_555',
        extraVars: {
          assigner_name: 'Regional VP',
        },
      }
    );
    expect(waBody).toContain('Hi Kofi Annan');
    expect(waBody).toContain('*University Contract*');
    expect(waBody).toContain('*Pipeline:* Enterprise Pipeline');
    expect(waBody).toContain('/admin/entities/ent_lead_999');
    expect(waBody).not.toMatch(/\{\{.*?\}\}/);
  });

  it('registers lead_link and lead_url in template variables registry', async () => {
    const { STATIC_VARIABLES } = await import('../../template-variable-registry-data');
    const leadLink = STATIC_VARIABLES.find(v => v.name === 'lead_link');
    const leadUrl = STATIC_VARIABLES.find(v => v.name === 'lead_url');

    expect(leadLink).toBeDefined();
    expect(leadLink?.dataType).toBe('url');
    expect(leadUrl).toBeDefined();
    expect(leadUrl?.dataType).toBe('url');
  });

  it('unwraps assignedTo object in extraVars and actorUserId for assigner resolution', async () => {
    docRegistry.set('workspaces/ws_1', {
      exists: true,
      data: () => ({ name: 'Campus' }),
    });
    docRegistry.set('users/usr_actor', {
      exists: true,
      data: () => ({ name: 'Madam Akua', email: 'akua@smartsapp.com' }),
    });

    const templateText = 'Hi {{assigned_to}}, deal {{deal_name}} was assigned by {{assigner_name}}.';

    const resolved = await FieldsVariablesService.resolveTemplateVariables(templateText, {
      workspaceId: 'ws_1',
      extraVars: {
        deal_name: 'Alpha Deal',
        assignedTo: {
          name: 'Nana Yaw',
          userId: 'usr_yaw',
        },
        actorUserId: 'usr_actor',
      },
    });

    expect(resolved).toBe('Hi Nana Yaw, deal Alpha Deal was assigned by Madam Akua.');
    expect(resolved).not.toMatch(/\{\{.*?\}\}/);
  });

  it('falls back cleanly to default placeholders without leaking raw tokens', async () => {
    docRegistry.set('workspaces/ws_1', {
      exists: true,
      data: () => ({ name: 'Campus' }),
    });

    const templateText = 'Hi {{assigned_to}}, {{entity_name}} has been assigned to you by {{assigner_name}}.';

    const resolved = await FieldsVariablesService.resolveTemplateVariables(templateText, {
      workspaceId: 'ws_1',
      extraVars: {
        entity_name: 'Yes',
      },
    });

    expect(resolved).toBe('Hi Colleague, Yes has been assigned to you by Your Team Lead.');
    expect(resolved).not.toMatch(/\{\{.*?\}\}/);
  });
});
