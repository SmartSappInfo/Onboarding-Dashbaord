import * as React from 'react';
import type { Metadata } from 'next';
import { AgentRegistryClient } from './AgentRegistryClient';
import { BUILT_IN_AGENT_PERSONAS } from '@/platform/identity/agent-registry';
import type { AgentPersonaSummary } from '@/platform/registry/contracts/registry-types';

/**
 * @fileOverview Agent Persona Registry Server Page (/admin/settings/ai/agents) (Phase 15 Milestone 4 Task 6)
 *
 * Implements:
 * - Rule 4: Strict Typing Protocol (Zero any or any[]).
 * - Rule 7: Mobile-first responsive views, touch targets >= 44px.
 * - Rule 51: Next.js 15 Server Component.
 * - Rule 69: Strangler Fig Invariant.
 */

export const metadata: Metadata = {
  title: 'Agent Persona Registry | SmartSapp Backoffice',
  description:
    'Catalog of canonical enterprise agent personas, immutable risk ceilings, domain authorizations, and execution budgets.',
};

export const dynamic = 'force-dynamic';

export default async function AgentRegistryPage(): Promise<React.JSX.Element> {
  const personas: AgentPersonaSummary[] = BUILT_IN_AGENT_PERSONAS.map((p) => ({
    id: p.id,
    name: p.name,
    version: p.version,
    role: p.role,
    description: p.description,
    maxAutonomousRiskLevel: p.maxAutonomousRiskLevel,
    allowedDomains: [...p.allowedDomains],
    maxDurationMs: p.budgets.maxDurationMs,
    maxTokens: p.budgets.maxTokens,
    maxToolCalls: p.budgets.maxToolCalls,
    isConfigurable: false,
  }));

  return (
    <React.Suspense
      fallback={
        <div className="h-full w-full flex items-center justify-center p-8 text-muted-foreground text-sm font-mono">
          Loading Agent Persona Registry...
        </div>
      }
    >
      <AgentRegistryClient initialPersonas={personas} />
    </React.Suspense>
  );
}
