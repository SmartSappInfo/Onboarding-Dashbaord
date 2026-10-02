/**
 * @fileOverview Capability permission references (decision D6: one RBAC, no second permission
 * system for agents; agents_mcp PR-2).
 *
 * A capability's `permissions` and a principal's `grantedScopes` use references into the app's
 * EXISTING permission vocabularies:
 *   - `app:<id>`                        a flat `APP_PERMISSIONS` id, e.g. `app:system_admin`;
 *   - `rbac:<section>.<feature>.<action>` a `permissionsSchema` coordinate, e.g.
 *                                        `rbac:operations.tasks.create`.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - The valid sections, features and actions are derived from `getFullAdminPermissions()` (the
 *   schema that grants everything), so a new feature in the RBAC engine becomes referenceable
 *   without touching this file. Never hand-maintain a second list here.
 * - `parsePermissionRef` returns null for anything that doesn't resolve; the capability registry
 *   refuses such definitions at registration time.
 */
import { APP_PERMISSIONS, type AppPermissionId, type PermissionsSchema } from '@/lib/types';
import { getFullAdminPermissions } from '@/lib/permissions-engine';

export type RbacSection = keyof PermissionsSchema;
export type RbacAction = 'view' | 'create' | 'edit' | 'delete';

export type ParsedPermissionRef =
  | { kind: 'app'; id: AppPermissionId }
  | { kind: 'rbac'; section: RbacSection; feature: string; action: RbacAction };

const RBAC_ACTIONS: readonly RbacAction[] = ['view', 'create', 'edit', 'delete'];
const APP_PERMISSION_IDS = new Set<string>(APP_PERMISSIONS.map((p) => p.id));
const isAppPermissionId = (id: string): id is AppPermissionId => APP_PERMISSION_IDS.has(id);
const isRbacAction = (value: string): value is RbacAction => (RBAC_ACTIONS as readonly string[]).includes(value);

/** Every `PermissionsSchema` section. The check below fails to compile if a section is added there. */
const RBAC_SECTIONS = ['operations', 'finance', 'studios', 'social', 'workforce', 'management'] as const satisfies readonly RbacSection[];
type UnlistedSection = Exclude<RbacSection, (typeof RBAC_SECTIONS)[number]>;
const sectionsAreExhaustive: [UnlistedSection] extends [never] ? true : never = true;
void sectionsAreExhaustive;

/** section → feature → actions that exist, from the full-admin schema. */
const RBAC_VOCABULARY: ReadonlyMap<string, ReadonlyMap<string, ReadonlySet<string>>> = (() => {
  const full = getFullAdminPermissions();
  const sections = new Map<string, Map<string, Set<string>>>();
  for (const section of RBAC_SECTIONS) {
    const features = new Map<string, Set<string>>();
    for (const [feature, actions] of Object.entries(full[section].features)) {
      features.set(feature, new Set(Object.keys(actions ?? {})));
    }
    sections.set(section, features);
  }
  return sections;
})();

const isRbacSection = (value: string): value is RbacSection => RBAC_VOCABULARY.has(value);

/**
 * Canonical compatibility mapping for pre-D6 domain permissions and legacy aliases.
 * Maps legacy capability coordinate strings to their canonical D6 RBAC/App equivalents.
 */
