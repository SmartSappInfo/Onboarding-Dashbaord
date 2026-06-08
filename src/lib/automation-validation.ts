import { adminDb } from './firebase-admin';
import type { Automation } from './types';
import { AutomationValidationError } from './automations/errors';
import { documentsExist } from './automations/repository';

type BlueprintNode = {
  id: string;
  type: string;
  data?: Record<string, unknown>;
};

function nodeLabel(node: BlueprintNode): string {
  const label = node.data?.label;
  return typeof label === 'string' && label ? label : node.id;
}

/**
 * Save-time validation for automation blueprints (actions, logic nodes, templates).
 */
export async function validateAutomationBlueprint(automation: Partial<Automation>): Promise<void> {
  if (!automation.nodes?.length) return;

  if (!automation.triggers?.length) {
    throw new AutomationValidationError(
      'At least one trigger must be configured before saving.'
    );
  }

  const nodes = automation.nodes as BlueprintNode[];
  const actionNodes = nodes.filter((n) => n.type === 'actionNode');

  validateLogicNodes(nodes);
  validateActionNodeConfigs(actionNodes);
  await validateAutomationTemplatesBatch(actionNodes);
  await validateExternalReferencesBatch(actionNodes);
}

function validateLogicNodes(nodes: BlueprintNode[]): void {
  for (const node of nodes) {
    switch (node.type) {
      case 'conditionNode': {
        const config = (node.data?.config || {}) as Record<string, unknown>;
        if (!config.field || !config.operator) {
          throw new AutomationValidationError(
            `Condition node "${nodeLabel(node)}" requires a payload field and operator.`
          );
        }
        break;
      }
      case 'delayNode': {
        const config = (node.data?.config || {}) as { value?: number; unit?: string };
        if (!config.value || config.value < 1) {
          throw new AutomationValidationError(
            `Delay node "${nodeLabel(node)}" requires a wait amount of at least 1.`
          );
        }
        if (!config.unit) {
          throw new AutomationValidationError(
            `Delay node "${nodeLabel(node)}" requires a time unit.`
          );
        }
        break;
      }
      case 'tagConditionNode': {
        if (!node.data?.logic) {
          throw new AutomationValidationError(
            `Tag condition "${nodeLabel(node)}" requires a logic mode.`
          );
        }
        const tagIds = node.data?.tagIds as string[] | undefined;
        if (!tagIds?.length) {
          throw new AutomationValidationError(
            `Tag condition "${nodeLabel(node)}" requires at least one tag.`
          );
        }
        break;
      }
      case 'tagActionNode': {
        if (!node.data?.action) {
          throw new AutomationValidationError(
            `Tag action "${nodeLabel(node)}" requires add or remove mode.`
          );
        }
        const tagIds = node.data?.tagIds as string[] | undefined;
        if (!tagIds?.length) {
          throw new AutomationValidationError(
            `Tag action "${nodeLabel(node)}" requires at least one tag.`
          );
        }
        break;
      }
      default:
        break;
    }
  }
}

function validateActionNodeConfigs(actionNodes: BlueprintNode[]): void {
  for (const node of actionNodes) {
    const actionType = node.data?.actionType as string | undefined;
    const config = (node.data?.config || {}) as Record<string, unknown>;
    const label = nodeLabel(node);

    if (!actionType) {
      throw new AutomationValidationError(`Action node "${label}" is missing an action type.`);
    }

    switch (actionType) {
      case 'SEND_MESSAGE':
        // Skip template check if recipientTargets is set and doesn't require templates, but keep it for backward compatibility
        const recTargets = config.recipientTargets as string[] | undefined;
        if (!config.templateId && (!config.templateCategory || !config.templateType) && (!recTargets || recTargets.length === 0)) {
          throw new AutomationValidationError(
            `Send message in "${label}" must specify templateId or templateCategory + templateType.`
          );
        }
        break;
      case 'SEND_NOTIFICATION_EMAIL':
      case 'SEND_NOTIFICATION_SMS':
      case 'SEND_NOTIFICATION_IN_APP':
      case 'SEND_NOTIFICATION_PUSH': {
        const targets = config.notificationTargets as string[] | undefined;
        if (!targets || targets.length === 0) {
          throw new AutomationValidationError(
            `Notification action "${label}" requires at least one target destination selected.`
          );
        }
        if (targets.includes('users') && (!config.notificationUserIds || (config.notificationUserIds as string[]).length === 0)) {
          throw new AutomationValidationError(
            `Notification action "${label}" has "Selected Team Members" target active but no users are selected.`
          );
        }
        if (targets.includes('custom') && !config.customRecipient) {
          throw new AutomationValidationError(
            `Notification action "${label}" has "Custom Destination Address" active but no custom recipient value is set.`
          );
        }
        if (!config.templateId) {
          throw new AutomationValidationError(
            `Notification action "${label}" requires a notification template to be selected.`
          );
        }
        break;
      }
      case 'CREATE_TASK':
        if (!config.title || typeof config.title !== 'string') {
          throw new AutomationValidationError(`Create task in "${label}" requires a title.`);
        }
        break;
      case 'ADD_NOTE':
        if (!config.content || typeof config.content !== 'string') {
          throw new AutomationValidationError(`Add note in "${label}" requires note content.`);
        }
        break;
      case 'ASSIGN_ENTITY':
        if (!config.assignedTo) {
          throw new AutomationValidationError(
            `Assign entity in "${label}" requires an assignee (or "auto").`
          );
        }
        break;
      case 'UPDATE_ENTITY':
        if (
          !config.pipelineId &&
          !config.stageId &&
          !config.assignedTo &&
          !(config.updates && Object.keys(config.updates as object).length)
        ) {
          throw new AutomationValidationError(
            `Update entity in "${label}" requires at least one field to change.`
          );
        }
        break;
      case 'TRIGGER_OUTBOUND_WEBHOOK':
        if (!config.webhookId) {
          throw new AutomationValidationError(`Webhook action in "${label}" requires a webhook ID.`);
        }
        break;
      case 'RUN_AUTOMATION':
        if (!config.automationId) {
          throw new AutomationValidationError(
            `Run automation in "${label}" requires a target automation ID.`
          );
        }
        break;
      case 'UPDATE_TASK':
        if (!config.taskId && !config.useTriggerTaskId) {
          throw new AutomationValidationError(
            `Update task in "${label}" requires taskId or useTriggerTaskId flag.`
          );
        }
        break;
      case 'END_AUTOMATION':
        // No validation configuration is required for terminal node. Safe pass.
        break;
      default:
        break;
    }
  }
}

