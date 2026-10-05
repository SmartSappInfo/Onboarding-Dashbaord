/**
 * @fileOverview Single registration entry point for canonical capabilities (Phase 0 / Phase 1)
 *
 * Every execution surface (agent-step worker, MCP routes, in-app agents) calls
 * `ensureCapabilitiesRegistered()` before resolving a capability. Without this, a surface running
 * in its own process would see an empty registry and fail every step as CAPABILITY_NOT_REGISTERED.
 *
 * PHASE 1: add each domain's registrar to `DOMAIN_REGISTRARS`, e.g.
 *   import { registerCrmCapabilities } from '@/platform/domains/crm/register';
 *   const DOMAIN_REGISTRARS = [registerCrmCapabilities, …];
 * A registrar calls `registerCapability` for each of its definitions and must be idempotent.
 */

import { registerMemoryCapabilities } from '../domains/memory/memory-capabilities';
import { registerCrmContactsCapabilities } from '@/platform/domains/crm_contacts';
import { registerDealsRevenueCapabilities } from '@/platform/domains/deals_revenue';
import { registerIdentityAccessCapabilities } from '@/platform/domains/identity_access';
import { registerTasksProductivityCapabilities } from '@/platform/domains/tasks_productivity';
import { registerMeetingsConversationsCapabilities } from '@/platform/domains/meetings_conversations';

type Registrar = () => void;

/** Platform domain registrars. */
export const DOMAIN_REGISTRARS: readonly Registrar[] = [
  registerMemoryCapabilities,
  registerCrmContactsCapabilities,
  registerDealsRevenueCapabilities,
  registerIdentityAccessCapabilities,
  registerTasksProductivityCapabilities,
  registerMeetingsConversationsCapabilities,
];

const globalRef = globalThis as { __smartsappCapabilitiesRegistered?: boolean };

export function ensureCapabilitiesRegistered(registrars: readonly Registrar[] = DOMAIN_REGISTRARS): void {
  if (globalRef.__smartsappCapabilitiesRegistered && registrars === DOMAIN_REGISTRARS) return;
  for (const register of registrars) register();
  if (registrars === DOMAIN_REGISTRARS) globalRef.__smartsappCapabilitiesRegistered = true;
}

export function resetCapabilitiesRegisteredForTests(): void {
  globalRef.__smartsappCapabilitiesRegistered = false;
}
