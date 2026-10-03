/**
 * @fileOverview Multi-Tenant MCP Ingress Authentication Gateway & Anti-IDOR Engine (Phase 5 Milestone 1)
 *
 * Implements Rule 8 (Multi-Tenancy), Rule 16 (Agent Identity as Principal),
 * Rule 47 (Anti-IDOR Tenant Lock / Finding N4), and Rule 60 (Emergency Dead-Man Switch).
 *
 * Resolves inbound HTTP requests into canonical, strictly scoped `AgentPrincipal` records.
 *
 * SECURITY INVARIANTS:
 * 1. Finding N4 Anti-Spoofing: The tenant context (`organizationId`, `workspaceId`) is bound
 *    strictly to the verified database record (`mcp_keys` or Clerk session). External caller-supplied
 *    headers (`x-organization-id`, `x-workspace-id`) that conflict with the verified tenant are
 *    rejected immediately with `TENANT_SCOPE_VIOLATION`.
 * 2. Rule 60 Dead-Man Switch: If autonomous or MCP execution is paused workspace-wide or platform-wide,
 *    requests fail closed immediately with `MCP_EXECUTION_PAUSED` (HTTP 503).
 * 3. Rule 16 & 17: Caller identity is normalized to `actorType: 'agent'`. Wildcard (`*`) scopes and
 *    non-delegable administrative actions are stripped unconditionally.
 *
 * Strict Typing Policy: Zero `any` or `any[]` (Rule 4).
 */

import type { McpApiKey } from '@/lib/mcp/types';
import { McpApiKeyService } from '@/lib/mcp/api-key-service';
import type { AgentPrincipal } from '../../capabilities/contracts/capability-definition';
import { resolvePrincipalFromMcpKey } from '../../capabilities/policy/mcp-principal-resolver';
import { isNonDelegableAction } from '../../capabilities/contracts/risk-levels';
import { checkGovernanceDeadManSwitch } from '../../policy/governance-dead-man';
import {
  MCP_TRANSPORT_ERROR_CODES,
  type McpTransportErrorCode,
  mapMcpErrorToHttpStatus,
} from '../transport/transport-types';

export type McpAuthResult =
  | {
      success: true;
      principal: AgentPrincipal;
    }
  | {
      success: false;
      errorCode: McpTransportErrorCode;
      errorMessage: string;
      status: number;
    };

export interface ClerkSessionDetails {
  userId: string;
  organizationId: string;
  workspaceId: string;
  role?: string;
}

export interface McpAuthGatewayOptions {
  /** Optional mockable API key lookup function for tests. */
  lookupApiKey?: (rawKey: string) => Promise<McpApiKey | null>;
  /** Optional mockable dead-man switch evaluator for tests. Returns true if paused. */
  checkDeadManSwitch?: (tenant: { organizationId: string; workspaceId: string }) => Promise<boolean>;
  /** Optional mockable Clerk session resolver for tests. */
  resolveClerkSession?: (req: Request) => Promise<ClerkSessionDetails | null>;
}

export interface McpAuthGateway {
  authenticate(req: Request): Promise<McpAuthResult>;
}

/**
 * Creates an instance of the Multi-Tenant Ingress Authentication Gateway.
 */
