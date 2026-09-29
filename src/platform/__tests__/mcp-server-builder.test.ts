// @vitest-environment node
/**
 * @fileOverview MCP server builder tests (round-2 blocker R2)
 *
 * Covers the per-tool pipeline through the public `createCapabilityToolHandler` (no SDK internals):
 * no anonymous fallback, tenant binding from the authenticated principal, handler receives parsed
 * input, generic error messages, idempotency key derivation, output validation and audit.
 */

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod/v4';
import {
  buildDomainMcpServer,
  createCapabilityToolHandler,
  type McpToolAuditEntry,
} from '../mcp/create-stateless-handler';
import { toMcpToolSchema } from '../mcp/to-mcp-tool-schema';
import type {
  AgentPrincipal,
  CapabilityDefinition,
  CapabilityExecutionContext,
  CapabilityExecutionResult,
} from '../capabilities/contracts/capability-definition';

type SearchInput = { query: string; workspaceId?: string };
type SearchOutput = { result: string };

const principal: AgentPrincipal = {
  actorType: 'user', // the MCP handler must still apply agent rules
  userId: 'admin-1',
  organizationId: 'org-1',
  workspaceId: 'ws-1',
  grantedScopes: ['contacts.read'],
  effectiveRole: 'admin',
};

function capability(
  handler: (input: SearchInput, ctx: CapabilityExecutionContext) => Promise<CapabilityExecutionResult<SearchOutput>>,
  policies: CapabilityDefinition<SearchInput, SearchOutput>['policies'] = {
    requiresIdempotencyKey: false,
    requiresExpectedVersion: false,
    auditRequired: true,
  }
): CapabilityDefinition<SearchInput, SearchOutput> {
  return {
    id: 'crm.contact.search',
    version: '1.0.0',
    name: 'Search Contacts',
    description: 'Searches contacts by name or email',
    domain: 'crm_contacts',
    operation: 'search',
    inputSchema: z.object({ query: z.string().trim().min(1), workspaceId: z.string().optional() }),
    outputSchema: z.object({ result: z.string() }),
    permissions: ['contacts.read'],
    workspaceScoped: true,
    tenantScoped: true,
    risk: {
      level: 'L0_READ',
      destructive: false,
      idempotent: true,
      openWorld: false,
      requiresHumanApproval: false,
      nonDelegable: false,
    },
    execution: {
      synchronous: true,
      maxDurationMs: 5000,
      supportsDryRun: true,
      supportsCancellation: false,
      supportsCompensation: false,
      maxPayloadSizeBytes: 1024 * 1024,
    },
    policies,
    handler,
  };
}

const found = (text: string): CapabilityExecutionResult<SearchOutput> => ({
  success: true,
  data: { result: text },
  executionId: 'exec-test-1',
  emittedEvents: [],
  durationMs: 1,
});

describe('buildDomainMcpServer', () => {
  it('builds with whole Zod v4 schemas (no raw-shape crash)', () => {
    const server = buildDomainMcpServer({
      domain: 'crm',
      version: '1.0.0',
      capabilities: [capability(async () => found('x'))],
      getPrincipal: () => principal,
      audit: () => undefined,
    });
    expect(server).toBeDefined();
  });

  it('advertises a real JSON Schema and validates via the adapter', async () => {
    const schema = toMcpToolSchema(z.object({ query: z.string() }));
    const json = schema['~standard'].jsonSchema.input({ target: 'draft-2020-12' });
    expect(json).toMatchObject({ type: 'object', properties: { query: { type: 'string' } }, required: ['query'] });
    const bad = await schema['~standard'].validate({ query: 1 });
    expect('issues' in bad && bad.issues).toBeTruthy();
  });

  it('refuses to expose audit-required capabilities without an audit sink', () => {
    expect(() =>
      buildDomainMcpServer({
        domain: 'crm',
        version: '1.0.0',
        capabilities: [capability(async () => found('x'))],
        getPrincipal: () => principal,
      })
    ).toThrow(/no audit sink/);
  });
});