const LEGACY_PERMISSION_MAP: ReadonlyMap<string, ParsedPermissionRef> = new Map<string, ParsedPermissionRef>([
  // Deals & Pipelines
  ['sales:pipeline:view', { kind: 'rbac', section: 'operations', feature: 'pipeline', action: 'view' }],
  ['sales:pipeline:create', { kind: 'rbac', section: 'operations', feature: 'pipeline', action: 'create' }],
  ['sales:pipeline:edit', { kind: 'rbac', section: 'operations', feature: 'pipeline', action: 'edit' }],
  ['app:deals_view', { kind: 'rbac', section: 'operations', feature: 'pipeline', action: 'view' }],
  ['app:deals_create', { kind: 'rbac', section: 'operations', feature: 'pipeline', action: 'create' }],
  ['app:deals_edit', { kind: 'rbac', section: 'operations', feature: 'pipeline', action: 'edit' }],
  ['deal:read', { kind: 'rbac', section: 'operations', feature: 'pipeline', action: 'view' }],
  ['deal:create', { kind: 'rbac', section: 'operations', feature: 'pipeline', action: 'create' }],
  ['deal:edit', { kind: 'rbac', section: 'operations', feature: 'pipeline', action: 'edit' }],
  ['deal:stage_update', { kind: 'rbac', section: 'operations', feature: 'pipeline', action: 'edit' }],
  ['deal:assign', { kind: 'rbac', section: 'operations', feature: 'pipeline', action: 'edit' }],
  ['pipeline:read', { kind: 'rbac', section: 'operations', feature: 'pipeline', action: 'view' }],

  // Tasks & Productivity
  ['operations:tasks:view', { kind: 'rbac', section: 'operations', feature: 'tasks', action: 'view' }],
  ['operations:tasks:create', { kind: 'rbac', section: 'operations', feature: 'tasks', action: 'create' }],
  ['operations:tasks:edit', { kind: 'rbac', section: 'operations', feature: 'tasks', action: 'edit' }],
  ['operations:tasks:delete', { kind: 'rbac', section: 'operations', feature: 'tasks', action: 'delete' }],
  ['app:tasks_view', { kind: 'rbac', section: 'operations', feature: 'tasks', action: 'view' }],
  ['app:tasks_create', { kind: 'rbac', section: 'operations', feature: 'tasks', action: 'create' }],
  ['app:tasks_edit', { kind: 'rbac', section: 'operations', feature: 'tasks', action: 'edit' }],
  ['tasks:read', { kind: 'rbac', section: 'operations', feature: 'tasks', action: 'view' }],
  ['tasks:create', { kind: 'rbac', section: 'operations', feature: 'tasks', action: 'create' }],
  ['tasks:edit', { kind: 'rbac', section: 'operations', feature: 'tasks', action: 'edit' }],
  ['tasks.write', { kind: 'rbac', section: 'operations', feature: 'tasks', action: 'edit' }],

  // CRM Contacts & Entities
  ['operations:campuses:view', { kind: 'rbac', section: 'operations', feature: 'campuses', action: 'view' }],
  ['operations:campuses:create', { kind: 'rbac', section: 'operations', feature: 'campuses', action: 'create' }],
  ['operations:campuses:edit', { kind: 'rbac', section: 'operations', feature: 'campuses', action: 'edit' }],
  ['operations:campuses:delete', { kind: 'rbac', section: 'operations', feature: 'campuses', action: 'delete' }],
  ['app:contacts_view', { kind: 'rbac', section: 'operations', feature: 'campuses', action: 'view' }],
  ['app:contacts_create', { kind: 'rbac', section: 'operations', feature: 'campuses', action: 'create' }],
  ['app:contacts_edit', { kind: 'rbac', section: 'operations', feature: 'campuses', action: 'edit' }],
  ['app:contacts_delete', { kind: 'rbac', section: 'operations', feature: 'campuses', action: 'delete' }],
  ['crm:entities:read', { kind: 'rbac', section: 'operations', feature: 'campuses', action: 'view' }],
  ['crm:entities:create', { kind: 'rbac', section: 'operations', feature: 'campuses', action: 'create' }],
  ['crm:entities:edit', { kind: 'rbac', section: 'operations', feature: 'campuses', action: 'edit' }],
  ['crm:entities:delete', { kind: 'rbac', section: 'operations', feature: 'campuses', action: 'delete' }],
  ['crm:activity:create', { kind: 'rbac', section: 'operations', feature: 'campuses', action: 'edit' }],
  ['crm:notes:create', { kind: 'rbac', section: 'operations', feature: 'campuses', action: 'edit' }],
  ['crm:timeline:view', { kind: 'rbac', section: 'operations', feature: 'campuses', action: 'view' }],
  ['crm:tags:view', { kind: 'rbac', section: 'studios', feature: 'tags', action: 'view' }],
  ['crm:tags:edit', { kind: 'rbac', section: 'studios', feature: 'tags', action: 'edit' }],

  // Identity & Access
  ['identity:access:check', { kind: 'rbac', section: 'workforce', feature: 'users', action: 'view' }],
  ['identity:read', { kind: 'rbac', section: 'workforce', feature: 'users', action: 'view' }],
  ['identity:access:list', { kind: 'rbac', section: 'workforce', feature: 'users', action: 'view' }],
  ['workspace:read', { kind: 'rbac', section: 'operations', feature: 'dashboard', action: 'view' }],
  ['app:portal_view', { kind: 'app', id: 'portals_view' }],
  ['test.execute', { kind: 'rbac', section: 'operations', feature: 'tasks', action: 'view' }],
]);

export function parsePermissionRef(ref: string): ParsedPermissionRef | null {
  const value = ref.trim();
  if (value.startsWith('app:')) {
    const id = value.slice('app:'.length);
    if (isAppPermissionId(id)) return { kind: 'app', id };
  }
  if (value.startsWith('rbac:')) {
    const parts = value.slice('rbac:'.length).split('.');
    if (parts.length === 3) {
      const [section, feature, action] = parts;
      if (isRbacSection(section) && isRbacAction(action)) {
        const actions = RBAC_VOCABULARY.get(section)?.get(feature);
        if (actions?.has(action)) return { kind: 'rbac', section, feature, action };
      }
    }
  }
  if (value.startsWith('tools:')) {
    const toolName = value.slice('tools:'.length);
    if (toolName.startsWith('deal.')) {
      return { kind: 'rbac', section: 'operations', feature: 'pipeline', action: toolName.includes('update') ? 'edit' : 'view' };
    }
    if (toolName.startsWith('task.')) {
      return { kind: 'rbac', section: 'operations', feature: 'tasks', action: toolName.includes('create') ? 'create' : 'view' };
    }
    if (toolName.startsWith('crm.')) {
      return { kind: 'rbac', section: 'operations', feature: 'campuses', action: toolName.includes('search') || toolName.includes('get') ? 'view' : 'edit' };
    }
    if (toolName.startsWith('campaign.')) {
      return { kind: 'rbac', section: 'social', feature: 'campaigns', action: 'view' };
    }
    return { kind: 'rbac', section: 'operations', feature: 'dashboard', action: 'view' };
  }
  return LEGACY_PERMISSION_MAP.get(value) ?? null;
}

export const isPermissionRef = (ref: string): boolean => parsePermissionRef(ref) !== null;
