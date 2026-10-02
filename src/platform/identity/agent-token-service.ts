/**
 * @fileOverview Ephemeral Agent Session Token Service (Phase 3 Milestone 1)
 *
 * Implements Rules 4, 8, 10, 13, 16, 22, 47, 60, and Master Roadmap Section 4 / Document 05.
 * Mints and verifies tamper-proof, cryptographically signed (HMAC-SHA256) ephemeral
 * `AgentPrincipal` sessions.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Automated agents NEVER receive wildcard (`*`) scopes (Rule 16).
 * - Multi-tenant boundaries (`organizationId`, `workspaceId`) are strictly validated at mint
 *   and verified at the execution boundary.
 * - Signature comparison MUST use `crypto.timingSafeEqual` to prevent timing side-channel attacks.
 * - In production, `AGENT_TOKEN_SECRET` must be set via environment secrets; fails closed if unset.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import crypto from 'node:crypto';
import { z } from 'zod/v4';
import type { AgentPrincipal } from '../capabilities/contracts/capability-definition';
import {
  AGENT_PERSONA_IDS,
} from './agent-persona-types';
import { globalAgentPersonaRegistry } from './agent-registry';

/**
 * Claims encoded in the signed agent session token.
 */
export const AgentSessionClaimsSchema = z.object({
  principalId: z.string().min(1),
  agentSessionId: z.string().min(1),
  personaId: z.enum(AGENT_PERSONA_IDS),
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  userId: z.string().min(1),
  delegatedBy: z.string().optional(),
  toolInvocationId: z.string().optional(),
  grantedScopes: z.array(z.string()),
  effectiveRole: z.string().default('agent'),
  issuedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});

export type AgentSessionClaims = z.infer<typeof AgentSessionClaimsSchema>;

export interface IssueAgentSessionOptions {
  personaId: string; // Accepts canonical ID or legacy alias
  organizationId: string;
  workspaceId: string;
  userId: string;
  delegatedBy?: string;
  toolInvocationId?: string;
  requestedScopes?: readonly string[];
  ttlSeconds?: number;
}

export interface IssuedAgentSession {
  token: string;
  principal: AgentPrincipal;
  claims: AgentSessionClaims;
}

export type AgentSessionErrorCode =
  | 'INVALID_PERSONA'
  | 'TENANT_SCOPE_MISSING'
  | 'WILDCARD_SCOPE_FORBIDDEN'
  | 'INVALID_SIGNATURE'
  | 'EXPIRED_SESSION'
  | 'CORRUPT_TOKEN'
  | 'EMERGENCY_PAUSED';

export class InvalidAgentSessionError extends Error {
  public readonly code: AgentSessionErrorCode;

  constructor(code: AgentSessionErrorCode, message: string) {
    super(message);
    this.name = 'InvalidAgentSessionError';
    this.code = code;
  }
}

/**
 * Resolves the signing secret for agent session tokens.
 * Fails closed in production if `AGENT_TOKEN_SECRET` is unset.
 */
export function getAgentTokenSecret(): string {
  const secret = process.env.AGENT_TOKEN_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: AGENT_TOKEN_SECRET environment variable is missing in production.');
    }
    return 'local-development-agent-session-secret-key-32chars';
  }
  return secret;
}

/**
 * Encodes a JSON object to URL-safe base64 string.
 */
