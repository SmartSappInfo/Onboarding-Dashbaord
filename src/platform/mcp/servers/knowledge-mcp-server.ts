/**
 * @fileOverview Knowledge MCP Domain Server (Spec 2026-07-28 & SDK v2) (Phase 11 M4 · T3)
 *
 * Implements:
 * - Enterprise MCP Spec 2026-07-28 via SDK v2 `@modelcontextprotocol/server`
 * - MCP Resources: `knowledge://{id}` and `memory://{id}` with session auth and per-item ACL (Rule 49)
 * - MCP Prompts: `skill://knowledge-query`, `skill://meeting-preparation`, `skill://meeting-followup`
 * - Tool Fingerprinting & Rug-Pull Defense (Rule 14)
 * - Multi-Tenant Isolation & Least Privilege (Rules 8, 16, 47)
 * - Context Budgeting (Rule 28 & 54)
 *
 * Strict Compliance:
 * - Zero `any` or `any[]` (Rule 4)
 */

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/server';
import type { AgentPrincipal, AnyCapabilityDefinition } from '@/platform/capabilities/contracts/capability-definition';
import { canonicalCapabilityRegistryStore } from '@/platform/capabilities/registry/capability-registry';
import {
  toolNameFor,
  createCapabilityToolHandler,
  type McpToolAuditEntry,
} from '../create-stateless-handler';
import { toMcpToolSchema } from '../to-mcp-tool-schema';
import {
  MAX_TOOL_DESCRIPTION_LENGTH,
} from './domain-server-types';
import {
  getEligibleCapabilitiesForDomain,
  type CreateDomainMcpServerOptions,
} from './domain-mcp-factory';
import {
  globalToolFingerprintService,
  detectToolDrift,
  type TenantContext,
  globalEgressDataPolicyEngine,
  type EgressDestination,
} from '../security';
import {
  KnowledgeAdaptiveRetriever,
  getKnowledgeAdaptiveRetriever,
} from '@/platform/domains/knowledge_memory/services/knowledge-adaptive-retriever';

export interface CreateKnowledgeMcpServerOptions extends CreateDomainMcpServerOptions {
  retriever?: KnowledgeAdaptiveRetriever;
}

export interface McpResourceResult {
  contents: Array<{
    uri: string;
    text: string;
    mimeType?: string;
  }>;
  isError: boolean;
}

export interface McpPromptMessage {
  role: 'user' | 'assistant';
  content: {
    type: 'text';
    text: string;
  };
}

export interface McpPromptResult {
  messages: McpPromptMessage[];
}

/**
 * Resolves an MCP knowledge or memory resource by URI (Rule 49).
 */
