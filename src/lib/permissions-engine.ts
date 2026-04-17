
import { PermissionsSchema, AppPermissionAction, AppFeatureId } from './types';

/**
 * Checks if a user has a specific permission based on the hierarchical schema.
 * 
 * Evaluation Logic:
 * 1. Section Must Be Enabled: If the section is disabled, all sub-features are denied.
 * 2. Feature Master Check: If the feature is missing or its 'view' flag is false, it's denied.
 * 3. Default Deny: If an action (create, edit, delete) is not explicitly true, it's denied.
 * 
 * @param schema - The user's or role's permission schema
 * @param section - The top-level section (e.g., 'operations')
 * @param feature - The specific sub-feature (e.g., 'campuses')
 * @param action - the CRUD action to check (view, create, edit, delete)
 * @returns boolean
 */
export function evaluatePermission(
  schema: PermissionsSchema | undefined,
  section: keyof PermissionsSchema,
  feature: string,
  action: AppPermissionAction = 'view'
): boolean {
  if (!schema) return false;

  const sectionPerm = schema[section];
  
  // Rule: Section Must Be Enabled
  if (!sectionPerm?.enabled) {
    return false;
  }

  const featurePerm = sectionPerm.features[feature];
  
  // Rule: Feature Must Exist
  if (!featurePerm) {
    return false;
  }

  // Rule: View is required for everything
  // If view is false, you can't even see the module, let alone act on it.
  if (action === 'view') {
    return featurePerm.view;
  }

  // If you can't view, you can't do anything else
  if (!featurePerm.view) {
    return false;
  }

  // Rule: Default Deny for CRUD actions
  return !!featurePerm[action];
}

/**
 * Returns a blank schema with all sections and features disabled.
 */
export function getBlankPermissions(): PermissionsSchema {
  return {
    operations: { enabled: false, features: {} },
    finance: { enabled: false, features: {} },
    studios: { enabled: false, features: {} },
    management: { enabled: false, features: {} },
  };
}

/**
 * Returns a full permission schema with all features and CRUD actions enabled.
 * Used for Super Admins and the default Admin role.
 */
export function getFullAdminPermissions(): PermissionsSchema {
  return {
    operations: {
      enabled: true,
      features: {
        dashboard: { view: true },
        campuses: { view: true, create: true, edit: true, delete: true },
        pipeline: { view: true, create: true, edit: true, delete: true },
        tasks: { view: true, create: true, edit: true, delete: true },
        meetings: { view: true, create: true, edit: true, delete: true },
        automations: { view: true, create: true, edit: true, delete: true },
        intelligence: { view: true },
      },
    },
    finance: {
      enabled: true,
      features: {
        agreements: { view: true, create: true, edit: true, delete: true },
        invoices: { view: true, create: true, edit: true, delete: true },
        packages: { view: true, create: true, edit: true, delete: true },
        cycles: { view: true, create: true, edit: true, delete: true },
        billingSetup: { view: true, edit: true },
      },
    },
    studios: {
      enabled: true,
      features: {
        publicPortals: { view: true, create: true, edit: true, delete: true },
        landingPages: { view: true, create: true, edit: true, delete: true },
        media: { view: true, create: true, edit: true, delete: true },
        surveys: { view: true, create: true, edit: true, delete: true },
        docSigning: { view: true, create: true, edit: true, delete: true },
        messaging: { view: true, create: true, edit: true, delete: true },
        forms: { view: true, create: true, edit: true, delete: true },
        tags: { view: true, create: true, edit: true, delete: true },
      },
    },
    management: {
      enabled: true,
      features: {
        activities: { view: true },
        users: { view: true, create: true, edit: true, delete: true },
        fields: { view: true, create: true, edit: true, delete: true },
        systemSettings: { view: true, edit: true },
      },
    },
  };
}

/**
 * Maps a legacy AppFeatureId to its hierarchical coordinates.
 */
export const featureToCoordinates: Record<AppFeatureId, { section: keyof PermissionsSchema; feature: string }> = {
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
 * Merges multiple permission schemas into a single schema.
 * Uses 'OR' logic (if any schema grants access, the resulting schema grants access).
 */
export function mergePermissionsSchemas(schemas: PermissionsSchema[]): PermissionsSchema {
  const result = getBlankPermissions();

  schemas.forEach(schema => {
    (Object.keys(result) as (keyof PermissionsSchema)[]).forEach(sectionKey => {
      const section = schema[sectionKey];
      if (!section) return;

      if (section.enabled) {
        result[sectionKey].enabled = true;
      }

      Object.entries(section.features).forEach(([featureId, perms]) => {
        if (!result[sectionKey].features[featureId]) {
          result[sectionKey].features[featureId] = { view: false };
        }

        const target = result[sectionKey].features[featureId];
        if (perms.view) target.view = true;
        if (perms.create) target.create = true;
        if (perms.edit) target.edit = true;
        if (perms.delete) target.delete = true;
      });
    });
  });

  return result;
}
