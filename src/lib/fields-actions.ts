'use server';

import { adminDb } from './firebase-admin';
import type { AppField, FieldGroup, IndustryVertical, Workspace, UserProfile } from './types';
import { INDUSTRY_FIELD_REGISTRY, PLATFORM_FIELD_GROUPS, resolveGroupIcon } from './industry-field-registry';
import { STATIC_VARIABLES } from './template-variable-registry-data';
import { revalidatePath } from 'next/cache';
import { canUser } from './workspace-permissions';

/**
 * @fileOverview Server-side actions for the Fields & Variables Manager.
 * Handles CRUD operations for workspace-scoped AppFields, seeding native fields,
 * and migrating legacy messaging_variables into the new app_fields collection.
 */

const REVALIDATION_PATH = '/admin/settings/fields';

// ─────────────────────────────────────────────────────────────────────────────
// Field Group Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a new field group.
 */
export async function createFieldGroupAction(data: Omit<FieldGroup, 'id' | 'createdAt' | 'updatedAt' | 'slug' | 'isSystem' | 'order'>, userId: string) {
  try {
    const permission = await canUser(userId, 'management', 'fields', 'create', data.workspaceId);
    if (!permission.granted) return { success: false, error: permission.reason };

    const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
    
    // Get max order
    const groupsSnap = await adminDb.collection('field_groups').where('workspaceId', '==', data.workspaceId).get();
    const order = groupsSnap.size * 10;

    const ref = adminDb.collection('field_groups').doc();
    const now = new Date().toISOString();
    
    const newGroup: FieldGroup = {
      ...data,
      id: ref.id,
      slug,
      isSystem: false,
      order,
      icon: data.icon || resolveGroupIcon(data.name),
      createdAt: now,
      updatedAt: now,
    };

    await ref.set(newGroup);
    revalidatePath(REVALIDATION_PATH);
    return { success: true, id: ref.id, group: newGroup };
  } catch (error: any) {
    console.error('>>> [FIELDS] Create Group Failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Updates an existing field group.
 */
export async function updateFieldGroupAction(id: string, data: Partial<FieldGroup>, userId: string) {
  try {
    const ref = adminDb.collection('field_groups').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return { success: false, error: 'Group not found.' };

    const existing = snap.data() as FieldGroup;
    const permission = await canUser(userId, 'management', 'fields', 'edit', existing.workspaceId);
    if (!permission.granted) return { success: false, error: permission.reason };

    // Prevent editing system attributes for system groups
    if (existing.isSystem) {
      delete data.isSystem;
      delete data.slug;
    }

    await ref.update({
      ...data,
      updatedAt: new Date().toISOString(),
    });

    revalidatePath(REVALIDATION_PATH);
    return { success: true };
  } catch (error: any) {
    console.error('>>> [FIELDS] Update Group Failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Deletes a field group (if custom) and moves orphaned fields.
 */
export async function deleteFieldGroupAction(id: string, userId: string) {
  try {
    const ref = adminDb.collection('field_groups').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return { success: false, error: 'Group not found.' };

    const group = snap.data() as FieldGroup;
    if (group.isSystem) return { success: false, error: 'System groups cannot be deleted.' };

    const permission = await canUser(userId, 'management', 'fields', 'delete', group.workspaceId);
    if (!permission.granted) return { success: false, error: permission.reason };

    const batch = adminDb.batch();

    // Find a fallback group (first system group, or just remove groupId)
    const systemGroupsSnap = await adminDb.collection('field_groups')
      .where('workspaceId', '==', group.workspaceId)
      .where('isSystem', '==', true)
      .limit(1).get();
      
    const fallbackGroupId = systemGroupsSnap.empty ? null : systemGroupsSnap.docs[0].id;

    // Move fields
    const fieldsSnap = await adminDb.collection('app_fields')
      .where('groupId', '==', id)
      .get();

    fieldsSnap.docs.forEach(doc => {
      batch.update(doc.ref, { groupId: fallbackGroupId, updatedAt: new Date().toISOString() });
    });

    batch.delete(ref);
    await batch.commit();

    revalidatePath(REVALIDATION_PATH);
    return { success: true };
  } catch (error: any) {
    console.error('>>> [FIELDS] Delete Group Failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Reorders field groups.
 */
export async function reorderFieldGroupsAction(updates: { id: string; order: number }[], workspaceId: string, userId: string) {
  try {
    const permission = await canUser(userId, 'management', 'fields', 'edit', workspaceId);
    if (!permission.granted) return { success: false, error: permission.reason };

    const batch = adminDb.batch();
    const now = new Date().toISOString();

    for (const update of updates) {
      batch.update(adminDb.collection('field_groups').doc(update.id), { 
        order: update.order, 
        updatedAt: now 
      });
    }

    await batch.commit();
    revalidatePath(REVALIDATION_PATH);
    return { success: true };
  } catch (error: any) {
    console.error('>>> [FIELDS] Reorder Groups Failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Moves a field to a new group.
 */
export async function moveFieldToGroupAction(fieldId: string, targetGroupId: string, workspaceId: string, userId: string) {
  try {
    const permission = await canUser(userId, 'management', 'fields', 'edit', workspaceId);
    if (!permission.granted) return { success: false, error: permission.reason };

    await adminDb.collection('app_fields').doc(fieldId).update({
      groupId: targetGroupId,
      updatedAt: new Date().toISOString()
    });

    revalidatePath(REVALIDATION_PATH);
    return { success: true };
  } catch (error: any) {
    console.error('>>> [FIELDS] Move Field Failed:', error.message);
    return { success: false, error: error.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// App Field Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a new custom field in the app_fields collection.
 */
export async function createFieldAction(data: Omit<AppField, 'id' | 'createdAt' | 'updatedAt'>, userId: string) {
  try {
    // 0. Permission Check
    const permission = await canUser(userId, 'management', 'fields', 'create', data.workspaceId);
    if (!permission.granted) {
      return { success: false, error: permission.reason };
    }

    // Validate unique variableName within workspace
    const existing = await adminDb
      .collection('app_fields')
      .where('workspaceId', '==', data.workspaceId)
      .where('variableName', '==', data.variableName)
      .limit(1)
      .get();

    if (!existing.empty) {
      return { success: false, error: `A field with variable name "${data.variableName}" already exists in this workspace.` };
    }

    const now = new Date().toISOString();
    const ref = adminDb.collection('app_fields').doc();
    await ref.set({
      ...data,
      createdAt: now,
      updatedAt: now,
    });

    revalidatePath(REVALIDATION_PATH);
    return { success: true, id: ref.id };
  } catch (error: any) {
    console.error('>>> [FIELDS] Create Failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Updates an existing field. Native fields can only have limited updates (label, helpText, status).
 */
export async function updateFieldAction(id: string, data: Partial<AppField>, userId: string) {
  try {
    const ref = adminDb.collection('app_fields').doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return { success: false, error: 'Field not found.' };
    }
    const existing = snap.data() as AppField;

    // 0. Permission Check
    const permission = await canUser(userId, 'management', 'fields', 'edit', existing.workspaceId);
    if (!permission.granted) {
      return { success: false, error: permission.reason };
    }

    // If native, restrict editable fields
    if (existing.isNative) {
      const allowed: Partial<AppField> = {};
      if (data.label !== undefined) allowed.label = data.label;
      if (data.helpText !== undefined) allowed.helpText = data.helpText;
      if (data.status !== undefined) allowed.status = data.status;
      if (data.placeholder !== undefined) allowed.placeholder = data.placeholder;
      data = allowed;
    }

    // If variableName changed (custom field only), validate uniqueness
    if (data.variableName && data.variableName !== existing.variableName) {
      const dup = await adminDb
        .collection('app_fields')
        .where('workspaceId', '==', existing.workspaceId)
        .where('variableName', '==', data.variableName)
        .limit(1)
        .get();
      if (!dup.empty) {
        return { success: false, error: `Variable name "${data.variableName}" is already in use.` };
      }
    }

    await ref.update({
      ...data,
      updatedAt: new Date().toISOString(),
    });

    revalidatePath(REVALIDATION_PATH);
    return { success: true };
  } catch (error: any) {
    console.error('>>> [FIELDS] Update Failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Deletes a custom field. Native fields cannot be deleted.
 */
export async function deleteFieldAction(id: string, userId: string) {
  try {
    const ref = adminDb.collection('app_fields').doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return { success: false, error: 'Field not found.' };
    }

    const field = snap.data() as AppField;
    
    // 0. Permission Check
    const permission = await canUser(userId, 'management', 'fields', 'delete', field.workspaceId);
    if (!permission.granted) {
      return { success: false, error: permission.reason };
    }
    if (field.isNative) {
      return { success: false, error: 'Native fields cannot be deleted. You can deactivate them instead.' };
    }

    await ref.delete();
    revalidatePath(REVALIDATION_PATH);
    return { success: true };
  } catch (error: any) {
    console.error('>>> [FIELDS] Delete Failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Seeds native fields for a workspace based on its industry.
 * Also seeds platform-scoped field groups (entity identity, meetings, forms,
 * surveys, agreements, entity lifecycle, messaging) for EVERY workspace.
 * Idempotent — skips fields/groups that already exist.
 */
export async function seedNativeFieldsAction(workspaceId: string, organizationId: string, userId: string) {
  try {
    // 0. Permission Check (SuperAdmin only)
    const userSnap = await adminDb.collection('users').doc(userId).get();
    const user = userSnap.data() as UserProfile;
    if (!user?.permissions?.includes('system_admin')) {
      throw new Error("Unauthorized: Only superadmins can seed native registries.");
    }
    // 1. Fetch Workspace to get Industry
    const wsSnap = await adminDb.collection('workspaces').doc(workspaceId).get();
    if (!wsSnap.exists) throw new Error("Workspace not found");
    const workspace = wsSnap.data() as Workspace;
    
    // Default to SchoolEnrollment if no industry is set to maintain backwards compatibility
    const industry: IndustryVertical = workspace.industry || 'SchoolEnrollment';
    
    const industryConfig = INDUSTRY_FIELD_REGISTRY[industry];
    if (!industryConfig) {
      throw new Error(`No field registry configuration found for industry: ${industry}`);
    }

    const now = new Date().toISOString();
    let seededGroups = 0;
    let seededFields = 0;

    // 2. Fetch existing groups and fields
    const groupsSnap = await adminDb.collection('field_groups').where('workspaceId', '==', workspaceId).get();
    const existingGroupSlugs = new Map(groupsSnap.docs.map(d => [(d.data() as FieldGroup).slug, d.id]));

    const fieldsSnap = await adminDb.collection('app_fields').where('workspaceId', '==', workspaceId).get();
    const existingFieldVars = new Set(fieldsSnap.docs.map(d => (d.data() as AppField).variableName));

    // 3. Combine platform groups + industry groups
    const allGroups: import('./industry-field-registry').IndustryGroupDef[] = [
      ...PLATFORM_FIELD_GROUPS,
      ...industryConfig,
    ];

    // Firestore batches have a 500-op limit; use multiple batches if needed
    let batch = adminDb.batch();
    let opsInBatch = 0;

    for (const groupDef of allGroups) {
      let groupId = existingGroupSlugs.get(groupDef.slug);
      
      // Create group if it doesn't exist
      if (!groupId) {
        const groupRef = adminDb.collection('field_groups').doc();
        groupId = groupRef.id;
        
        // Determine if this is a platform group or industry group
        const isPlatform = PLATFORM_FIELD_GROUPS.some(g => g.slug === groupDef.slug);
        
        const newGroup: Record<string, any> = {
          id: groupId,
          workspaceId,
          organizationId,
          name: groupDef.name,
          slug: groupDef.slug,
          description: groupDef.description,
          icon: resolveGroupIcon(groupDef.name),
          color: isPlatform ? '#6366f1' : '#3b82f6', // Indigo for platform, Blue for industry
          entityTypes: groupDef.entityTypes,
          industry: isPlatform ? 'platform' : industry,
          isSystem: true,
          order: groupDef.order,
          createdAt: now,
          updatedAt: now,
        };
        
        batch.set(groupRef, newGroup);
        existingGroupSlugs.set(groupDef.slug, groupId);
        seededGroups++;
        opsInBatch++;
      }

      // Process fields within this group
      for (const fieldDef of groupDef.fields) {
        if (!existingFieldVars.has(fieldDef.variableName)) {
          const fieldRef = adminDb.collection('app_fields').doc();
          const isPlatform = PLATFORM_FIELD_GROUPS.some(g => g.slug === groupDef.slug);
          
          const newField: Record<string, any> = {
            id: fieldRef.id,
            workspaceId,
            organizationId,
            name: fieldDef.name,
            label: fieldDef.name,
            variableName: fieldDef.variableName,
            type: fieldDef.type,
            groupId: groupId,
            section: groupDef.slug,
            industryOrigin: isPlatform ? 'platform' : industry,
            isNative: true,
            compatibilityScope: fieldDef.compatibilityScope,
            status: 'active',
            createdAt: now,
            updatedAt: now,
          };

          // Only set optional fields if they are defined (Firestore rejects undefined)
          if (fieldDef.helpText !== undefined) newField.helpText = fieldDef.helpText;
          if (fieldDef.placeholder !== undefined) newField.placeholder = fieldDef.placeholder;
          if (fieldDef.defaultValue !== undefined) newField.defaultValue = fieldDef.defaultValue;
          if (fieldDef.options !== undefined) newField.options = fieldDef.options;
          if (fieldDef.validationRules !== undefined) newField.validationRules = fieldDef.validationRules;
          
          batch.set(fieldRef, newField);
          existingFieldVars.add(fieldDef.variableName);
          seededFields++;
          opsInBatch++;

          // Commit batch if approaching limit
          if (opsInBatch >= 450) {
            await batch.commit();
            batch = adminDb.batch();
            opsInBatch = 0;
          }
        }
      }
    }

    if (opsInBatch > 0) {
      await batch.commit();
    }

    revalidatePath(REVALIDATION_PATH);
    return { success: true, seededGroups, seededFields };
  } catch (error: any) {
    console.error('>>> [FIELDS] Seed Failed:', error.message);
    return { success: false, error: error.message };
  }

}

/**
 * Fetches all field groups for a workspace with field counts.
 */
export async function getFieldGroupsForWorkspace(workspaceId: string): Promise<{ success: boolean; groups?: FieldGroup[]; error?: string }> {
  try {
    const snap = await adminDb
      .collection('field_groups')
      .where('workspaceId', '==', workspaceId)
      .orderBy('order', 'asc')
      .get();

    const groups = snap.docs.map(d => d.data() as FieldGroup);
    return { success: true, groups };
  } catch (error: any) {
    console.error('>>> [FIELDS] Fetch Groups Failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Fetches all fields for a workspace.
 */
export async function getFieldsForWorkspace(workspaceId: string): Promise<{ success: boolean; fields?: AppField[]; error?: string }> {
  try {
    const snap = await adminDb
      .collection('app_fields')
      .where('workspaceId', '==', workspaceId)
      .orderBy('section', 'asc')
      .get();

    const fields = snap.docs.map(d => ({ id: d.id, ...d.data() } as AppField));
    return { success: true, fields };
  } catch (error: any) {
    console.error('>>> [FIELDS] Fetch Failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Gets all template variables available for a workspace.
 * Combines static platform variables with dynamic app_fields.
 */
export async function getWorkspaceVariablesAction(workspaceId: string): Promise<{
  success: boolean;
  variables?: any[];
  error?: string;
}> {
  try {
    // 1. Fetch dynamic fields
    const fieldsSnap = await adminDb
      .collection('app_fields')
      .where('workspaceId', '==', workspaceId)
      .where('status', '==', 'active')
      .get();

    const dynamicVars = fieldsSnap.docs.map(doc => {
      const field = doc.data() as AppField;
      return {
        id: field.id,
        name: field.variableName,
        label: field.label,
        description: field.helpText || `Dynamic ${field.industryOrigin || ''} field`,
        dataType: mapFieldToVariableType(field.type),
        context: 'common',
        exampleValue: field.defaultValue,
        isDynamic: true,
        isComputed: false,
      };
    });

    // 2. Combine with Static Variables
    const allVariables = [...STATIC_VARIABLES, ...dynamicVars];

    return { success: true, variables: allVariables };
  } catch (error: any) {
    console.error('>>> [FIELDS] Get Variables Failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Maps AppField types to TemplateVariable data types.
 */
function mapFieldToVariableType(fieldType: string): string {
  switch (fieldType) {
    case 'number': return 'number';
    case 'currency': return 'currency';
    case 'date':
    case 'datetime': return 'date';
    case 'url': return 'url';
    case 'address': return 'address';
    case 'yes_no':
    case 'checkbox': return 'boolean';
    default: return 'string';
  }
}
