/**
 * @fileOverview Canonical Actor Normalizer (Phase 2 Milestone 2)
 *
 * Implements Rule 4 (Strict Typing), Rule 16 (Natural Language Feedback & Actor Classes),
 * and Rule 13 (Trust Boundary Matrix).
 *
 * Normalizes heterogeneous actors across user, agent, automation, and system into
 * standardized NormalizedActor structures with consistent display names and UI badges.
 */

import type { EventActor } from '@/platform/capabilities/events/domain-event';
import type { NormalizedActor } from '@/platform/events/contracts/activity-record.contract';

export interface ActorContext {
  userName?: string;
  email?: string;
  avatarUrl?: string;
  agentRole?: string;
  model?: string;
  workflowName?: string;
  systemComponent?: string;
  metadata?: Record<string, unknown>;
}

const AGENT_ROLE_MAP: Record<string, string> = {
  'agent-sdr': 'AI SDR Agent',
  'agent-deal': 'AI Deal Copilot',
  'agent-enrichment': 'AI Lead Enrichment Agent',
  'agent-messaging': 'AI Messaging Assistant',
  'agent-support': 'AI Customer Support Agent',
};

/**
 * Standardizes an actor into canonical NormalizedActor with UI styling metadata.
 */
export function normalizeActor(
  actor: EventActor,
  context?: ActorContext
): NormalizedActor {
  switch (actor.type) {
    case 'user': {
      const displayName =
        context?.userName?.trim() ||
        (context?.email ? context.email.split('@')[0] : undefined) ||
        `User ${actor.id.slice(0, 8)}`;

      return {
        type: 'user',
        id: actor.id,
        displayName,
        avatarUrl: context?.avatarUrl || undefined,
        metadata: {
          icon: 'User',
          color: 'blue',
          ...context?.metadata,
        },
      };
    }

    case 'agent': {
      const role =
        context?.agentRole?.trim() ||
        AGENT_ROLE_MAP[actor.id] ||
        `AI Agent (${actor.id})`;

      return {
        type: 'agent',
        id: actor.id,
        displayName: role,
        agentRole: role,
        model: context?.model || 'SmartSapp AI',
        metadata: {
          icon: 'Sparkles',
          color: 'purple',
          version: actor.agentVersion,
          ...context?.metadata,
        },
      };
    }

    case 'automation': {
      const displayName =
        context?.workflowName?.trim() || `Automation (${actor.id})`;

      return {
        type: 'automation',
        id: actor.id,
        displayName,
        metadata: {
          icon: 'Zap',
          color: 'amber',
          ...context?.metadata,
        },
      };
    }

    case 'system':
    case 'api':
    default: {
      const displayName =
        context?.systemComponent?.trim() || 'SmartSapp System';

      return {
        type: 'system',
        id: actor.id,
        displayName,
        metadata: {
          icon: 'Settings2',
          color: 'slate',
          ...context?.metadata,
        },
      };
    }
  }
}
