import { 
  PermissionsSchema, 
  AppPermissionId, 
  FeatureToggleMap,
  AppFeatureId,
  FeaturePermissionSet
} from './types';
import { getBlankPermissions, getFullAdminPermissions } from './permissions-engine';
import { 
  collection, 
  writeBatch, 
  getDocs, 
  query, 
  where,
  doc
} from 'firebase/firestore';

/**
 * Migrates a legacy flat permission array and feature toggle map into the new hierarchical schema.
 * 
 * This is used during the transition phase to ensure that existing users and roles 
 * gain the correct structured permissions based on their previous flat access.
 */
export function migrateToPermissionsSchema(
  legacyPermissions: AppPermissionId[] = [],
  featureToggles: FeatureToggleMap = {}
): PermissionsSchema {
  // 1. If system_admin is present, they get the keys to the castle.
  if (legacyPermissions.includes('system_admin')) {
    return getFullAdminPermissions();
  }

  const schema = getBlankPermissions();

  // 2. Enable Sections based on broad permission presence
  if (legacyPermissions.some(p => 
    p.startsWith('schools_') || 
    p.startsWith('prospects_') || 
    p.startsWith('meetings_') || 
    p.startsWith('tasks_') ||
    p === 'dashboard_manage'
  )) {
    schema.operations.enabled = true;
  }
  
  if (legacyPermissions.some(p => p.startsWith('finance_') || p === 'contracts_delete')) {
    schema.finance.enabled = true;
  }
  
  if (legacyPermissions.some(p => p.startsWith('studios_') || p.startsWith('tags_') || p.startsWith('forms_'))) {
    schema.studios.enabled = true;
  }
  
  if (legacyPermissions.some(p => p.startsWith('activities_') || p.startsWith('fields_'))) {
    schema.management.enabled = true;
  }

  // 3. Map individual legacy permissions to the new schema
  legacyPermissions.forEach(perm => {
    switch (perm) {
      // Operations
      case 'schools_view':
        setFeaturePermission(schema, 'operations', 'campuses', { view: true });
        break;
      case 'schools_edit':
        setFeaturePermission(schema, 'operations', 'campuses', { view: true, create: true, edit: true });
        break;
      case 'prospects_view':
        setFeaturePermission(schema, 'operations', 'pipeline', { view: true });
        break;
      case 'meetings_manage':
        setFeaturePermission(schema, 'operations', 'meetings', { view: true, create: true, edit: true, delete: true });
        break;
      case 'tasks_manage':
        setFeaturePermission(schema, 'operations', 'tasks', { view: true, create: true, edit: true, delete: true });
        break;
      case 'dashboard_manage':
        setFeaturePermission(schema, 'operations', 'dashboard', { view: true, edit: true });
        break;

      // Finance
      case 'finance_view':
        ['agreements', 'invoices', 'packages', 'cycles', 'billingSetup'].forEach(f => {
           setFeaturePermission(schema, 'finance', f, { view: true });
        });
        break;
      case 'finance_manage':
        ['agreements', 'invoices', 'packages', 'cycles', 'billingSetup'].forEach(f => {
           setFeaturePermission(schema, 'finance', f, { view: true, create: true, edit: true });
        });
        break;
      case 'contracts_delete':
        setFeaturePermission(schema, 'finance', 'agreements', { delete: true });
        break;

      // Studios
      case 'studios_view':
        ['publicPortals', 'landingPages', 'media', 'surveys', 'docSigning', 'messaging', 'forms'].forEach(f => {
          setFeaturePermission(schema, 'studios', f, { view: true });
        });
        break;
      case 'studios_edit':
        ['publicPortals', 'landingPages', 'media', 'surveys', 'docSigning', 'messaging', 'forms'].forEach(f => {
          setFeaturePermission(schema, 'studios', f, { view: true, create: true, edit: true });
        });
        break;
      case 'forms_manage':
        setFeaturePermission(schema, 'studios', 'forms', { view: true, create: true, edit: true });
        break;
      case 'tags_view':
        setFeaturePermission(schema, 'studios', 'tags', { view: true });
        break;
      case 'tags_manage':
        setFeaturePermission(schema, 'studios', 'tags', { view: true, create: true, edit: true });
        break;
      case 'tags_apply':
        setFeaturePermission(schema, 'studios', 'tags', { view: true });
        break;

      // Management
      case 'activities_view':
        setFeaturePermission(schema, 'management', 'activities', { view: true });
        break;
      case 'fields_manage':
        setFeaturePermission(schema, 'management', 'fields', { view: true, create: true, edit: true, delete: true });
        break;
    }
  });

  // 4. Overwrite/Sync with Feature Toggles
  // If a feature is toggled OFF, we ensure its view permission is false in the schema.
  Object.entries(featureToggles).forEach(([featureId, enabled]) => {
    if (enabled === false) {
      const mapped = featureMapping[featureId as AppFeatureId];
      if (mapped) {
        const { section, feature } = mapped;
        if (schema[section].features[feature]) {
          schema[section].features[feature].view = false;
        }
      }
    }
  });

  return schema;
}

