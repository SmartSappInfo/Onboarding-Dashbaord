/**
 * @fileOverview Flag defaults parity (Phase 11 M0 · T0.5).
 *
 * Production flags moved from RAM to Firestore (F1). This must change nothing until an operator
 * writes a flag: with no `platform_features` documents, and an `ai_config` document holding only
 * the AI provider settings Backoffice writes today, the Firestore service must decide exactly like
 * the in-memory service for every registered capability and every surface.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';

const aiConfigDoc = { defaultProvider: 'googleai', defaultModelId: 'gemini-3.5-flash' };

vi.mock('@/lib/firebase-admin', () => {
  const missing = { exists: false, data: () => undefined };
  return {
    adminDb: {
      doc: (path: string) => ({
        get: async () =>
          path === 'system_settings/ai_config' ? { exists: true, data: () => aiConfigDoc } : missing,
      }),
      collection: () => ({
        doc: () => ({ get: async () => missing }),
      }),
    },
  };
});

import { FirestoreFlagService, InMemoryFlagService } from '../../capabilities/flags/flag-service';
import { ensureCapabilitiesRegistered } from '../../capabilities/registry/register-capabilities';
import { listCapabilities } from '../../capabilities/registry/capability-registry';
import type { AgentPrincipal } from '../../capabilities/contracts/capability-definition';
import type { InvocationSurface } from '../../capabilities/execution/invocation';

const userPrincipal: AgentPrincipal = {
  actorType: 'user', userId: 'u1', organizationId: 'org-1', workspaceId: 'ws-1',
  grantedScopes: [], effectiveRole: 'admin',
};
const agentPrincipal: AgentPrincipal = { ...userPrincipal, actorType: 'agent', agentId: 'crm_researcher' };
const surfaces: InvocationSurface[] = ['ui', 'mcp', 'agent', 'automation', 'task_worker', 'api'];

describe('flag defaults parity: Firestore (no flag docs) ≡ in-memory', () => {
  beforeAll(() => {
    ensureCapabilitiesRegistered();
  });

  it('has capabilities to compare', () => {
    expect(listCapabilities().length).toBeGreaterThan(0);
  });

  it('decides identically for every capability, principal and surface', async () => {
    const firestore = new FirestoreFlagService();
    const memory = new InMemoryFlagService();
    for (const capability of listCapabilities()) {
      for (const principal of [userPrincipal, agentPrincipal]) {
        for (const surface of surfaces) {
          const [a, b] = await Promise.all([
            firestore.checkFlag({ capability, principal, surface }),
            memory.checkFlag({ capability, principal, surface }),
          ]);
          expect({ id: capability.id, surface, enabled: a.enabled }).toEqual({
            id: capability.id,
            surface,
            enabled: b.enabled,
          });
        }
      }
    }
  });

  it('keeps autonomous execution on when ai_config has no kill-switch fields', async () => {
    const control = await new FirestoreFlagService().getGlobalAutonomousControl();
    expect(control).toEqual({ autonomousExecutionEnabled: true, killSwitch: false, reason: undefined });
  });
});