describe('createCapabilityToolHandler', () => {
  it('executes with PARSED input for an authorized caller and audits success', async () => {
    const audit = vi.fn<(entry: McpToolAuditEntry) => void>();
    const handler = vi.fn(async (input: SearchInput) => found(`Found contacts for: ${input.query}`));
    const tool = createCapabilityToolHandler(capability(handler), { getPrincipal: () => principal, audit });

    const response = await tool({ query: '  Alice  ' });

    expect(response.isError).toBeUndefined();
    expect(response.content[0].text).toContain('Found contacts for: Alice'); // trimmed by the schema
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ decision: 'allowed', outcome: 'succeeded', userId: 'admin-1' }));
  });

  it('denies when no principal is resolved (no anonymous fallback)', async () => {
    const handler = vi.fn(async () => found('x'));
    const tool = createCapabilityToolHandler(capability(handler), { getPrincipal: () => null, audit: () => undefined });
    const response = await tool({ query: 'Alice' });
    expect(response.isError).toBe(true);
    expect(response.content[0].text).toContain('authentication required');
    expect(handler).not.toHaveBeenCalled();
  });

  it('denies arguments that target another workspace than the caller', async () => {
    const handler = vi.fn(async () => found('x'));
    const tool = createCapabilityToolHandler(capability(handler), { getPrincipal: () => principal, audit: () => undefined });
    const response = await tool({ query: 'Alice', workspaceId: 'ws-OTHER' });
    expect(response.isError).toBe(true);
    expect(handler).not.toHaveBeenCalled();
  });

  it('denies a caller missing the required scope', async () => {
    const handler = vi.fn(async () => found('x'));
    const tool = createCapabilityToolHandler(capability(handler), {
      getPrincipal: () => ({ ...principal, grantedScopes: ['other.scope'] }),
      audit: () => undefined,
    });
    const response = await tool({ query: 'Alice' });
    expect(response.isError).toBe(true);
    expect(response.content[0].text).toContain('Access denied');
    expect(handler).not.toHaveBeenCalled();
  });

  it('rejects invalid input with field paths only', async () => {
    const tool = createCapabilityToolHandler(capability(async () => found('x')), { getPrincipal: () => principal, audit: () => undefined });
    const response = await tool({ query: 12345 });
    expect(response.isError).toBe(true);
    expect(response.content[0].text).toMatch(/^Invalid input: query:/);
  });

  it('never returns exception details to the model', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const tool = createCapabilityToolHandler(
      capability(async () => {
        throw new Error('db password=hunter2');
      }),
      { getPrincipal: () => principal, audit: () => undefined }
    );
    const response = await tool({ query: 'Alice' });
    expect(response.isError).toBe(true);
    expect(response.content[0].text).not.toContain('hunter2');
    spy.mockRestore();
  });

  it('fails results that violate the output schema', async () => {
    const tool = createCapabilityToolHandler(
      capability(async () => ({ success: true, data: { result: 42 as unknown as string }, executionId: 'e', emittedEvents: [], durationMs: 1 })),
      { getPrincipal: () => principal, audit: () => undefined }
    );
    const response = await tool({ query: 'Alice' });
    expect(response.isError).toBe(true);
    expect(response.content[0].text).toContain('invalid result');
  });

  it('derives a deterministic idempotency key for capabilities that require one', async () => {
    const keys: Array<string | undefined> = [];
    const cap = capability(
      async (_input, ctx) => {
        keys.push(ctx.idempotencyKey);
        return found('ok');
      },
      { requiresIdempotencyKey: true, requiresExpectedVersion: false, auditRequired: false }
    );
    const tool = createCapabilityToolHandler(cap, { getPrincipal: () => principal });
    await tool({ query: 'Alice' });
    await tool({ query: '  Alice ' }); // same after parsing → same key
    await tool({ query: 'Bob' });
    expect(keys[0]).toMatch(/^mcp:[0-9a-f]{64}$/);
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).not.toBe(keys[0]);
  });
});