/**
 * Helper to safely set/update a feature's permissions.
 */
function setFeaturePermission(
  schema: PermissionsSchema,
  section: keyof PermissionsSchema,
  feature: string,
  permissions: Partial<FeaturePermissionSet>
) {
  if (!schema[section].features[feature]) {
    schema[section].features[feature] = { view: false };
  }
  Object.assign(schema[section].features[feature], permissions);
}

/**
 * Mapping of legacy Feature IDs to the new hierarchical structure.
 */
const featureMapping: Record<AppFeatureId, { section: keyof PermissionsSchema; feature: string }> = {
  entities: { section: 'operations', feature: 'campuses' },
  pipeline: { section: 'operations', feature: 'pipeline' },
  tasks: { section: 'operations', feature: 'tasks' },
  meetings: { section: 'operations', feature: 'meetings' },
  automations: { section: 'operations', feature: 'automations' },
  reports: { section: 'operations', feature: 'intelligence' },
  portals: { section: 'studios', feature: 'publicPortals' },
  media: { section: 'studios', feature: 'media' },
  surveys: { section: 'studios', feature: 'surveys' },
  pdfs: { section: 'studios', feature: 'docSigning' },
  messaging: { section: 'studios', feature: 'messaging' },
  tags: { section: 'studios', feature: 'tags' },
  forms: { section: 'studios', feature: 'forms' },
  agreements: { section: 'finance', feature: 'agreements' },
  invoices: { section: 'finance', feature: 'invoices' },
  packages: { section: 'finance', feature: 'packages' },
  billing_periods: { section: 'finance', feature: 'cycles' },
  billing_setup: { section: 'finance', feature: 'billingSetup' },
};

/**
 * Executes a global migration of all Roles and Users to the new hierarchical schema.
 * 
 * @param firestore - Firebase Firestore instance
 * @param organizationId - The organization context
 * @returns count of updated documents
 */
export async function migrateAllPermissions(
  firestore: any, 
  organizationId: string
): Promise<{ rolesUpdated: number, usersUpdated: number }> {
  const batch = writeBatch(firestore);
  let rolesUpdatedCount = 0;
  let usersUpdatedCount = 0;

  // 1. Fetch and migrate all Roles
  console.log(`>>> [MIGRATION] Fetching roles for organization: ${organizationId}`);
  const rolesSnap = await getDocs(query(
    collection(firestore, 'roles'),
    where('organizationId', '==', organizationId)
  ));

  rolesSnap.forEach(roleDoc => {
    const data = roleDoc.data();
    // We migrate if schema is missing OR we want to force refresh (for now we force refresh to ensure consistency)
    const schema = migrateToPermissionsSchema(data.permissions || []);
    batch.update(roleDoc.ref, { 
      permissionsSchema: schema, 
      updatedAt: new Date().toISOString(),
      migrationNote: 'Auto-migrated to Hierarchical RBAC V1'
    });
    rolesUpdatedCount++;
  });

  // 2. Fetch and migrate all Users
  console.log(`>>> [MIGRATION] Fetching users for organization: ${organizationId}`);
  const usersSnap = await getDocs(query(
    collection(firestore, 'users'),
    where('organizationId', '==', organizationId)
  ));

  usersSnap.forEach(userDoc => {
    const data = userDoc.data();
    const schema = migrateToPermissionsSchema(data.permissions || []);
    batch.update(userDoc.ref, { 
      permissionsSchema: schema, 
      updatedAt: new Date().toISOString(),
      migrationNote: 'Auto-migrated to Hierarchical RBAC V1'
    });
    usersUpdatedCount++;
  });

  if (rolesUpdatedCount > 0 || usersUpdatedCount > 0) {
    await batch.commit();
    console.log(`✅ [MIGRATION] Successfully updated ${rolesUpdatedCount} roles and ${usersUpdatedCount} users.`);
  } else {
    console.log('ℹ️ [MIGRATION] No documents required update.');
  }

  return { rolesUpdated: rolesUpdatedCount, usersUpdated: usersUpdatedCount };
}
