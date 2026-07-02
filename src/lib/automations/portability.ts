'use server';

import { adminDb } from '../firebase-admin';
import { validateAutomationBlueprint } from '../automation-validation';
import { assertAutomationManagePermission } from '../automation-permissions';
import { serializeBlueprint } from '../automation-blueprint';
import type { AutomationTrigger } from '../types';

export interface PortableTemplate {
  id: string;
  name: string;
  category: string;
  templateType: string;
  channel: string;
  subject?: string;
  body: string;
  variableContext: string;
  declaredVariables: string[];
}

export interface PortableTrigger {
  type: string;
  config: Record<string, unknown>;
}

export interface PortableNode {
  id: string;
  type: string;
  data: {
    label?: string;
    actionType?: string;
    config?: Record<string, unknown>;
    tagIds?: string[];
    [key: string]: unknown;
  };
  position?: {
    x: number;
    y: number;
  };
}

export interface PortableEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface AutomationExportEnvelope {
  format: 'minex360.automation';
  version: 1;
  exportedAt: string;
  automation: {
    name: string;
    description?: string;
    triggers: PortableTrigger[];
    nodes: PortableNode[];
    edges: PortableEdge[];
  };
  manifest: {
    templates: PortableTemplate[];
    tags: { id: string; name: string; color?: string }[];
    pipelines: { id: string; name: string; stages: { id: string; name: string }[] }[];
    webhooks: { id: string; name: string; url?: string }[];
  };
}

export interface ImportMappings {
  templates?: Record<string, string>;
  pipelines?: Record<string, string>;
  stages?: Record<string, string>;
  webhooks?: Record<string, string>;
  tags?: Record<string, string>;
}

/**
 * Builds a portable export envelope containing the stripped automation and its assets.
 */