export function createMcpAuthGateway(options: McpAuthGatewayOptions = {}): McpAuthGateway {
  const lookupKey =
    options.lookupApiKey ??
    (async (token: string): Promise<McpApiKey | null> => {
      const result = await McpApiKeyService.validateApiKey(token);
      return result.valid && result.key ? result.key : null;
    });

  const evaluateDeadMan =
    options.checkDeadManSwitch ??
    (async (tenant: { organizationId: string; workspaceId: string }): Promise<boolean> => {
      try {
        await checkGovernanceDeadManSwitch(tenant.organizationId);
        return false;
      } catch {
        return true;
      }
    });

  return {
    async authenticate(req: Request): Promise<McpAuthResult> {
      let candidatePrincipal: AgentPrincipal | null = null;
      let authFailureMessage: string | null = null;

      // 1. Extract Bearer token from Authorization header
      const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
      let rawBearerToken: string | null = null;

      if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
        rawBearerToken = authHeader.slice(7).trim();
      }

      // 2. Validate Bearer API Key if present
      if (rawBearerToken) {
        try {
          const apiKey = await lookupKey(rawBearerToken);
          if (apiKey) {
            // Verify revocation (Rule 8)
            if (apiKey.revoked) {
              return {
                success: false,
                errorCode: MCP_TRANSPORT_ERROR_CODES.UNAUTHENTICATED,
                errorMessage: `Authentication failed: API Key '${apiKey.id}' has been revoked.`,
                status: mapMcpErrorToHttpStatus(MCP_TRANSPORT_ERROR_CODES.UNAUTHENTICATED),
              };
            }

            // Verify expiration
            if (apiKey.expiresAt) {
              const expiresMs = Date.parse(apiKey.expiresAt);
              if (!Number.isNaN(expiresMs) && expiresMs <= Date.now()) {
                return {
                  success: false,
                  errorCode: MCP_TRANSPORT_ERROR_CODES.UNAUTHENTICATED,
                  errorMessage: `Authentication failed: API Key '${apiKey.id}' expired at ${apiKey.expiresAt}.`,
                  status: mapMcpErrorToHttpStatus(MCP_TRANSPORT_ERROR_CODES.UNAUTHENTICATED),
                };
              }
            }

            candidatePrincipal = resolvePrincipalFromMcpKey(apiKey);
          } else {
            authFailureMessage = 'Invalid Bearer API token.';
          }
        } catch (err) {
          authFailureMessage = err instanceof Error ? err.message : 'API key verification error.';
        }
      }

      // 3. Fallback: Clerk session resolution if no Bearer key succeeded
      if (!candidatePrincipal && options.resolveClerkSession) {
        try {
          const session = await options.resolveClerkSession(req);
          if (session && session.organizationId && session.workspaceId) {
            candidatePrincipal = {
              actorType: 'agent', // MCP callers are always treated as automated agents (Rule 16)
              userId: session.userId,
              organizationId: session.organizationId,
              workspaceId: session.workspaceId,
              agentId: `clerk_session:${session.userId}`,
              agentVersion: '2.0.0',
              grantedScopes: ['app:crm_view', 'app:knowledge_view'],
              effectiveRole: session.role || 'user',
            };
          }
        } catch {
          // Ignore and fall through to unauthenticated
        }
      }

      // 4. Fail closed if neither Bearer key nor session was resolved
      if (!candidatePrincipal) {
        return {
          success: false,
          errorCode: MCP_TRANSPORT_ERROR_CODES.UNAUTHENTICATED,
          errorMessage:
            authFailureMessage ||
            'Authentication required: please supply a valid Bearer token or authenticated session.',
          status: mapMcpErrorToHttpStatus(MCP_TRANSPORT_ERROR_CODES.UNAUTHENTICATED),
        };
      }

      // 5. Anti-IDOR Tenant Lock (Finding N4 & Rule 47)
      // Callers cannot supply external headers that contradict the verified database credential
      const headerOrgId = req.headers.get('x-organization-id') || req.headers.get('X-Organization-Id');
      if (headerOrgId && candidatePrincipal.organizationId && headerOrgId !== candidatePrincipal.organizationId) {
        return {
          success: false,
          errorCode: MCP_TRANSPORT_ERROR_CODES.TENANT_SCOPE_VIOLATION,
          errorMessage: `Access denied: request header x-organization-id '${headerOrgId}' does not match authenticated organization.`,
          status: mapMcpErrorToHttpStatus(MCP_TRANSPORT_ERROR_CODES.TENANT_SCOPE_VIOLATION),
        };
      }

      const headerWsId = req.headers.get('x-workspace-id') || req.headers.get('X-Workspace-Id');
      if (headerWsId && candidatePrincipal.workspaceId && headerWsId !== candidatePrincipal.workspaceId) {
        return {
          success: false,
          errorCode: MCP_TRANSPORT_ERROR_CODES.TENANT_SCOPE_VIOLATION,
          errorMessage: `Access denied: request header x-workspace-id '${headerWsId}' does not match authenticated workspace.`,
          status: mapMcpErrorToHttpStatus(MCP_TRANSPORT_ERROR_CODES.TENANT_SCOPE_VIOLATION),
        };
      }

      // 6. Rule 60 Emergency Dead-Man Switch Evaluation
      if (candidatePrincipal.organizationId && candidatePrincipal.workspaceId) {
        const isPaused = await evaluateDeadMan({
          organizationId: candidatePrincipal.organizationId,
          workspaceId: candidatePrincipal.workspaceId,
        });

        if (isPaused) {
          return {
            success: false,
            errorCode: MCP_TRANSPORT_ERROR_CODES.MCP_EXECUTION_PAUSED,
            errorMessage:
              'Autonomous and MCP capability execution is temporarily paused for this workspace under Rule 60 emergency governance.',
            status: mapMcpErrorToHttpStatus(MCP_TRANSPORT_ERROR_CODES.MCP_EXECUTION_PAUSED),
          };
        }
      }

      // 7. Strip wildcard scopes and non-delegable actions (Rule 16 & 17)
      const sanitizedScopes = (candidatePrincipal.grantedScopes || []).filter(
        (scope) => scope !== '*' && !isNonDelegableAction(scope)
      );

      const finalPrincipal: AgentPrincipal = {
        ...candidatePrincipal,
        actorType: 'agent',
        grantedScopes: sanitizedScopes,
      };

      return {
        success: true,
        principal: finalPrincipal,
      };
    },
  };
}

/** Global default gateway instance. */
export const defaultMcpAuthGateway = createMcpAuthGateway();

/**
 * Top-level convenience authentication function.
 */
export async function authenticateMcpRequest(
  req: Request,
  options?: McpAuthGatewayOptions
): Promise<McpAuthResult> {
  const gateway = options ? createMcpAuthGateway(options) : defaultMcpAuthGateway;
  return gateway.authenticate(req);
}
