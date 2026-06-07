import { adminDb } from '../firebase-admin';
import { triggerAutomationProtocols } from '../automation-processor';
import { buildAutomationPayload } from '../automation-payload';
import type { Automation, AutomationTrigger } from '../types';

export async function evaluateHeartbeatTriggers() {
  try {
    const snap = await adminDb.collection('automations')
      .where('isActive', '==', true)
      .get();
    
    const automations = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Automation));

    const dateReachedAutos = automations.filter(a => a.triggerTypes?.includes('DATE_REACHED'));
    const taskOverdueAutos = automations.filter(a => a.triggerTypes?.includes('TASK_OVERDUE'));
    const inactiveAutos = automations.filter(a => a.triggerTypes?.includes('ENTITY_INACTIVE'));


    if (dateReachedAutos.length > 0) {
      await evaluateDateReached(dateReachedAutos);
    }
    if (taskOverdueAutos.length > 0) {
      await evaluateTaskOverdue(taskOverdueAutos);
    }
    if (inactiveAutos.length > 0) {
      await evaluateEntityInactive(inactiveAutos);
    }
  } catch (err) {
    console.error('Error in evaluateHeartbeatTriggers:', err);
  }
}

function getTriggerConfig(auto: Automation, triggerType: AutomationTrigger): Record<string, unknown> {
  // Look up the matching AutomationTriggerDef to get its isolated config
  const def = auto.triggers?.find((t) => t.type === triggerType);
  if (def?.config) return def.config;

  // Fallback to canvas triggerNode config for safety
  const triggerNode = auto.nodes?.find((n) => n.type === 'triggerNode');
  return (triggerNode?.data?.config as Record<string, unknown>) ?? {};
}

async function evaluateDateReached(automations: Automation[]) {
  const entitiesSnap = await adminDb.collection('entities').where('status', '==', 'active').get();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getNestedValue = (obj: any, path: string) => {
    if (!obj) return undefined;
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  };

  for (const entityDoc of entitiesSnap.docs) {
    const entity = entityDoc.data();
    
    for (const auto of automations) {
      const config = getTriggerConfig(auto, 'DATE_REACHED');
      const dateField = config.dateField as string | undefined;
      const offsetDays = (config.offsetDays as number | undefined) ?? 0;
      if (!dateField) continue;

      const rawVal = getNestedValue(entity, dateField);
      if (!rawVal) continue;

      const entityDate = new Date(rawVal);
      entityDate.setHours(0, 0, 0, 0);

      const diffTime = today.getTime() - entityDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === offsetDays) {
        const runIdKey = `date_reached_${auto.id}_${entity.id}_${entityDate.toISOString().split('T')[0]}`;
        const existingRun = await adminDb.collection('automation_runs')
          .where('automationId', '==', auto.id)
          .where('triggerData.runIdKey', '==', runIdKey)
          .limit(1)
          .get();

        if (existingRun.empty) {
          const workspaceId = auto.workspaceIds?.[0] || 'default';
          const payload = buildAutomationPayload({
            organizationId: entity.organizationId || '',
            workspaceId,
            entityId: entity.id,
            action: 'date_reached',
            runIdKey,
            metadata: { dateField, offsetDays, entityDate: rawVal }
          });
          await triggerAutomationProtocols('DATE_REACHED', payload);
        }
      }
    }
  }
}

async function evaluateTaskOverdue(automations: Automation[]) {
  const nowStr = new Date().toISOString();
  
  const tasksSnap = await adminDb.collectionGroup('tasks')
    .where('status', '!=', 'completed')
    .get();

  for (const taskDoc of tasksSnap.docs) {
    const task = taskDoc.data();
    if (!task.dueDate || task.dueDate >= nowStr) continue;
    if (task.overdueTriggered) continue;

    for (const auto of automations) {
      const workspaceId = auto.workspaceIds?.[0] || task.workspaceId || 'default';
      const payload = buildAutomationPayload({
        organizationId: task.organizationId || '',
        workspaceId,
        entityId: task.entityId || '',
        action: 'task_overdue',
        metadata: { taskId: taskDoc.id, taskName: task.title, dueDate: task.dueDate }
      });

      await triggerAutomationProtocols('TASK_OVERDUE', payload);
    }

    await taskDoc.ref.update({ overdueTriggered: true }).catch(() => {});
  }
}

async function evaluateEntityInactive(automations: Automation[]) {
  const entitiesSnap = await adminDb.collection('entities').where('status', '==', 'active').get();
  const now = new Date();

  for (const entityDoc of entitiesSnap.docs) {
    const entity = entityDoc.data();

    const activitySnap = await adminDb.collection('activities')
      .where('entityId', '==', entity.id)
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();

    let lastActive = new Date(entity.createdAt);
    if (!activitySnap.empty) {
      const latestAct = activitySnap.docs[0].data();
      lastActive = new Date(latestAct.timestamp);
    }

    const inactiveMs = now.getTime() - lastActive.getTime();
    const inactiveDays = Math.floor(inactiveMs / (1000 * 60 * 60 * 24));

    for (const auto of automations) {
      const config = getTriggerConfig(auto, 'ENTITY_INACTIVE');

      const targetInactivity = (config.inactivityDays as number | undefined) ?? 30;
      if (inactiveDays >= targetInactivity) {
        const runIdKey = `entity_inactive_${auto.id}_${entity.id}_${lastActive.toISOString().split('T')[0]}`;
        const existingRun = await adminDb.collection('automation_runs')
          .where('automationId', '==', auto.id)
          .where('triggerData.runIdKey', '==', runIdKey)
          .limit(1)
          .get();

        if (existingRun.empty) {
          const workspaceId = auto.workspaceIds?.[0] || 'default';
          const payload = buildAutomationPayload({
            organizationId: entity.organizationId || '',
            workspaceId,
            entityId: entity.id,
            action: 'entity_inactive',
            runIdKey,
            metadata: { inactiveDays, lastActive: lastActive.toISOString() }
          });
          await triggerAutomationProtocols('ENTITY_INACTIVE', payload);
        }
      }
    }
  }
}
