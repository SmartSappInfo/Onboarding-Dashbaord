/**
 * @fileOverview CompanyBrain 2.0 Phase 6 / Phase 1: Governed CRM Entity MCP Tools
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10 & Rule 69):
 * 1. Single Source of Truth for CRM Data:
 *    - Delegates directly to canonical capabilities `entityGetCapability` and `entitySearchCapability`.
 * 2. Risk Tier:
 *    - `crm.get_entity`: read_only (L0_READ, scoped by workspaceId).
 *    - `crm.search_entities`: read_only (L0_READ, bounded search <= 100).
 * 3. Strict Zero-`any` & Zero-`unknown` Invariant:
 *    - Uses Zod schemas and recursive `McpPayloadValue`.
 * 4. In-Place Upgrades:
 *    - Registers canonical definitions with `{ allowOverride: true }`.
 *
 * @testability Covered in `src/lib/mcp/__tests__/mcp-gateway.test.ts` and `src/platform/__tests__/domains/crm-entities.test.ts`.
 */

import { z } from 'zod';
import { McpToolDefinition } from '../types';
import { registerCapability } from '@/platform/capabilities/registry/capability-registry';
import {
  entityGetCapability,
  entitySearchCapability,
} from '@/platform/domains/crm_contacts/contracts/entity-capabilities.contract';

// ==========================================
// 1. crm.get_entity (Read-Only)
// ==========================================

const getEntityInputSchema = z.object({
  entityId: z.string().min(1).describe('The unique ID of the CRM entity (account/organization).'),
});

const getEntityOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  status: z.string(),
  industry: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  city: z.string().nullable(),
  address: z.string().nullable(),
  createdAt: z.string(),
});

export const crmGetEntityTool: McpToolDefinition<
  z.infer<typeof getEntityInputSchema>,
  z.infer<typeof getEntityOutputSchema>
> = {
  name: 'crm.get_entity',
  version: '1.0.0',
  category: 'crm',
  description: 'Retrieves comprehensive profile and contact details for a specific CRM entity/account.',
  riskLevel: 'read_only',
  requiresApproval: false,
  parameters: getEntityInputSchema,
  responseSchema: getEntityOutputSchema,
  handler: async (params, context) => {
    const callerUserId = context.callerType === 'agent' ? `system-${context.callerId}` : context.callerId;
    const result = await entityGetCapability.handler(
      {
        workspaceId: context.workspaceId,
        entityId: params.entityId,
      },
      {
        principal: {
          actorType: context.callerType === 'agent' ? 'agent' : 'user',
          userId: callerUserId,
          agentId: context.callerType === 'agent' ? context.callerId : undefined,
          workspaceId: context.workspaceId,
          organizationId: context.organizationId,
          grantedScopes: ['operations:campuses:view', 'app:contacts_view', 'crm:entities:read'],
          effectiveRole: 'mcp_caller',
        },
        correlationId: context.requestId,
        timestamp: context.timestamp,
      }
    );

    if (!result.success) {
      throw new Error(`[crm.get_entity] ${result.error.message}`);
    }

    return result.data;
  },
};

// ==========================================
// 2. crm.search_entities (Read-Only)
// ==========================================

const searchEntitiesInputSchema = z.object({
  query: z.string().min(1).describe('Text query to search entity names, industries, or emails.'),
  limit: z.number().int().min(1).max(50).optional().describe('Maximum number of results to return (default 10).'),
});

const searchEntitiesOutputSchema = z.object({
  totalFound: z.number(),
  entities: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      type: z.string(),
      status: z.string(),
      industry: z.string(),
      email: z.string().nullable(),
      phone: z.string().nullable(),
    })
  ),
});

export const crmSearchEntitiesTool: McpToolDefinition<
  z.infer<typeof searchEntitiesInputSchema>,
  z.infer<typeof searchEntitiesOutputSchema>
> = {
  name: 'crm.search_entities',
  version: '1.0.0',
  category: 'crm',
  description: 'Searches CRM entities within the current workspace matching a text query.',
  riskLevel: 'read_only',
  requiresApproval: false,
  parameters: searchEntitiesInputSchema,
  responseSchema: searchEntitiesOutputSchema,
  handler: async (params, context) => {
    const callerUserId = context.callerType === 'agent' ? `system-${context.callerId}` : context.callerId;
    const result = await entitySearchCapability.handler(
      {
        workspaceId: context.workspaceId,
        query: params.query,
        limit: params.limit,
      },
      {
        principal: {
          actorType: context.callerType === 'agent' ? 'agent' : 'user',
          userId: callerUserId,
          agentId: context.callerType === 'agent' ? context.callerId : undefined,
          workspaceId: context.workspaceId,
          organizationId: context.organizationId,
          grantedScopes: ['operations:campuses:view', 'app:contacts_view', 'crm:entities:read'],
          effectiveRole: 'mcp_caller',
        },
        correlationId: context.requestId,
        timestamp: context.timestamp,
      }
    );

    if (!result.success) {
      throw new Error(`[crm.search_entities] ${result.error.message}`);
    }

    return {
      totalFound: result.data.totalFound,
      entities: result.data.entities.map((e) => ({
        id: e.id,
        name: e.name,
        type: e.type,
        status: e.status,
        industry: e.industry,
        email: e.email,
        phone: e.phone,
      })),
    };
  },
};

// In-place upgrade of canonical capability definitions into unified registry (Decision D1 / Rule 69)
registerCapability(entityGetCapability, { allowOverride: true });
registerCapability(entitySearchCapability, { allowOverride: true });
