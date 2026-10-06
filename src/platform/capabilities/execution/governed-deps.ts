/**
 * @fileOverview Production defaults for the execution gateway (Phase 11 M0 · T1, finding F2).
 *
 * WHY
 * `executeCapability` only enforced idempotency, approval verification and the live standing
 * check when a caller injected the matching dependency. The MCP handler injected none, and the
 * agent-step route had no idempotency store, so those protections silently did not run.
 * `resolveGatewayDeps` now fills every governed dependency the caller did not provide.
 *
 * RULES OF RESOLUTION
 * - A value the caller provides wins. A missing OR `undefined` value gets the production default
 *   (M0 review R2): callers that forward optional deps (`approvals: deps.approvals`) must never
 *   switch governance off by accident. Hermetic tests isolate via `setGovernedGatewayDepsForTests`.
 * - Defaults are built once per process. Principals are never cached across requests (Rule 50).
 *
 * STANDING (who is re-checked live, Rule 16)
 * - Interactive users: resolved from the session for this very request, so no second lookup.
 * - `service:*` principals: pinned service allowlists (service-principals.ts); no user exists.
 * - `api_key:*` principals: the MCP key must still exist, not be revoked and not be expired.
 * - Anyone else (agents acting for a user, delegations): the user behind them is re-checked live
 *   (exists, approved, same organization, workspace access, delegation still valid).
 *
 * CAUTION: do not make the standing check "fail open" on lookup errors. A thrown error is mapped
 * by the gateway to a refusal with `stateChanged: 'no'`, which is the safe outcome.
 *
 * Tests: src/platform/__tests__/gateway/governed-defaults.test.ts
 */
import type { AgentPrincipal } from '../contracts/capability-definition';
import { isAutomatedPrincipal } from '../contracts/capability-definition';
import { defaultIdempotencyStore } from '../storage/execution-store';
import { defaultApprovalStore } from '../storage/approval-store';
import type { ApprovalVerifier } from '../policy/approval-verifier';
import { selectPlatformStore } from '@/platform/storage/storage-mode';
import type { LivePrincipalCheck } from '@/platform/tasks/live-principal-check';
import type { ExecuteCapabilityDeps } from './execute-capability';

export type ActorStanding = { active: true } | { active: false; reason: string };

export interface ApiKeyStanding {
  revoked: boolean;
  expiresAt?: string | null;
}

export interface ActorStandingCheckOptions {
  /** Live user re-check (lazy so tests and edge bundles never load Firestore). */
  livePrincipals: () => LivePrincipalCheck | Promise<LivePrincipalCheck>;
  /** Looks up an MCP API key by id; `null` when it no longer exists. */
  lookupApiKey: (keyId: string) => Promise<ApiKeyStanding | null>;
  nowMs?: () => number;
}

const SERVICE_PREFIX = 'service:';
const API_KEY_PREFIX = 'api_key:';

/**
 * Builds the `verifyActorStanding` dependency used by gateway step 08.
 */
export function createActorStandingCheck(
  options: ActorStandingCheckOptions
): (principal: AgentPrincipal) => Promise<ActorStanding> {
  const nowMs = options.nowMs ?? (() => Date.now());

  return async (principal) => {
    if (!isAutomatedPrincipal(principal)) {
      return { active: true };
    }

    if (principal.userId.startsWith(SERVICE_PREFIX)) {
      return { active: true };
    }

    if (principal.userId.startsWith(API_KEY_PREFIX)) {
      const keyId = principal.userId.slice(API_KEY_PREFIX.length);
      const key = await options.lookupApiKey(keyId);
      if (!key) return { active: false, reason: 'The API key no longer exists.' };
      if (key.revoked) return { active: false, reason: 'The API key has been revoked.' };
      if (key.expiresAt) {
        const expires = Date.parse(key.expiresAt);
        if (Number.isNaN(expires) || expires <= nowMs()) {
          return { active: false, reason: 'The API key has expired.' };
        }
      }
      return { active: true };
    }

    const live = await options.livePrincipals();
    const result = await live.check(principal, {
      organizationId: principal.organizationId,
      workspaceId: principal.workspaceId,
    });
    return result.ok ? { active: true } : { active: false, reason: result.reason };
  };
}