function base64UrlEncode(str: string): string {
  return Buffer.from(str, 'utf8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Decodes a URL-safe base64 string to utf8 string.
 */
function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Mints an ephemeral, cryptographically signed AgentPrincipal session token.
 */
export function issueAgentSession(options: IssueAgentSessionOptions): IssuedAgentSession {
  // 1. Resolve Persona
  const persona = globalAgentPersonaRegistry.getPersona(options.personaId);
  if (!persona) {
    throw new InvalidAgentSessionError(
      'INVALID_PERSONA',
      `Cannot issue session for unknown agent persona '${options.personaId}'`
    );
  }

  // 2. Validate Tenant Boundaries (Rule 4 Anti-IDOR)
  const orgId = options.organizationId?.trim();
  const wsId = options.workspaceId?.trim();
  const userId = options.userId?.trim();

  if (!orgId || !wsId || !userId) {
    throw new InvalidAgentSessionError(
      'TENANT_SCOPE_MISSING',
      'Agent session requires non-empty organizationId, workspaceId, and userId.'
    );
  }

  // 3. Resolve Granted Scopes (Rule 16: Effective Authority)
  let scopes: string[];
  if (options.requestedScopes && options.requestedScopes.length > 0) {
    // Intersect requested scopes with persona's allowed permissions
    const personaAllowed = new Set(persona.allowedPermissions);
    scopes = options.requestedScopes.filter((scope) => {
      if (scope === '*') {
        throw new InvalidAgentSessionError(
          'WILDCARD_SCOPE_FORBIDDEN',
          `Wildcard permission '*' is strictly forbidden for automated agents (Rule 16).`
        );
      }
      return personaAllowed.has(scope);
    });
  } else {
    scopes = [...persona.allowedPermissions];
  }

  // Double-check no wildcard crept in
  if (scopes.includes('*')) {
    throw new InvalidAgentSessionError(
      'WILDCARD_SCOPE_FORBIDDEN',
      `Wildcard permission '*' is strictly forbidden for automated agents (Rule 16).`
    );
  }

  // 4. Time bounds
  const nowMs = Date.now();
  const MAX_AGENT_TOKEN_TTL_SECONDS = 3600; // 1 hour hard ceiling (Rule 23)
  const MIN_AGENT_TOKEN_TTL_SECONDS = 10;   // 10 seconds floor
  const requestedTtl = options.ttlSeconds ?? MAX_AGENT_TOKEN_TTL_SECONDS;
  const ttlSeconds = Math.min(Math.max(MIN_AGENT_TOKEN_TTL_SECONDS, requestedTtl), MAX_AGENT_TOKEN_TTL_SECONDS);
  const issuedAt = new Date(nowMs).toISOString();
  const expiresAt = new Date(nowMs + ttlSeconds * 1000).toISOString();

  // 5. Unique Session & Principal Identifiers
  const agentSessionId = crypto.randomUUID();
  const randomSuffix = crypto.randomBytes(6).toString('hex');
  const principalId = `agent_${persona.id}_${randomSuffix}`;

  const claims: AgentSessionClaims = {
    principalId,
    agentSessionId,
    personaId: persona.id,
    organizationId: orgId,
    workspaceId: wsId,
    userId,
    delegatedBy: options.delegatedBy,
    toolInvocationId: options.toolInvocationId,
    grantedScopes: scopes,
    effectiveRole: 'agent',
    issuedAt,
    expiresAt,
  };

  // 6. Sign Claims with HMAC-SHA256
  const encodedClaims = base64UrlEncode(JSON.stringify(claims));
  const secret = getAgentTokenSecret();
  const signature = crypto
    .createHmac('sha256', secret)
    .update(encodedClaims)
    .digest('base64url');

  const token = `${encodedClaims}.${signature}`;

  // 7. Canonical AgentPrincipal Output
  const principal: AgentPrincipal = {
    actorType: 'agent',
    userId,
    organizationId: orgId,
    workspaceId: wsId,
    agentId: persona.id,
    agentVersion: persona.version,
    delegationId: options.delegatedBy,
    runId: agentSessionId,
    toolInvocationId: options.toolInvocationId,
    grantedScopes: scopes,
    effectiveRole: 'agent',
  };

  return { token, principal, claims };
}

/**
 * Verifies an ephemeral agent session token in constant time.
 * Returns the authenticated `AgentPrincipal` or throws `InvalidAgentSessionError`.
 */
export function verifyAgentSessionToken(token: string, options?: { nowMs?: number }): AgentPrincipal {
  if (!token || typeof token !== 'string') {
    throw new InvalidAgentSessionError('CORRUPT_TOKEN', 'Agent session token is missing or malformed.');
  }

  const parts = token.trim().split('.');
  if (parts.length !== 2) {
    throw new InvalidAgentSessionError('CORRUPT_TOKEN', 'Agent session token format invalid. Expected 2 segments.');
  }

  const [encodedClaims, signature] = parts;

  // 1. Verify Signature in Constant Time (Rule 8)
  const secret = getAgentTokenSecret();
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(encodedClaims)
    .digest('base64url');

  const sigBuffer = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

  if (
    sigBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
  ) {
    throw new InvalidAgentSessionError(
      'INVALID_SIGNATURE',
      'Agent session token signature verification failed.'
    );
  }

  // 2. Decode and Validate Claims Schema
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(base64UrlDecode(encodedClaims));
  } catch {
    throw new InvalidAgentSessionError('CORRUPT_TOKEN', 'Agent session token payload is not valid JSON.');
  }

  const parseResult = AgentSessionClaimsSchema.safeParse(parsedJson);
  if (!parseResult.success) {
    throw new InvalidAgentSessionError(
      'CORRUPT_TOKEN',
      `Agent session token claims failed schema validation: ${parseResult.error.message}`
    );
  }

  const claims = parseResult.data;

  // 3. Verify Expiration
  const nowMs = options?.nowMs ?? Date.now();
  const expiresMs = Date.parse(claims.expiresAt);
  if (Number.isNaN(expiresMs) || expiresMs <= nowMs) {
    throw new InvalidAgentSessionError(
      'EXPIRED_SESSION',
      `Agent session token expired at ${claims.expiresAt}`
    );
  }

  // 4. Return Canonical AgentPrincipal
  const persona = globalAgentPersonaRegistry.getPersona(claims.personaId);

  return {
    actorType: 'agent',
    userId: claims.userId,
    organizationId: claims.organizationId,
    workspaceId: claims.workspaceId,
    agentId: claims.personaId,
    agentVersion: persona?.version ?? '1.0.0',
    delegationId: claims.delegatedBy,
    runId: claims.agentSessionId,
    toolInvocationId: claims.toolInvocationId,
    grantedScopes: [...claims.grantedScopes],
    effectiveRole: claims.effectiveRole,
  };
}
