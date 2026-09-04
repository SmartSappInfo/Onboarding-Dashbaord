/**
 * @fileOverview Unit Tests for CompanyBrain Phase 6: MCP Platform, Registry & Gateway
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import { McpRegistry } from '../registry';
import { McpGateway } from '../gateway';
import {
  McpToolDefinition,
  McpJsonRpcRequest,
  MCP_ERROR_CODES,
  McpExecutionContext,
} from '../types';

describe('McpRegistry', () => {
  let registry: McpRegistry;

  const mockEchoTool: McpToolDefinition<{ message: string }, { reply: string }> = {
    name: 'test.echo',
    version: '1.0.0',
    category: 'governance',
    description: 'Echoes back the message',
    riskLevel: 'read_only',
    parameters: z.object({
      message: z.string(),
    }),
    responseSchema: z.object({
      reply: z.string(),
    }),
    requiresApproval: false,
    handler: async (params) => {
      return { reply: `Echo: ${params.message}` };
    },
  };

  const mockMutateTool: McpToolDefinition<{ entityId: string; status: string }, { success: boolean }> = {
    name: 'test.mutate',
    version: '1.0.0',
    category: 'crm',
    description: 'Updates entity status',
    riskLevel: 'high_risk',
    parameters: z.object({
      entityId: z.string(),
      status: z.string(),
    }),
    responseSchema: z.object({
      success: z.boolean(),
    }),
    requiresApproval: true,
    handler: async () => {
      return { success: true };
    },
  };

  beforeEach(() => {
    registry = new McpRegistry();
  });

  it('registers and retrieves a tool by name', () => {
    registry.registerTool(mockEchoTool);
    expect(registry.hasTool('test.echo')).toBe(true);
    const retrieved = registry.getTool('test.echo');
    expect(retrieved).toBeDefined();
    expect(retrieved?.description).toBe('Echoes back the message');
    expect(retrieved?.riskLevel).toBe('read_only');
  });

  it('throws an error when registering a duplicate tool name', () => {
    registry.registerTool(mockEchoTool);
    expect(() => registry.registerTool(mockEchoTool)).toThrow(
      /already registered/
    );
  });

  it('lists all registered tools and filters by category', () => {
    registry.registerTool(mockEchoTool);
    registry.registerTool(mockMutateTool);

    const all = registry.listTools();
    expect(all.length).toBe(2);

    const crmOnly = registry.listTools('crm');
    expect(crmOnly.length).toBe(1);
    expect(crmOnly[0].name).toBe('test.mutate');

    const memOnly = registry.listTools('memory');
    expect(memOnly.length).toBe(0);
  });

  it('generates public tool descriptors for client discovery', () => {
    registry.registerTool(mockEchoTool);
    const descriptors = registry.getToolDescriptors();
    expect(descriptors.length).toBe(1);
    expect(descriptors[0].name).toBe('test.echo');
    expect(descriptors[0].riskLevel).toBe('read_only');
    expect(descriptors[0].category).toBe('governance');
  });
});

describe('McpGateway', () => {
  let registry: McpRegistry;

  const mockContext: McpExecutionContext = {
    workspaceId: 'ws_unit_test',
    organizationId: 'org_unit_test',
    callerId: 'unit_tester',
    callerType: 'user',
    requestId: 'req_001',
    callDepth: 0,
    timestamp: new Date().toISOString(),
  };

  const echoTool: McpToolDefinition<{ text: string }, { result: string }> = {
    name: 'test.greet',
    version: '1.0.0',
    category: 'governance',
    description: 'Greets user with text',
    riskLevel: 'read_only',
    parameters: z.object({
      text: z.string().min(1),
    }),
    responseSchema: z.object({
      result: z.string(),
    }),
    requiresApproval: false,
    handler: async (params) => ({
      result: `Hello, ${params.text}!`,
    }),
  };

  beforeEach(() => {
    registry = new McpRegistry();
    registry.registerTool(echoTool);
  });

  it('responds to JSON-RPC initialize request', async () => {
    const res = await McpGateway.handleRequest(
      { jsonrpc: '2.0', id: 1, method: 'initialize' },
      mockContext,
      registry
    );

    expect(res.id).toBe(1);
    expect(res.error).toBeUndefined();
    expect(res.result).toEqual({
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: { listChanged: false },
      },
      serverInfo: {
        name: 'smartsapp-companybrain-mcp',
        version: '2.0.0',
      },
    });
  });

  it('responds to JSON-RPC ping request', async () => {
    const res = await McpGateway.handleRequest(
      { jsonrpc: '2.0', id: 'ping-1', method: 'ping' },
      mockContext,
      registry
    );

    expect(res.id).toBe('ping-1');
    expect(res.result).toEqual({ status: 'pong' });
  });

  it('lists registered tools via tools/list', async () => {
    const res = await McpGateway.handleRequest(
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      mockContext,
      registry
    );

    expect(res.error).toBeUndefined();
    const tools = (res.result as { tools: Array<{ name: string }> })?.tools;
    expect(tools.length).toBe(1);
    expect(tools[0].name).toBe('test.greet');
  });

  it('executes tools/call successfully for valid parameters', async () => {
    const res = await McpGateway.handleRequest(
      {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'test.greet',
          arguments: { text: 'SmartSapp' },
        },
      },
      mockContext,
      registry
    );

    expect(res.error).toBeUndefined();
    const structured = (res.result as { structured: { result: string } })?.structured;
    expect(structured.result).toBe('Hello, SmartSapp!');
  });

  it('returns INVALID_PARAMS error when arguments fail schema validation', async () => {
    const res = await McpGateway.handleRequest(
      {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'test.greet',
          arguments: { text: '' }, // violates min(1)
        },
      },
      mockContext,
      registry
    );

    expect(res.error).toBeDefined();
    expect(res.error?.code).toBe(MCP_ERROR_CODES.INVALID_PARAMS);
  });

  it('returns METHOD_NOT_FOUND error for non-existent tools', async () => {
    const res = await McpGateway.handleRequest(
      {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'non.existent_tool',
          arguments: {},
        },
      },
      mockContext,
      registry
    );

    expect(res.error?.code).toBe(MCP_ERROR_CODES.METHOD_NOT_FOUND);
  });

  it('rejects calls when call depth exceeds recursion limit', async () => {
    const deepContext: McpExecutionContext = {
      ...mockContext,
      callDepth: 6, // Exceeds limit of 5
    };

    const res = await McpGateway.handleRequest(
      { jsonrpc: '2.0', id: 6, method: 'ping' },
      deepContext,
      registry
    );

    expect(res.error?.code).toBe(MCP_ERROR_CODES.MAX_DEPTH_EXCEEDED);
  });
});