/** Batch existence checks — avoids N+1 per action node. */
async function validateExternalReferencesBatch(actionNodes: BlueprintNode[]): Promise<void> {
  const webhookChecks: { id: string; label: string }[] = [];
  const automationChecks: { id: string; label: string }[] = [];

  for (const node of actionNodes) {
    const actionType = node.data?.actionType;
    const config = (node.data?.config || {}) as Record<string, unknown>;
    const label = nodeLabel(node);

    if (actionType === 'TRIGGER_OUTBOUND_WEBHOOK' && config.webhookId) {
      webhookChecks.push({ id: String(config.webhookId), label });
    }
    if (actionType === 'RUN_AUTOMATION' && config.automationId) {
      automationChecks.push({ id: String(config.automationId), label });
    }
  }

  if (webhookChecks.length) {
    const existing = await documentsExist(
      'webhooks',
      webhookChecks.map((w) => w.id)
    );
    for (const { id, label } of webhookChecks) {
      if (!existing.has(id)) {
        throw new AutomationValidationError(`Webhook "${id}" not found (node "${label}").`);
      }
    }
  }

  if (automationChecks.length) {
    const existing = await documentsExist(
      'automations',
      automationChecks.map((a) => a.id)
    );
    for (const { id, label } of automationChecks) {
      if (!existing.has(id)) {
        throw new AutomationValidationError(`Automation "${id}" not found (node "${label}").`);
      }
    }
  }
}

async function validateAutomationTemplatesBatch(actionNodes: BlueprintNode[]): Promise<void> {
  const templateIds: { id: string; label: string }[] = [];
  const categoryPairs: {
    category: string;
    type: string;
    label: string;
  }[] = [];

  const TEMPLATE_DRIVEN_ACTIONS = new Set([
    'SEND_MESSAGE',
    'SEND_NOTIFICATION_EMAIL',
    'SEND_NOTIFICATION_SMS',
    'SEND_NOTIFICATION_IN_APP',
    'SEND_NOTIFICATION_PUSH',
  ]);

  for (const node of actionNodes) {
    if (!TEMPLATE_DRIVEN_ACTIONS.has(node.data?.actionType as string)) continue;
    const config = (node.data?.config || {}) as Record<string, unknown>;
    const label = nodeLabel(node);

    if (config.templateId) {
      templateIds.push({ id: String(config.templateId), label });
    }
    if (config.templateCategory && config.templateType) {
      categoryPairs.push({
        category: String(config.templateCategory),
        type: String(config.templateType),
        label,
      });
    }
  }

  if (templateIds.length) {
    const ids = templateIds.map((t) => t.id);
    const existing = await documentsExist('message_templates', ids);

    for (const { id, label } of templateIds) {
      if (!existing.has(id)) {
        throw new AutomationValidationError(`Template ${id} not found in node "${label}"`);
      }
    }

    const refs = ids.map((id) => adminDb.collection('message_templates').doc(id));
    const snaps = await adminDb.getAll(...refs);
    const snapById = new Map(snaps.map((s) => [s.id, s]));

    for (const { id, label } of templateIds) {
      const template = snapById.get(id)?.data();
      if (template?.status !== 'active') {
        throw new AutomationValidationError(
          `Template "${template?.name || id}" is not active in node "${label}"`
        );
      }
    }
  }

  const checkedPairs = new Set<string>();
  for (const pair of categoryPairs) {
    const key = `${pair.category}:${pair.type}`;
    if (checkedPairs.has(key)) continue;
    checkedPairs.add(key);

    const templatesSnap = await adminDb
      .collection('message_templates')
      .where('category', '==', pair.category)
      .where('templateType', '==', pair.type)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    if (templatesSnap.empty) {
      throw new AutomationValidationError(
        `No active template for category "${pair.category}" / type "${pair.type}" in node "${pair.label}"`
      );
    }
  }
}
