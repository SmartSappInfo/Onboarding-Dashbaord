/**
 * @fileOverview Canonical Domain Event Schema (Phase 0 / Phase 2)
 *
 * Implements Rule 20, Rule 39, and Section 5 (Phase 2) of SmartSapp Roadmap.
 * All canonical capabilities emit typed domain events with correlation and causation IDs
 * for OpenTelemetry tracing, audit log immutability, and reactive automations.
 */

import { z } from 'zod';

export const ActorSchema = z.object({
  type: z.enum(['user', 'agent', 'automation', 'system', 'api']),
  id: z.string().min(1),
  agentVersion: z.string().optional(),
  delegationId: z.string().optional(),
});

export type EventActor = z.infer<typeof ActorSchema>;

export const EntityRefSchema = z.object({
  type: z.string().min(1),
  id: z.string().min(1),
  version: z.string().optional(),
});

export type EventEntityRef = z.infer<typeof EntityRefSchema>;

export const DomainEventSchema = z.object({
  id: z.string().uuid(),
  type: z.string().min(1), // e.g. "crm.deal.stage_changed", "portal.member.enrolled"
  version: z.string().default('1.0.0'),
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1).optional().nullable(),
  actor: ActorSchema,
  entity: EntityRefSchema,
  timestamp: z.string().datetime(),
  payload: z.record(z.string(), z.unknown()),
  correlationId: z.string().min(1),
  causationId: z.string().optional(),
  source: z.string().min(1),
  idempotencyKey: z.string().optional(),
});

export type DomainEvent = z.infer<typeof DomainEventSchema>;

/** Factory to construct a validated DomainEvent */
export function createDomainEvent(
  params: Omit<DomainEvent, 'id' | 'timestamp' | 'version' | 'workspaceId'> & {
    version?: string;
    workspaceId?: string | null;
  }
): DomainEvent {
  const event: DomainEvent = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    version: params.version || '1.0.0',
    workspaceId: params.workspaceId ?? null,
    ...params,
  };
  return DomainEventSchema.parse(event);
}

