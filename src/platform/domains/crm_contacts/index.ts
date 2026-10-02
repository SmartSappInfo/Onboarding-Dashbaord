/**
 * @fileOverview Domain: crm_contacts (Phase 1 / PR-11 & PR-12)
 *
 * Implements Rule 4 (Strict Typing), Rule 12 (Server-Side Risk), Rule 18 (TOCTOU),
 * Rule 40 (Domain Events), Rule 47 (Explicit Workspace Scope), and Rule 69 (Master Layering Axiom).
 *
 * Exports and registers canonical CRM, Contact, Tag, and Note capabilities.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { registerCapability } from '../../capabilities/registry/capability-registry';
import type { AnyCapabilityDefinition } from '../../capabilities/contracts/capability-definition';

import {
  addTagCapability,
  removeTagCapability,
  listTagsCapability,
} from './contracts/tag-capabilities.contract';

import {
  createActivityCapability,
  createNoteCapability,
  getTimelineCapability,
} from './contracts/note-capabilities.contract';

import {
  entitySearchCapability,
  entityGetCapability,
  entityCreateCapability,
  entityUpdateCapability,
  workspaceEntityUpdateCapability,
  workspaceEntityArchiveCapability,
} from './contracts/entity-capabilities.contract';

export * from './contracts/tag-capabilities.contract';
export * from './contracts/note-capabilities.contract';
export * from './contracts/entity-capabilities.contract';

export const CRM_CONTACTS_CAPABILITIES: AnyCapabilityDefinition[] = [
  addTagCapability as AnyCapabilityDefinition,
  removeTagCapability as AnyCapabilityDefinition,
  listTagsCapability as AnyCapabilityDefinition,
  createActivityCapability as AnyCapabilityDefinition,
  createNoteCapability as AnyCapabilityDefinition,
  getTimelineCapability as AnyCapabilityDefinition,
  entitySearchCapability as AnyCapabilityDefinition,
  entityGetCapability as AnyCapabilityDefinition,
  entityCreateCapability as AnyCapabilityDefinition,
  entityUpdateCapability as AnyCapabilityDefinition,
  workspaceEntityUpdateCapability as AnyCapabilityDefinition,
  workspaceEntityArchiveCapability as AnyCapabilityDefinition,
];

/**
 * Registers all crm_contacts capabilities into the platform registry with allowOverride: true.
 */
export function registerCrmContactsCapabilities(): void {
  for (const capability of CRM_CONTACTS_CAPABILITIES) {
    registerCapability(capability, { allowOverride: true });
  }
}

// Auto-register upon domain module import
registerCrmContactsCapabilities();
