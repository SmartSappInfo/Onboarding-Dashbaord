// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveConfigVariables } from '../automations/variables';
import { traverseNodes } from '../automations/nodes/traverse';

const runUpdate = vi.fn();
const mockProcessAction = vi.fn();

vi.mock('../automations/actions', () => ({
  processActionNode: (...args: any[]) => mockProcessAction(...args),
}));

vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn((name: string) => {
      if (name === 'automation_runs') {
        return {
          doc: vi.fn(() => ({
            update: runUpdate,
          })),
        };
      }
      return {
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({ name: 'Acme Test Entity', email: 'test@acme.com' }),
          }),
        })),
      };
    }),
  },
}));

vi.mock('../contact-adapter', () => ({
  resolveContact: vi.fn().mockResolvedValue({
    name: 'Acme Test Entity',
    primaryContactEmail: 'test@acme.com',
    primaryContactPhone: '+12345678',
    assignedTo: 'usr-111',
  }),
}));

describe('Variable Resolution & Execution Context Enrichment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resolveConfigVariables', () => {
    it('resolves direct variables from payload', () => {
      const config = { title: 'Hello {{body.name}}' };
      const payload = { 'body.name': 'John Doe' };
      const resolved = resolveConfigVariables(config, payload);
      expect(resolved).toEqual({ title: 'Hello John Doe' });
    });

    it('resolves step-prefixed variables with direct match or fallback', () => {
      // Direct match
      const config1 = { recipient: '{{1.body.email}}' };
      const payload1 = { '1.body.email': 'direct@example.com' };
      expect(resolveConfigVariables(config1, payload1)).toEqual({ recipient: 'direct@example.com' });

      // Fallback: 1.body.email -> body.email
      const config2 = { recipient: '{{1.body.email}}' };
      const payload2 = { 'body.email': 'fallback@example.com' };
      expect(resolveConfigVariables(config2, payload2)).toEqual({ recipient: 'fallback@example.com' });
    });

    it('resolves entity variables with direct match or fallback', () => {
      const config = {
        name: '{{entity.displayName}}',
        email: '{{entity.primaryEmail}}',
      };
      const payload = {
        'entity.displayName': 'Custom Display Name',
        entityName: 'Fallback Entity Name',
        'entity.primaryEmail': 'test@example.com',
      };
      expect(resolveConfigVariables(config, payload)).toEqual({
        name: 'Custom Display Name',
        email: 'test@example.com',
      });
    });

    it('resolves entity.displayName fallback to entityName', () => {
      const config = { name: '{{entity.displayName}}' };
      const payload = { entityName: 'Fallback Entity Name' };
      expect(resolveConfigVariables(config, payload)).toEqual({
        name: 'Fallback Entity Name',
      });
    });
  });

  describe('traverseNodes Context Enrichment', () => {
    it('enriches payload with webhook payload (step 1 prefix) and workspace info', async () => {
      const automation = {
        nodes: [
          { id: 't1', type: 'triggerNode' },
          { id: 'a1', type: 'actionNode', data: { label: 'Action 1', actionType: 'CREATE_TASK' } },
        ],
        edges: [
          { id: 'e1', source: 't1', target: 'a1' },
        ],
      };

      const context = {
        runId: 'run-1',
        automationId: 'auto-1',
        workspaceId: 'ws-1',
        payload: {
          source: 'external_webhook',
          body: {
            customer: {
              name: 'John Doe',
              email: 'john@example.com',
            },
          },
          headers: {
            'content-type': 'application/json',
          },
          query: {
            source: 'adwords',
          },
          files: [
            { name: 'resume.pdf', size: 1024, type: 'application/pdf' },
          ],
        },
      };

      mockProcessAction.mockResolvedValue({ id: 'task-100' });

      await traverseNodes('t1', automation, context as any);

      // Verify webhook variables got prefixed with "1." and also mapped cleanly
      expect(context.payload['1.body.customer.name']).toBe('John Doe');
      expect(context.payload['body.customer.name']).toBe('John Doe');
      expect(context.payload['1.headers.content-type']).toBe('application/json');
      expect(context.payload['1.query.source']).toBe('adwords');
      expect(context.payload['1.files[0].name']).toBe('resume.pdf');
      expect(context.payload['workspace.id']).toBe('ws-1');
    });

    it('enriches payload with resolved entity details', async () => {
      const automation = {
        nodes: [
          { id: 't1', type: 'triggerNode' },
          { id: 'a1', type: 'actionNode', data: { label: 'Action 1', actionType: 'CREATE_TASK' } },
        ],
        edges: [
          { id: 'e1', source: 't1', target: 'a1' },
        ],
      };

      const context = {
        runId: 'run-1',
        automationId: 'auto-1',
        workspaceId: 'ws-1',
        entityId: 'ent-999',
        payload: {},
      };

      mockProcessAction.mockResolvedValue({});

      await traverseNodes('t1', automation, context as any);

      expect(context.payload['entity.displayName']).toBe('Acme Test Entity');
      expect(context.payload['entity.primaryEmail']).toBe('test@acme.com');
      expect(context.payload['entity.primaryPhone']).toBe('+12345678');
      expect(context.payload['entity.assignedTo']).toBe('usr-111');
      expect(context.payload['displayName']).toBe('Acme Test Entity');
      expect(context.payload['entityName']).toBe('Acme Test Entity');
    });

    it('propagates action step outputs downstream as step-prefixed variables', async () => {
      const automation = {
        nodes: [
          { id: 't1', type: 'triggerNode' },
          { id: 'a1', type: 'actionNode', data: { label: 'Create Task Step', actionType: 'CREATE_TASK' } },
          { id: 'a2', type: 'actionNode', data: { label: 'Update Task Step', actionType: 'UPDATE_TASK' } },
        ],
        edges: [
          { id: 'e1', source: 't1', target: 'a1' },
          { id: 'e2', source: 'a1', target: 'a2' },
        ],
      };

      const context = {
        runId: 'run-1',
        automationId: 'auto-1',
        workspaceId: 'ws-1',
        payload: {},
      };

      // Mock first action to return task ID output
      mockProcessAction.mockImplementation(async (node) => {
        if (node.id === 'a1') {
          return { id: 'task-abc' };
        }
        return {};
      });

      await traverseNodes('t1', automation, context as any);

      // Trigger is step 1, Action a1 is step 2
      // Verify step 2 output got written into context payload
      expect(context.payload['2.id']).toBe('task-abc');
      expect(context.payload['a1.id']).toBe('task-abc');
    });
  });
});
