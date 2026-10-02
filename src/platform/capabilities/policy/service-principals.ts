/**
 * @fileOverview Service Principals for Background Services (PR-6 / Workstream 1.3)
 *
 * Implements Rule 16 (Least Privilege) and Rule 69 (Master Layering Axiom).
 *
 * Replaces blanket, un-audited "system" or "cron" bypasses with strictly scoped,
 * least-privilege `AgentPrincipal` definitions for background jobs, automations,
 * import tasks, and webhook pipelines.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import type { AgentPrincipal } from '../contracts/capability-definition';

export const SERVICE_NAMES = [
  'automation',
  'form_pipeline',
  'call_centre',
  'import',
  'system_cron',
] as const;

export type ServiceName = (typeof SERVICE_NAMES)[number];

/**
 * Explicit, fine-grained permission scopes for each internal platform service.
 * Eliminates blanket administrative authority and wildcard scopes.
 */
export const SERVICE_SCOPES: Readonly<Record<ServiceName, readonly string[]>> = {
  automation: [
    'app:contacts_view',
    'app:contacts_manage',
    'app:deals_view',
    'app:deals_manage',
    'app:tasks_view',
    'app:tasks_manage',
  ],
  form_pipeline: [
    'app:contacts_create',
    'app:contacts_update',
    'app:forms_view',
  ],
  call_centre: [
    'app:calls_manage',
    'app:contacts_view',
    'app:notes_create',
  ],
  import: [
    'app:contacts_create',
    'app:contacts_update',
  ],
  system_cron: [
    'app:analytics_view',
    'app:maintenance_execute',
  ],
};

/**
 * Resolves a bounded service-level `AgentPrincipal` for non-interactive backend executions.
 *
 * @param service The name of the platform service.
 * @param workspaceId The target workspace being acted upon.
 * @param organizationId The target organization being acted upon.
 * @returns Fully populated, immutable `AgentPrincipal`.
 */
export function resolveServicePrincipal(
  service: ServiceName,
  workspaceId: string,
  organizationId: string
): AgentPrincipal {
  if (!SERVICE_NAMES.includes(service)) {
    throw new Error(`[ServicePrincipal] Unrecognized service name: '${service}'`);
  }

  if (!organizationId || organizationId.trim() === '') {
    throw new Error('[ServicePrincipal] organizationId is required');
  }

  if (!workspaceId || workspaceId.trim() === '') {
    throw new Error('[ServicePrincipal] workspaceId is required');
  }

  const scopes = SERVICE_SCOPES[service];

  return {
    actorType: 'agent',
    userId: `service:${service}`,
    organizationId,
    workspaceId,
    agentId: `service:${service}`,
    agentVersion: '1.0.0',
    grantedScopes: Array.from(scopes),
    effectiveRole: `service:${service}`,
  };
}
