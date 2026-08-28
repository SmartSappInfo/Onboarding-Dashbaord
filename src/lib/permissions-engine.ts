
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
        quickNotes: { view: true, create: true, edit: true, delete: true },
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
        qrStudio: { view: true, create: true, edit: true, delete: true },
        verifyStudio: { view: true, create: true, edit: true, delete: true },
        socialIntelligence: { view: true, create: true, edit: true, delete: true },
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
 * Returns a template schema for Finance Administrators.
 */
export function getFinancePermissions(): PermissionsSchema {
  const blank = getBlankPermissions();
  blank.finance = {
    enabled: true,
    features: {
      agreements: { view: true, create: true, edit: true, delete: false },
      invoices: { view: true, create: true, edit: true, delete: false },
      packages: { view: true, create: true, edit: true, delete: false },
      cycles: { view: true, create: true, edit: true, delete: false },
      billingSetup: { view: true, edit: true },
    },
  };
  return blank;
}

/**
 * Returns a template schema for Marketing / Studio Managers.
 */
export function getMarketingPermissions(): PermissionsSchema {
  const blank = getBlankPermissions();
  blank.studios = {
    enabled: true,
    features: {
      publicPortals: { view: true, create: true, edit: true, delete: false },
      landingPages: { view: true, create: true, edit: true, delete: true },
      media: { view: true, create: true, edit: true, delete: true },
      surveys: { view: true, create: true, edit: true, delete: false },
      messaging: { view: true, create: true, edit: true, delete: false },
      forms: { view: true, create: true, edit: true, delete: false },
      tags: { view: true, create: true, edit: true, delete: false },
      docSigning: { view: false },
      qrStudio: { view: true, create: true, edit: true, delete: false },
      verifyStudio: { view: true, create: true, edit: true, delete: false },
      socialIntelligence: { view: true, create: true, edit: true, delete: true },
    },
  };
  return blank;
}

/**
 * Returns a template schema for Operations Managers.
 */