let productionDefaults: ExecuteCapabilityDeps | undefined;
let testOverride: ExecuteCapabilityDeps | undefined;

/**
 * Test-only: replaces the defaults (the Vitest setup installs `{}` so pre-existing suites keep
 * their exact behaviour; tests that exercise governance inject what they need).
 * CAUTION: refuses to run in production.
 */
export function setGovernedGatewayDepsForTests(deps: ExecuteCapabilityDeps | undefined): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('setGovernedGatewayDepsForTests cannot be used in production.');
  }
  testOverride = deps;
}

/** Defaults in effect: the test override when installed, otherwise production. */
export function getGovernedGatewayDeps(): ExecuteCapabilityDeps {
  return testOverride ?? buildProductionGatewayDeps();
}

/**
 * Process-wide production dependencies (built once). Stores come from the platform storage switch,
 * and Firestore-touching lookups load lazily.
 */
/**
 * The gateway's approval verifier: the UNIFIED store in Firestore mode (Phase 11 M0 · T2, F4), so an
 * approval decided in the inbox is exactly what step 09 verifies and binds. Memory mode (tests, local)
 * keeps the in-memory store. Firestore loads lazily.
 */
function unifiedApprovalVerifier(): ApprovalVerifier {
  let verifier: ApprovalVerifier | undefined;
  const get = async (): Promise<ApprovalVerifier> => {
    if (!verifier) {
      const [{ adminDb }, { createUnifiedApprovalVerifier }] = await Promise.all([
        import('@/lib/firebase-admin'),
        import('@/platform/policy/unified-approval-store'),
      ]);
      verifier = createUnifiedApprovalVerifier(adminDb);
    }
    return verifier;
  };
  return {
    verify: async (request) => (await get()).verify(request),
    verifyAndBind: async (request) => (await get()).verifyAndBind(request),
  };
}

export function buildProductionGatewayDeps(): ExecuteCapabilityDeps {
  if (productionDefaults) return productionDefaults;

  let livePrincipals: LivePrincipalCheck | undefined;

  productionDefaults = {
    idempotencyStore: defaultIdempotencyStore,
    approvals: selectPlatformStore<ApprovalVerifier>(() => defaultApprovalStore, unifiedApprovalVerifier),
    verifyActorStanding: createActorStandingCheck({
      livePrincipals: async () => {
        if (!livePrincipals) {
          const [{ adminDb }, { createLivePrincipalCheck }] = await Promise.all([
            import('@/lib/firebase-admin'),
            import('@/platform/tasks/live-principal-check'),
          ]);
          livePrincipals = createLivePrincipalCheck(adminDb);
        }
        return livePrincipals;
      },
      lookupApiKey: async (keyId) => {
        const { McpApiKeyService } = await import('@/lib/mcp/api-key-service');
        const key = await McpApiKeyService.getApiKeyById(keyId);
        return key ? { revoked: key.revoked === true, expiresAt: key.expiresAt ?? null } : null;
      },
    }),
  };
  return productionDefaults;
}

const GOVERNED_KEYS = ['idempotencyStore', 'approvals', 'verifyActorStanding'] as const;

/**
 * Merges caller deps over production defaults. A governed key that is missing or `undefined` gets
 * the default.
 * CAUTION: there is deliberately no per-call opt-out. Disabling governance for a call must never
 * be expressible in production code (Rule 68).
 */
export function resolveGatewayDeps(deps: ExecuteCapabilityDeps | undefined): ExecuteCapabilityDeps {
  const defaults = getGovernedGatewayDeps();
  const resolved: ExecuteCapabilityDeps = { ...(deps ?? {}) };
  for (const key of GOVERNED_KEYS) {
    if (resolved[key] === undefined) {
      switch (key) {
        case 'idempotencyStore':
          resolved.idempotencyStore = defaults.idempotencyStore;
          break;
        case 'approvals':
          resolved.approvals = defaults.approvals;
          break;
        case 'verifyActorStanding':
          resolved.verifyActorStanding = defaults.verifyActorStanding;
          break;
      }
    }
  }
  return resolved;
}