export async function buildAutomationExport(automationId: string): Promise<AutomationExportEnvelope> {
  const doc = await adminDb.collection('automations').doc(automationId).get();
  if (!doc.exists) {
    throw new Error('Automation not found');
  }

  const auto = doc.data();
  if (!auto) {
    throw new Error('Automation document is empty');
  }

  const name = String(auto.name || 'Exported Automation');
  const description = auto.description ? String(auto.description) : undefined;
  const triggers: PortableTrigger[] = ((auto.triggers || []) as Record<string, unknown>[]).map((t) => ({
    type: String(t.type || ''),
    config: (t.config as Record<string, unknown>) || {},
  }));

  const nodes: PortableNode[] = ((auto.nodes || []) as Record<string, unknown>[]).map((n) => {
    const rawData = (n.data as Record<string, unknown>) || {};
    const portableData: PortableNode['data'] = {
      label: rawData.label ? String(rawData.label) : undefined,
      actionType: rawData.actionType ? String(rawData.actionType) : undefined,
      config: (rawData.config as Record<string, unknown>) || undefined,
    };

    if (Array.isArray(rawData.tagIds)) {
      portableData.tagIds = rawData.tagIds.map(String);
    }

    // Retain other UI-specific properties
    Object.keys(rawData).forEach((key) => {
      if (key !== 'label' && key !== 'actionType' && key !== 'config' && key !== 'tagIds') {
        portableData[key] = rawData[key];
      }
    });

    const pos = (n.position as Record<string, number>) || {};

    return {
      id: String(n.id || ''),
      type: String(n.type || ''),
      data: portableData,
      position: typeof pos.x === 'number' && typeof pos.y === 'number' ? { x: pos.x, y: pos.y } : undefined,
    };
  });

  const edges: PortableEdge[] = ((auto.edges || []) as Record<string, unknown>[]).map((e) => ({
    id: String(e.id || ''),
    source: String(e.source || ''),
    target: String(e.target || ''),
    sourceHandle: e.sourceHandle ? String(e.sourceHandle) : undefined,
    targetHandle: e.targetHandle ? String(e.targetHandle) : undefined,
  }));

  // Resolve dependencies for the manifest
  const templateIds = new Set<string>();
  const tagIds = new Set<string>();
  const pipelineIds = new Set<string>();
  const webhookIds = new Set<string>();

  // Parse nodes for references
  nodes.forEach((n) => {
    const config = n.data.config || {};
    if (config.templateId) templateIds.add(String(config.templateId));
    if (config.pipelineId) pipelineIds.add(String(config.pipelineId));
    if (config.webhookId) webhookIds.add(String(config.webhookId));
    if (n.data.tagIds) n.data.tagIds.forEach((id) => tagIds.add(id));

    // Check inside action config resend arrays and trigger config tags
    if (Array.isArray(config.tagIds)) {
      config.tagIds.forEach((id) => tagIds.add(String(id)));
    }
  });

  // Parse triggers for references
  triggers.forEach((t) => {
    if (t.config.pipelineId) pipelineIds.add(String(t.config.pipelineId));
    if (t.config.stageId) pipelineIds.add(String(t.config.pipelineId)); // Pipelines catalog
    if (Array.isArray(t.config.tagIds)) {
      t.config.tagIds.forEach((id) => tagIds.add(String(id)));
    }
  });

  // 1. Fetch referenced Templates
  const templates: PortableTemplate[] = [];
  if (templateIds.size > 0) {
    const snaps = (await adminDb
      .collection('message_templates')
      .where('__name__', 'in', Array.from(templateIds))
      .get()) as { docs: { id: string; data: () => Record<string, unknown> }[] };
    snaps.docs.forEach((docSnap) => {
      const data = docSnap.data();
      if (data) {
        templates.push({
          id: docSnap.id,
          name: String(data.name || ''),
          category: String(data.category || ''),
          templateType: String(data.templateType || ''),
          channel: String(data.channel || 'email'),
          subject: data.subject ? String(data.subject) : undefined,
          body: String(data.body || ''),
          variableContext: String(data.variableContext || 'onboarding'),
          declaredVariables: Array.isArray(data.declaredVariables) ? data.declaredVariables.map(String) : [],
        });
      }
    });
  }

  // 2. Fetch referenced Tags
  const tags: { id: string; name: string; color?: string }[] = [];
  if (tagIds.size > 0) {
    const snaps = (await adminDb
      .collection('tags')
      .where('__name__', 'in', Array.from(tagIds))
      .get()) as { docs: { id: string; data: () => Record<string, unknown> }[] };
    snaps.docs.forEach((docSnap) => {
      const data = docSnap.data();
      if (data) {
        tags.push({
          id: docSnap.id,
          name: String(data.name || ''),
          color: data.color ? String(data.color) : undefined,
        });
      }
    });
  }

  // 3. Fetch referenced Pipelines & Stages
  const pipelines: { id: string; name: string; stages: { id: string; name: string }[] }[] = [];
  if (pipelineIds.size > 0) {
    const snaps = (await adminDb
      .collection('pipelines')
      .where('__name__', 'in', Array.from(pipelineIds))
      .get()) as { docs: { id: string; data: () => Record<string, unknown> }[] };

    for (const docSnap of snaps.docs) {
      const data = docSnap.data();
      if (data) {
        const stageIds = Array.isArray(data.stageIds) ? data.stageIds.map(String) : [];
        const stages: { id: string; name: string }[] = [];

        if (stageIds.length > 0) {
          const stagesSnaps = (await adminDb
            .collection('stages')
            .where('__name__', 'in', stageIds)
            .get()) as { docs: { id: string; data: () => Record<string, unknown> }[] };
          stagesSnaps.docs.forEach((stageSnap) => {
            const sData = stageSnap.data();
            if (sData) {
              stages.push({
                id: stageSnap.id,
                name: String(sData.name || ''),
              });
            }
          });
        }

        pipelines.push({
          id: docSnap.id,
          name: String(data.name || ''),
          stages,
        });
      }
    }
  }

  // 4. Fetch referenced Webhooks
  const webhooks: { id: string; name: string; url?: string }[] = [];
  if (webhookIds.size > 0) {
    const snaps = (await adminDb
      .collection('webhooks')
      .where('__name__', 'in', Array.from(webhookIds))
      .get()) as { docs: { id: string; data: () => Record<string, unknown> }[] };
    snaps.docs.forEach((docSnap) => {
      const data = docSnap.data();
      if (data) {
        webhooks.push({
          id: docSnap.id,
          name: String(data.name || ''),
          url: data.url ? String(data.url) : undefined,
        });
      }
    });
  }

  return {
    format: 'minex360.automation',
    version: 1,
    exportedAt: new Date().toISOString(),
    automation: {
      name,
      description,
      triggers,
      nodes,
      edges,
    },
    manifest: {
      templates,
      tags,
      pipelines,
      webhooks,
    },
  };
}