export function getOperationsPermissions(): PermissionsSchema {
  const blank = getBlankPermissions();
  blank.operations = {
    enabled: true,
    features: {
      dashboard: { view: true },
      campuses: { view: true, create: true, edit: true, delete: false },
      pipeline: { view: true, create: true, edit: true, delete: false },
      tasks: { view: true, create: true, edit: true, delete: false },
      meetings: { view: true, create: true, edit: true, delete: false },
      automations: { view: false },
      intelligence: { view: true },
      quickNotes: { view: true, create: true, edit: true, delete: false },
    },
  };
  return blank;
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
  quick_notes: { section: 'operations', feature: 'quickNotes' },
  portals: { section: 'studios', feature: 'publicPortals' },
  media: { section: 'studios', feature: 'media' },
  surveys: { section: 'studios', feature: 'surveys' },
  pdfs: { section: 'studios', feature: 'docSigning' },
  messaging: { section: 'studios', feature: 'messaging' },
  tags: { section: 'studios', feature: 'tags' },
  forms: { section: 'studios', feature: 'forms' },
  qr_studio: { section: 'studios', feature: 'qrStudio' },
  verify_studio: { section: 'studios', feature: 'verifyStudio' },
  social_intelligence: { section: 'studios', feature: 'socialIntelligence' },
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

/**
 * Normalizes an unknown or partial schema into a valid, strictly typed PermissionsSchema.
 * Fills any missing sections or features with safe default false flags.
 * Guarantees deep isolation, memory safety, and backward compatibility.
 *
 * Caution: Never mutate inputs directly. Always produces a clean, new PermissionsSchema instance.
 */
export function normalizePermissionsSchema(raw: unknown): PermissionsSchema {
  const base = getBlankPermissions();
  if (!raw || typeof raw !== 'object') {
    return base;
  }

  const rawObj = raw as Record<string, unknown>;
  const sections: (keyof PermissionsSchema)[] = ['operations', 'finance', 'studios', 'management'];

  for (const sectionKey of sections) {
    const rawSection = rawObj[sectionKey];
    if (rawSection && typeof rawSection === 'object') {
      const secObj = rawSection as Record<string, unknown>;
      base[sectionKey].enabled = Boolean(secObj.enabled);

      if (secObj.features && typeof secObj.features === 'object') {
        const rawFeatures = secObj.features as Record<string, unknown>;
        for (const [featKey, featVal] of Object.entries(rawFeatures)) {
          if (featVal && typeof featVal === 'object') {
            const fObj = featVal as Record<string, unknown>;
            base[sectionKey].features[featKey] = {
              view: Boolean(fObj.view),
              ...(fObj.create !== undefined ? { create: Boolean(fObj.create) } : {}),
              ...(fObj.edit !== undefined ? { edit: Boolean(fObj.edit) } : {}),
              ...(fObj.delete !== undefined ? { delete: Boolean(fObj.delete) } : {}),
            };
          }
        }
      }
    }
  }

  return base;
}

/**
 * Flattens a hierarchical PermissionsSchema into a legacy string permission array.
 * Guarantees backward compatibility for components and Firestore rules expecting flat AppPermissionId[].
 */
export function flattenPermissionsSchema(schema: PermissionsSchema): string[] {
  const perms = new Set<string>();
  const normalized = normalizePermissionsSchema(schema);

  // Operations
  if (normalized.operations.enabled) {
    const ops = normalized.operations.features;
    if (ops.campuses?.view) perms.add('schools_view');
    if (ops.campuses?.edit || ops.campuses?.create || ops.campuses?.delete) perms.add('schools_edit');
    if (ops.pipeline?.view) perms.add('prospects_view');
    if (ops.tasks?.view) perms.add('tasks_view');
    if (ops.tasks?.create || ops.tasks?.edit || ops.tasks?.delete) perms.add('tasks_manage');
    if (ops.meetings?.view) perms.add('meetings_view');
    if (ops.meetings?.create || ops.meetings?.edit || ops.meetings?.delete) perms.add('meetings_manage');
    if (ops.dashboard?.view) perms.add('dashboard_view');
    if (ops.dashboard?.edit) perms.add('dashboard_manage');
  }

  // Finance
  if (normalized.finance.enabled) {
    const fin = normalized.finance.features;
    if (Object.values(fin).some(f => f.view)) perms.add('finance_view');
    if (Object.values(fin).some(f => f.create || f.edit || f.delete)) perms.add('finance_manage');
    if (fin.agreements?.delete) perms.add('contracts_delete');
  }

  // Studios
  if (normalized.studios.enabled) {
    const std = normalized.studios.features;
    if (Object.values(std).some(f => f.view)) perms.add('studios_view');
    if (Object.values(std).some(f => f.create || f.edit || f.delete)) perms.add('studios_edit');
    if (std.forms?.create || std.forms?.edit || std.forms?.delete) perms.add('forms_manage');
    if (std.tags?.view) perms.add('tags_view');
    if (std.tags?.create || std.tags?.edit || std.tags?.delete) perms.add('tags_manage');
  }

  // Management
  if (normalized.management.enabled) {
    const mgt = normalized.management.features;
    if (mgt.activities?.view) perms.add('activities_view');
    if (mgt.users?.view) perms.add('users_view');
    if (mgt.users?.create || mgt.users?.edit || mgt.users?.delete) perms.add('users_manage');
    if (mgt.fields?.view) perms.add('fields_view');
    if (mgt.fields?.create || mgt.fields?.edit || mgt.fields?.delete) perms.add('fields_manage');
  }

  return Array.from(perms);
}

/**
 * Migrates a legacy flat array of permission strings into a normalized PermissionsSchema.
 * Preserves legacy role authorizations when upgrading or editing existing roles.
 */
export function migrateToPermissionsSchema(legacyPermissions: string[]): PermissionsSchema {
  const schema = getBlankPermissions();
  if (!Array.isArray(legacyPermissions) || legacyPermissions.length === 0) {
    return schema;
  }

  const perms = new Set(legacyPermissions);

  // Operations
  if (perms.has('schools_view') || perms.has('schools_edit')) {
    schema.operations.enabled = true;
    schema.operations.features.campuses = {
      view: true,
      create: perms.has('schools_edit'),
      edit: perms.has('schools_edit'),
      delete: false,
    };
  }
  if (perms.has('prospects_view')) {
    schema.operations.enabled = true;
    schema.operations.features.pipeline = { view: true, create: true, edit: true, delete: false };
  }
  if (perms.has('tasks_view') || perms.has('tasks_manage')) {
    schema.operations.enabled = true;
    schema.operations.features.tasks = {
      view: true,
      create: perms.has('tasks_manage'),
      edit: perms.has('tasks_manage'),
      delete: false,
    };
  }
  if (perms.has('meetings_view') || perms.has('meetings_manage')) {
    schema.operations.enabled = true;
    schema.operations.features.meetings = {
      view: true,
      create: perms.has('meetings_manage'),
      edit: perms.has('meetings_manage'),
      delete: false,
    };
  }
  if (perms.has('dashboard_view') || perms.has('dashboard_manage')) {
    schema.operations.enabled = true;
    schema.operations.features.dashboard = { view: true, edit: perms.has('dashboard_manage') };
  }

  // Finance
  if (perms.has('finance_view') || perms.has('finance_manage') || perms.has('contracts_delete')) {
    schema.finance.enabled = true;
    const canManage = perms.has('finance_manage');
    const canDeleteContracts = perms.has('contracts_delete');

    schema.finance.features.agreements = { view: true, create: canManage, edit: canManage, delete: canDeleteContracts };
    schema.finance.features.invoices = { view: true, create: canManage, edit: canManage, delete: canManage };
    schema.finance.features.packages = { view: true, create: canManage, edit: canManage, delete: canManage };
    schema.finance.features.cycles = { view: true, create: canManage, edit: canManage, delete: canManage };
    schema.finance.features.billingSetup = { view: true, create: canManage, edit: canManage, delete: false };
  }

  // Studios
  if (perms.has('studios_view') || perms.has('studios_edit') || perms.has('forms_manage') || perms.has('tags_view') || perms.has('tags_manage')) {
    schema.studios.enabled = true;
    const canEditStudios = perms.has('studios_edit');

    schema.studios.features.publicPortals = { view: true, create: canEditStudios, edit: canEditStudios, delete: false };
    schema.studios.features.landingPages = { view: true, create: canEditStudios, edit: canEditStudios, delete: false };
    schema.studios.features.media = { view: true, create: canEditStudios, edit: canEditStudios, delete: false };
    schema.studios.features.surveys = { view: true, create: canEditStudios, edit: canEditStudios, delete: false };
    schema.studios.features.messaging = { view: true, create: canEditStudios, edit: canEditStudios, delete: false };
    schema.studios.features.qrStudio = { view: true, create: canEditStudios, edit: canEditStudios, delete: false };
    schema.studios.features.verifyStudio = { view: true, create: canEditStudios, edit: canEditStudios, delete: false };
    schema.studios.features.socialIntelligence = { view: true, create: canEditStudios, edit: canEditStudios, delete: false };

    if (perms.has('forms_manage')) {
      schema.studios.features.forms = { view: true, create: true, edit: true, delete: false };
    }
    if (perms.has('tags_view') || perms.has('tags_manage')) {
      schema.studios.features.tags = { view: true, create: perms.has('tags_manage'), edit: perms.has('tags_manage'), delete: false };
    }
  }

  // Management
  if (perms.has('activities_view')) {
    schema.management.enabled = true;
    schema.management.features.activities = { view: true };
  }
  if (perms.has('users_view') || perms.has('users_manage') || perms.has('management_users')) {
    schema.management.enabled = true;
    const canManageUsers = perms.has('users_manage') || perms.has('management_users');
    schema.management.features.users = {
      view: true,
      create: canManageUsers,
      edit: canManageUsers,
      delete: canManageUsers,
    };
  }
  if (perms.has('fields_view') || perms.has('fields_manage')) {
    schema.management.enabled = true;
    schema.management.features.fields = {
      view: true,
      create: perms.has('fields_manage'),
      edit: perms.has('fields_manage'),
      delete: false,
    };
  }

  return normalizePermissionsSchema(schema);
}