export async function getKnowledgeMcpResource(
  uri: string,
  principal: AgentPrincipal,
  retrieverInstance?: KnowledgeAdaptiveRetriever
): Promise<McpResourceResult> {
  const retriever = retrieverInstance ?? getKnowledgeAdaptiveRetriever();

  // 1. Session Authentication & Multi-Tenant IDOR check (Rule 8 & 47)
  if (!principal.organizationId || !principal.workspaceId) {
    return {
      contents: [
        {
          uri,
          text: '[MCP Security] AUTHENTICATION_REQUIRED: Session organization and workspace required to access resources.',
        },
      ],
      isError: true,
    };
  }

  // 2. Extract item ID from URI (knowledge://{id} or memory://{id})
  const match = uri.match(/^(?:knowledge|memory):\/\/([^/?#]+)/);
  if (!match) {
    return {
      contents: [
        {
          uri,
          text: `[MCP Error] INVALID_URI: Unsupported resource URI format: '${uri}'`,
        },
      ],
      isError: true,
    };
  }

  const itemId = match[1];
  const item = retriever.getItem(itemId);

  if (!item) {
    return {
      contents: [
        {
          uri,
          text: `[MCP Error] ITEM_NOT_FOUND: Knowledge resource '${itemId}' does not exist.`,
        },
      ],
      isError: true,
    };
  }

  // 3. Multi-Tenant IDOR Guard (Rules 8 & 47)
  if (
    item.organizationId !== principal.organizationId ||
    item.workspaceId !== principal.workspaceId
  ) {
    return {
      contents: [
        {
          uri,
          text: '[MCP Security] IDOR_VIOLATION: Cross-tenant access denied.',
        },
      ],
      isError: true,
    };
  }

  // 4. Per-Item ACL Evaluation (Rules 8, 16, 49)
  const granted = new Set(principal.grantedScopes ?? []);
  if (item.sensitivity === 'restricted' && !granted.has('knowledge:read_restricted')) {
    return {
      contents: [
        {
          uri,
          text: '[MCP Security] RESTRICTED_ACCESS_DENIED: Non-delegable human authorization required for restricted knowledge items.',
        },
      ],
      isError: true,
    };
  }

  return {
    contents: [
      {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(
          {
            id: item.id,
            title: item.title,
            content: item.content,
            sourceType: item.sourceType,
            sensitivity: item.sensitivity,
            verificationState: item.verificationState,
            createdAt: item.createdAt,
            tags: item.tags,
            subjectRefs: item.subjectRefs,
          },
          null,
          2
        ),
      },
    ],
    isError: false,
  };
}

/**
 * Generates prompt message templates for canonical knowledge skills.
 */
export async function executeKnowledgePrompt(
  promptName: string,
  args: Record<string, string>
): Promise<McpPromptResult> {
  switch (promptName) {
    case 'skill://knowledge-query': {
      const query = args.query ?? '';
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `You are the SmartSapp Knowledge Agent. Answer the following query strictly using verified workspace evidence:
Query: "${query}"

Guidelines (Rule 47 Grounded Answer Contract):
1. Consult 'knowledge.search_hybrid' to gather multi-index evidence.
2. Formulate factual claims where every assertion is supported by a citation span.
3. Drop any claims that cannot be verified against retrieved text.
4. If no evidence matches, state clearly that no evidence was found.`,
            },
          },
        ],
      };
    }

    case 'skill://meeting-preparation': {
      const meetingId = args.meetingId ?? '';
      const attendees = args.attendees ?? '';
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Prepare an executive pre-meeting brief for meeting '${meetingId}' with attendees: [${attendees}].
Compile attendee dossiers, historical decisions, sentiment, open commitments, and tactical discussion points using 'knowledge.search_hybrid' and CRM context.`,
            },
          },
        ],
      };
    }

    case 'skill://meeting-followup': {
      const summary = args.transcriptSummary ?? '';
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Extract action items, decisions, and knowledge candidates from the following meeting summary:
"${summary}"

Propose verified facts into the knowledge review queue via 'knowledge.propose_candidate'.`,
            },
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown prompt: ${promptName}`);
  }
}

/**
 * Creates an enterprise-grade MCP server for the Knowledge domain.
 */
export function createKnowledgeMcpServer(options: CreateKnowledgeMcpServerOptions): McpServer {
  const { principal, capabilities, auditSink } = options;
  const retriever = options.retriever ?? getKnowledgeAdaptiveRetriever();

  // 1. Resolve eligible capabilities for knowledge domain
  const candidatePool = capabilities || canonicalCapabilityRegistryStore.list();
  const eligibleCapabilities = getEligibleCapabilitiesForDomain('knowledge', principal, candidatePool);

  // 2. Instantiate McpServer
  const server = new McpServer({
    name: 'smartsapp-knowledge-mcp',
    version: '2.0.0',
  });

  // 3. Mount Tools with SHA-256 Fingerprinting (Rule 14)
  for (const cap of eligibleCapabilities) {
    const mcpSchema = toMcpToolSchema(cap.inputSchema);
    const truncatedDescription = cap.description.slice(0, MAX_TOOL_DESCRIPTION_LENGTH);

    const handler = createCapabilityToolHandler(cap, {
      getPrincipal: () => principal,
      audit: auditSink,
    });

    server.registerTool(
      toolNameFor(cap.id),
      {
        description: truncatedDescription,
        inputSchema: mcpSchema,
      },
      async (args) => {
        // Tool Fingerprint Integrity & Rug-Pull Verification (Rule 14)
        if (principal.organizationId && principal.workspaceId) {
          const tenant: TenantContext = {
            organizationId: principal.organizationId,
            workspaceId: principal.workspaceId,
          };
          const fpService = options.fingerprintService ?? globalToolFingerprintService;

          if (options.enforceFingerprints) {
            try {
              const check = await fpService.verifyCapabilityFingerprint(cap, tenant);
              if (!check.isValid) {
                return {
                  content: [
                    {
                      type: 'text',
                      text: `[MCP Security] TOOL_FINGERPRINT_DRIFT: Tool '${cap.id}' failed integrity check. ${check.driftReport.reason}`,
                    },
                  ],
                  isError: true,
                };
              }
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              return {
                content: [{ type: 'text', text: `[MCP Security] ${msg}` }],
                isError: true,
              };
            }
          } else {
            const approved = await fpService.getApprovedFingerprint(cap.id, cap.version, tenant);
            if (approved) {
              const drift = detectToolDrift(cap, approved);
              if (drift.hasDrift) {
                return {
                  content: [
                    {
                      type: 'text',
                      text: `[MCP Security] TOOL_FINGERPRINT_DRIFT: Tool '${cap.id}' failed integrity check. ${drift.reason}`,
                    },
                  ],
                  isError: true,
                };
              }
            }
          }
        }

        // Execute capability handler
        const result = await handler(args);

        // Data Egress Policy Evaluation (Rule 32 & 33)
        if (options.enforceEgressPolicy || options.egressPolicyEngine) {
          const egressEngine = options.egressPolicyEngine ?? globalEgressDataPolicyEngine;
          const tenant: TenantContext | undefined =
            principal.organizationId && principal.workspaceId
              ? {
                  organizationId: principal.organizationId,
                  workspaceId: principal.workspaceId,
                }
              : undefined;
          const destination: EgressDestination = options.egressDestination ?? 'external_mcp_tool';

          const egressResult = await egressEngine.evaluateEgress(
            result,
            destination,
            tenant,
            {
              redactionMode: options.redactEgressSensitiveData,
            }
          );

          if (options.redactEgressSensitiveData && egressResult.sanitizedPayload) {
            return egressResult.sanitizedPayload as typeof result;
          }

          if (!egressResult.allowed) {
            return {
              content: [
                {
                  type: 'text',
                  text: `[MCP Security] DATA_EXFILTRATION_DETECTED: Egress blocked by policy. ${egressResult.reason}`,
                },
              ],
              isError: true,
            };
          }
        }

        return result;
      }
    );
  }

  // 4. Mount MCP Resources (Rule 49)
  server.registerResource(
    'knowledge-resource',
    new ResourceTemplate('knowledge://{id}', { list: undefined }),
    { mimeType: 'application/json' },
    async (uri) => {
      const res = await getKnowledgeMcpResource(uri.href, principal, retriever);
      return {
        contents: res.contents.map((c) => ({
          uri: c.uri,
          mimeType: c.mimeType ?? 'application/json',
          text: c.text,
        })),
      };
    }
  );

  server.registerResource(
    'memory-resource',
    new ResourceTemplate('memory://{id}', { list: undefined }),
    { mimeType: 'application/json' },
    async (uri) => {
      const res = await getKnowledgeMcpResource(uri.href, principal, retriever);
      return {
        contents: res.contents.map((c) => ({
          uri: c.uri,
          mimeType: c.mimeType ?? 'application/json',
          text: c.text,
        })),
      };
    }
  );

  // 5. Mount MCP Prompts (Spec 2026-07-28)
  server.registerPrompt(
    'skill://knowledge-query',
    {
      description: 'Execute grounded knowledge query with citation constraints',
    },
    async (args) => {
      const stringArgs: Record<string, string> = {};
      if (args) {
        for (const [k, v] of Object.entries(args)) {
          stringArgs[k] = String(v);
        }
      }
      return executeKnowledgePrompt('skill://knowledge-query', stringArgs);
    }
  );

  server.registerPrompt(
    'skill://meeting-preparation',
    {
      description: 'Prepare pre-meeting brief, attendee dossiers, and open commitments',
    },
    async (args) => {
      const stringArgs: Record<string, string> = {};
      if (args) {
        for (const [k, v] of Object.entries(args)) {
          stringArgs[k] = String(v);
        }
      }
      return executeKnowledgePrompt('skill://meeting-preparation', stringArgs);
    }
  );

  server.registerPrompt(
    'skill://meeting-followup',
    {
      description: 'Extract action items, decisions, and knowledge candidates from meeting transcript',
    },
    async (args) => {
      const stringArgs: Record<string, string> = {};
      if (args) {
        for (const [k, v] of Object.entries(args)) {
          stringArgs[k] = String(v);
        }
      }
      return executeKnowledgePrompt('skill://meeting-followup', stringArgs);
    }
  );

  return server;
}
