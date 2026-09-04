/**
 * @fileOverview CompanyBrain 2.0 Phase 6: Governed CRM Entity MCP Tools
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Single Source of Truth for CRM Data:
 *    - Reads directly from Firestore `/entities` with tenant scoping.
 * 2. Risk Tier:
 *    - `crm.get_entity`: read_only (Zero mutation, scoped by workspaceId).
 *    - `crm.search_entities`: read_only (Tenant-safe search).
 * 3. Strict Zero-`any` & Zero-`unknown` Invariant:
 *    - Uses Zod schemas and recursive `McpPayloadValue`.
 *
 * @testability Covered in `src/lib/mcp/__tests__/mcp-gateway.test.ts`.
 */

import { z } from 'zod';
import { McpToolDefinition } from '../types';
import { adminDb } from '@/lib/firebase-admin';

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
    const docSnap = await adminDb.collection('entities').doc(params.entityId).get();
    if (!docSnap.exists) {
      throw new Error(`[crm.get_entity] Entity "${params.entityId}" not found.`);
    }

    const data = docSnap.data();
    if (data?.workspaceId && data.workspaceId !== context.workspaceId) {
      throw new Error(`[crm.get_entity] Access denied: entity belongs to another workspace.`);
    }

    const name = data?.name || data?.displayName || 'Unknown Entity';
    const type = data?.type || 'company';
    const status = data?.status || 'active';
    const industry = data?.industry || 'general';
    const email = data?.email || data?.primaryContact?.email || null;
    const phone = data?.phone || data?.primaryContact?.phone || null;
    const city = data?.city || null;
    const address = data?.address || null;
    const createdAt = data?.createdAt || new Date().toISOString();

    return {
      id: docSnap.id,
      name,
      type,
      status,
      industry,
      email,
      phone,
      city,
      address,
      createdAt,
    };
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
    const limitCount = params.limit ?? 10;
    const normalizedQuery = params.query.toLowerCase().trim();

    // Query workspace entities (up to 100 recent)
    const snapshot = await adminDb
      .collection('entities')
      .where('workspaceId', '==', context.workspaceId)
      .limit(100)
      .get();

    const matches: Array<{
      id: string;
      name: string;
      type: string;
      status: string;
      industry: string;
      email: string | null;
      phone: string | null;
    }> = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const name = (data?.name || data?.displayName || '').toLowerCase();
      const email = (data?.email || data?.primaryContact?.email || '').toLowerCase();
      const industry = (data?.industry || '').toLowerCase();

      if (
        name.includes(normalizedQuery) ||
        email.includes(normalizedQuery) ||
        industry.includes(normalizedQuery)
      ) {
        matches.push({
          id: doc.id,
          name: data?.name || data?.displayName || 'Unknown Entity',
          type: data?.type || 'company',
          status: data?.status || 'active',
          industry: data?.industry || 'general',
          email: data?.email || data?.primaryContact?.email || null,
          phone: data?.phone || data?.primaryContact?.phone || null,
        });

        if (matches.length >= limitCount) {
          break;
        }
      }
    }

    return {
      totalFound: matches.length,
      entities: matches,
    };
  },
};