/**
 * Validates, maps, and imports an automation into the target workspace.
 * Performs atomically inside a transaction/write batch.
 */
export async function importAutomationAction(
  envelope: AutomationExportEnvelope,
  mappings: ImportMappings,
  workspaceId: string,
  userId: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    // 1. Permission Validation
    await assertAutomationManagePermission(userId, [workspaceId], 'create');

    if (envelope.format !== 'minex360.automation') {
      return { success: false, error: 'Invalid file format.' };
    }
    if (envelope.version !== 1) {
      return { success: false, error: 'Unsupported file format version.' };
    }

    // Resolve target Organization context
    const workspaceDoc = await adminDb.collection('workspaces').doc(workspaceId).get();
    if (!workspaceDoc.exists) {
      return { success: false, error: 'Workspace not found.' };
    }
    const organizationId = String(workspaceDoc.data()?.organizationId || '');
    if (!organizationId) {
      return { success: false, error: 'Organization context missing in workspace.' };
    }

    const batch = adminDb.batch();
    const timestamp = new Date().toISOString();

    const finalMappings: {
      templates: Record<string, string>;
      tags: Record<string, string>;
      pipelines: Record<string, string>;
      stages: Record<string, string>;
      webhooks: Record<string, string>;
    } = {
      templates: { ...(mappings.templates || {}) },
      tags: { ...(mappings.tags || {}) },
      pipelines: { ...(mappings.pipelines || {}) },
      stages: { ...(mappings.stages || {}) },
      webhooks: { ...(mappings.webhooks || {}) },
    };

    const implicitlyExistingTemplateIds: string[] = [];

    // 2. Resolve or Re-create Templates
    const portableTemplates = envelope.manifest.templates || [];
    for (const t of portableTemplates) {
      if (finalMappings.templates[t.id]) {
        // User provided an explicit template mapping selection
        continue;
      }

      // Check if a matching template by category/type/channel already exists in destination
      const existingQuery = await adminDb
        .collection('message_templates')
        .where('scope', '==', 'organization')
        .where('organizationId', '==', organizationId)
        .where('category', '==', t.category)
        .where('templateType', '==', t.templateType)
        .where('channel', '==', t.channel)
        .limit(1)
        .get();

      if (!existingQuery.empty) {
        const matchedId = existingQuery.docs[0].id;
        finalMappings.templates[t.id] = matchedId;
      } else {
        // Recreate it as an organization-scoped template in the target
        const newTemplateRef = adminDb.collection('message_templates').doc();
        const newTemplateId = newTemplateRef.id;

        batch.set(newTemplateRef, {
          id: newTemplateId,
          scope: 'organization',
          organizationId,
          workspaceIds: [workspaceId],
          category: t.category,
          templateType: t.templateType,
          channel: t.channel,
          name: t.name,
          subject: t.subject || null,
          body: t.body,
          variableContext: t.variableContext,
          declaredVariables: t.declaredVariables,
          status: 'active',
          version: 1,
          createdAt: timestamp,
          updatedAt: timestamp,
          createdBy: userId,
        });

        finalMappings.templates[t.id] = newTemplateId;
        implicitlyExistingTemplateIds.push(newTemplateId);
      }
    }

    // 3. Resolve or Re-create Tags
    const portableTags = envelope.manifest.tags || [];
    for (const tagObj of portableTags) {
      if (finalMappings.tags[tagObj.id]) {
        continue;
      }

      // Check if a tag with matching name exists in target workspace
      const tagQuery = await adminDb
        .collection('tags')
        .where('workspaceId', '==', workspaceId)
        .where('name', '==', tagObj.name)
        .limit(1)
        .get();

      if (!tagQuery.empty) {
        finalMappings.tags[tagObj.id] = tagQuery.docs[0].id;
      } else {
        // Create the tag automatically
        const newTagRef = adminDb.collection('tags').doc();
        const newTagId = newTagRef.id;

        batch.set(newTagRef, {
          id: newTagId,
          name: tagObj.name,
          color: tagObj.color || 'blue',
          workspaceId,
          createdAt: timestamp,
          updatedAt: timestamp,
        });

        finalMappings.tags[tagObj.id] = newTagId;
      }
    }

    // 4. Map triggers configuration
    const mappedTriggers = envelope.automation.triggers.map((t, index) => {
      const config = { ...t.config };

      // Map pipeline ID
      if (config.pipelineId && typeof config.pipelineId === 'string') {
        config.pipelineId = finalMappings.pipelines[config.pipelineId] || null;
      }

      // Map stage ID
      if (config.stageId && typeof config.stageId === 'string') {
        config.stageId = finalMappings.stages[config.stageId] || null;
      }

      // Map tags IDs array
      if (Array.isArray(config.tagIds)) {
        config.tagIds = config.tagIds.map((id) => finalMappings.tags[String(id)] || id);
      }

      return {
        id: `trigger_${index}`,
        type: t.type as AutomationTrigger,
        config,
      };
    });

    // 5. Map nodes config
    const mappedNodes = envelope.automation.nodes.map((n) => {
      const data = { ...n.data };
      const config = data.config ? { ...data.config } : {};

      // Map template IDs
      if (config.templateId && typeof config.templateId === 'string') {
        config.templateId = finalMappings.templates[config.templateId] || null;
      }

      // Map pipeline IDs
      if (config.pipelineId && typeof config.pipelineId === 'string') {
        config.pipelineId = finalMappings.pipelines[config.pipelineId] || null;
      }

      // Map stage IDs
      if (config.stageId && typeof config.stageId === 'string') {
        config.stageId = finalMappings.stages[config.stageId] || null;
      }

      // Map webhook IDs
      if (config.webhookId && typeof config.webhookId === 'string') {
        config.webhookId = finalMappings.webhooks[config.webhookId] || null;
      }

      // Clear users/assignees to avoid database reference errors
      if ('assignedTo' in config) {
        config.assignedTo = 'auto';
      }
      if ('notificationUserIds' in config) {
        config.notificationUserIds = [];
      }

      // Map tags array in nodes data
      if (Array.isArray(data.tagIds)) {
        data.tagIds = data.tagIds.map((id) => finalMappings.tags[id] || id);
      }

      // Map tag arrays inside node action configs
      if (Array.isArray(config.tagIds)) {
        config.tagIds = config.tagIds.map((id) => finalMappings.tags[String(id)] || id);
      }

      return {
        ...n,
        data: {
          ...data,
          config,
        },
      };
    });

    // Strip un-mappable IDs inside nodes config (e.g. senderProfileId if not matching or defaults)
    const normalizedBlueprint = serializeBlueprint({
      name: `${envelope.automation.name} (Imported)`,
      description: envelope.automation.description || 'Imported via portability manager.',
      triggers: mappedTriggers,
      nodes: mappedNodes,
      edges: envelope.automation.edges,
      workspaceIds: [workspaceId],
      isActive: false, // Imported automations must default to false/paused
    });

    // 6. Pre-validate using extended validator logic
    await validateAutomationBlueprint(normalizedBlueprint, {
      implicitlyExistingTemplateIds,
    });

    // 7. Write the new automation document
    const newAutoRef = adminDb.collection('automations').doc();
    const newAutoId = newAutoRef.id;

    batch.set(newAutoRef, {
      ...normalizedBlueprint,
      id: newAutoId,
      workspaceIds: [workspaceId],
      createdAt: timestamp,
      updatedAt: timestamp,
      createdBy: userId,
    });

    await batch.commit();

    return { success: true, id: newAutoId };
  } catch (error: unknown) {
    const err = error as Error;
    console.error('>>> [PORTABILITY:IMPORT] FAILED:', err.message);
    return { success: false, error: err.message };
  }
}
