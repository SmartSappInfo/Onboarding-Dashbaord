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

export function parsePermissionRef(ref: string): ParsedPermissionRef | null {
  const value = ref.trim();
  if (value.startsWith('app:')) {
    const id = value.slice('app:'.length);
    return isAppPermissionId(id) ? { kind: 'app', id } : null;
  }
  if (value.startsWith('rbac:')) {
    const parts = value.slice('rbac:'.length).split('.');
    if (parts.length !== 3) return null;
    const [section, feature, action] = parts;
    if (!isRbacSection(section) || !isRbacAction(action)) return null;
    const actions = RBAC_VOCABULARY.get(section)?.get(feature);
    return actions?.has(action) ? { kind: 'rbac', section, feature, action } : null;
  }
  return null;
}

export const isPermissionRef = (ref: string): boolean => parsePermissionRef(ref) !== null;
