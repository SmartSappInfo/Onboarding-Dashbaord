/**
 * @fileOverview Plain English Summary Engine (Phase 2 Milestone 2)
 *
 * Implements Rule 4 (Strict Typing), Rule 7 (Visual Clarity & Everyday UI English),
 * and Rule 13 (Trust Boundary Matrix & XSS Sanitation).
 *
 * Translates structured domain events into clean, natural language activity summaries.
 */

import type { DomainEvent } from '@/platform/capabilities/events/domain-event';

export interface SummaryFormatOptions {
  actorDisplayName?: string;
}

/**
 * Sanitizes untrusted strings by stripping HTML tags and unescaped delimiters.
 */
function sanitizeText(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Strip script tags & contents
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')   // Strip style tags & contents
    .replace(/<[^>]+>/g, '') // Strip any remaining HTML tags
    .replace(/[\r\n\t]+/g, ' ') // Collapse whitespace
    .trim();
}

/**
 * Formats a canonical DomainEvent into an everyday UI English summary.
 */
export function formatEventSummary(
  event: DomainEvent,
  options?: SummaryFormatOptions
): string {
  const actor =
    options?.actorDisplayName?.trim() ||
    sanitizeText(event.actor.id) ||
    'System';

  const entityType = sanitizeText(event.entity.type);
  const entityId = sanitizeText(event.entity.id);
  const payload = event.payload || {};

  // Extract common sanitized fields from payload
  const name =
    sanitizeText(payload.name) ||
    sanitizeText(payload.title) ||
    entityId;

  const stage = sanitizeText(payload.newStage || payload.stage);
  const tag = sanitizeText(payload.tagName || payload.tag);

  switch (event.type) {
    // CRM Domain
    case 'crm.contact.created':
      return `${actor} created contact ${name}`;
    case 'crm.contact.updated':
      return `${actor} updated contact ${name}`;
    case 'crm.contact.tagged':
      return tag ? `${actor} added tag '${tag}' to ${name}` : `${actor} tagged contact ${name}`;
    case 'crm.contact.untagged':
      return tag ? `${actor} removed tag '${tag}' from ${name}` : `${actor} untagged contact ${name}`;
    case 'crm.contact.linked_workspace':
      return `${actor} linked contact ${name} to workspace`;

    // Deals Domain
    case 'deal.created':
      return `${actor} created deal '${name}'`;
    case 'deal.stage_changed':
      return stage
        ? `${actor} moved deal '${name}' to stage '${stage}'`
        : `${actor} advanced deal '${name}'`;
    case 'deal.value_updated':
      return `${actor} updated value for deal '${name}'`;
    case 'deal.won':
      return `${actor} marked deal '${name}' as WON`;
    case 'deal.lost':
      return `${actor} marked deal '${name}' as LOST`;

    // Tasks Domain
    case 'task.created':
      return `${actor} created task '${name}'`;
    case 'task.completed':
      return `${actor} completed task '${name}'`;
    case 'task.assigned':
      return `${actor} assigned task '${name}'`;

    // Portal Domain
    case 'portal.created':
      return `${actor} created portal '${name}'`;
    case 'portal.membership.subscribed':
      return `${actor} joined portal membership`;
    case 'portal.membership.cancelled':
      return `${actor} cancelled portal membership`;
    case 'portal.course.completed':
      return `${actor} completed course '${name}'`;

    // Default Fallback (Rule 7: Simple, everyday English)
    default: {
      const parts = event.type.split('.');
      const action = parts[parts.length - 1] || 'modified';
      return `${actor} performed ${action} on ${entityType} ${name}`;
    }
  }
}
