import type { Automation } from '../../types';
import { evaluateConditionNode } from '../../automation-condition';
import { processActionNode } from '../actions';
import type { ExecutionContext } from '../execution-types';
import { handleDelayNode } from './delay';
import { evaluateTagConditionNode, processTagActionNode } from './tag-nodes';
import { adminDb } from '../../firebase-admin';
import { logStepExecution } from '../step-logger';
import { fetchLiveEntityTags, nodeChecksTags } from '../tag-enrichment';
import { notifyAutomationFailed } from '../automation-lifecycle-notify';
import crypto from 'crypto';

export function getSplitAssignment(entityId: string, automationId: string, nodeId: string, splitRatio: number, payload: any): 'a' | 'b' {
  const fallbackId = entityId || payload?.email || payload?.phone || Math.random().toString();
  const input = `${fallbackId}:${automationId}:${nodeId}`;
  const hash = crypto.createHash('md5').update(input).digest('hex');
  const percent = parseInt(hash.substring(0, 8), 16) % 100;
  return percent < splitRatio ? 'a' : 'b';
}

function flattenObject(obj: any, prefix = '', res: Record<string, any> = {}): Record<string, any> {
  if (!obj || typeof obj !== 'object') return res;

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flattenObject(value, newKey, res);
    } else {
      res[newKey] = value;
    }
  }
  return res;
}

export async function enrichExecutionContext(context: ExecutionContext): Promise<void> {
  if (!context.payload) {
    context.payload = {};
  }

  // 1. Workspace Info
  if (context.workspaceId) {
    context.payload['workspace.id'] = context.workspaceId;
  }

  // 2. Entity Details
  if (context.entityId && context.workspaceId) {
    try {
      const { resolveContact } = await import('../../contact-adapter');
      const contact = await resolveContact(context.entityId, context.workspaceId);
      if (contact) {
        context.payload['entity.displayName'] = contact.name || '';
        context.payload['entity.primaryEmail'] = contact.primaryContactEmail || '';
        context.payload['entity.primaryPhone'] = contact.primaryContactPhone || '';
        context.payload['entity.assignedTo'] = contact.assignedTo || '';
        context.payload['entityName'] = contact.name || '';
        context.payload['displayName'] = contact.name || '';
      }
    } catch (err) {
      console.warn('Failed to resolve entity context variables:', err);
    }
  }

  // 3. Webhook Ingress Payload
  const isWebhook = context.payload.source === 'external_webhook' || context.payload.ingressId;
  if (isWebhook) {
    const body = context.payload.body || {};
    const headers = context.payload.headers || {};
    const query = context.payload.query || {};
    const files = context.payload.files || [];

    const flatBody = flattenObject(body);

    for (const [key, val] of Object.entries(flatBody)) {
      context.payload[`1.body.${key}`] = val;
      context.payload[`body.${key}`] = val;
    }
    for (const [key, val] of Object.entries(headers)) {
      context.payload[`1.headers.${key}`] = val;
      context.payload[`headers.${key}`] = val;
    }
    for (const [key, val] of Object.entries(query)) {
      context.payload[`1.query.${key}`] = val;
      context.payload[`query.${key}`] = val;
    }
    if (Array.isArray(files)) {
      files.forEach((file: any, idx: number) => {
        if (file && typeof file === 'object') {
          context.payload[`1.files[${idx}].name`] = file.name;
          context.payload[`1.files[${idx}].size`] = file.size;
          context.payload[`1.files[${idx}].type`] = file.type;
          context.payload[`files[${idx}].name`] = file.name;
          context.payload[`files[${idx}].size`] = file.size;
          context.payload[`files[${idx}].type`] = file.type;
        }
      });
    }
  }
}

function getStepNumbers(automation: Automation): Record<string, number> {
  const steps: Record<string, number> = {};
  const triggerNode = automation.nodes.find((n) => n.type === 'triggerNode');
  if (!triggerNode) return steps;

  const queue: { id: string; step: number }[] = [{ id: triggerNode.id, step: 1 }];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const { id, step } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    steps[id] = step;

    const outgoing = automation.edges.filter((e) => e.source === id);
    for (const edge of outgoing) {
      queue.push({ id: edge.target, step: step + 1 });
    }
  }
  return steps;
}

export async function traverseNodes(
  nodeId: string,
  automation: Automation,
  context: ExecutionContext
): Promise<void> {
  const currentNode = automation.nodes.find((n) => n.id === nodeId);
  if (!currentNode) return;

  // Enrich context details at the start of node traversal
  await enrichExecutionContext(context);

  // Log trigger node execution or delay node resumption
  if (currentNode.type === 'triggerNode') {
    logStepExecution(context.runId, {
      nodeId: currentNode.id,
      nodeType: currentNode.type,
      nodeLabel: currentNode.data?.label || 'Trigger',
      status: 'success',
      executedAt: new Date().toISOString(),
    });
  } else if (currentNode.type === 'delayNode') {
    // Visited at start of traversal during resumption
    logStepExecution(context.runId, {
      nodeId: currentNode.id,
      nodeType: currentNode.type,
      nodeLabel: currentNode.data?.label || 'Delay',
      status: 'success',
      executedAt: new Date().toISOString(),
      metadata: {
        resumedAt: new Date().toISOString(),
      },
    });
  }

  let outgoingEdges = automation.edges.filter((e) => e.source === nodeId);

  if (currentNode.type === 'conditionNode') {
    // Enrich payload with live Firestore tags when the node checks tag fields.
    // This bypasses the contact-adapter cache so we always see the entity's
    // current tag state — not a snapshot from earlier in the same run.
    let evalPayload = context.payload;
    if (context.entityId && context.workspaceId && nodeChecksTags(currentNode)) {
      const liveTags = await fetchLiveEntityTags(context.entityId, context.workspaceId);
      // __liveTags (double-underscore) signals internal enrichment, never collides with user data
      evalPayload = { ...context.payload, __liveTags: liveTags };
    }

    const isTrue = await evaluateConditionNode(
      currentNode,
      evalPayload,
      async (audienceId) => {
        const snap = await adminDb.collection('message_audiences').doc(audienceId).get();
        return snap.exists ? snap.data() : null;
      },
      async (entityId, automationId, operator) => {
        if (operator === 'currently_in') {
          const snap = await adminDb.collection('automation_runs')
            .where('entityId', '==', entityId)
            .where('automationId', '==', automationId)
            .where('status', '==', 'running')
            .limit(1)
            .get();
          return !snap.empty;
        }
        if (operator === 'has_entered') {
          const snap = await adminDb.collection('automation_runs')
            .where('entityId', '==', entityId)
            .where('automationId', '==', automationId)
            .limit(1)
            .get();
          return !snap.empty;
        }
        if (operator === 'has_completed') {
          const snap = await adminDb.collection('automation_runs')
            .where('entityId', '==', entityId)
            .where('automationId', '==', automationId)
            .where('status', '==', 'completed')
            .limit(1)
            .get();
          return !snap.empty;
        }
        if (operator === 'not_entered') {
          const snap = await adminDb.collection('automation_runs')
            .where('entityId', '==', entityId)
            .where('automationId', '==', automationId)
            .limit(1)
            .get();
          return snap.empty;
        }
        return false;
      }
    );
    const targetHandle = isTrue ? 'true' : 'false';
    outgoingEdges = outgoingEdges.filter((e) => e.sourceHandle === targetHandle);

    logStepExecution(context.runId, {
      nodeId: currentNode.id,
      nodeType: 'conditionNode',
      nodeLabel: currentNode.data?.label || 'Condition',
      status: 'success',
      executedAt: new Date().toISOString(),
      metadata: { evaluation: targetHandle as 'true' | 'false' },
    });
  } else if (currentNode.type === 'tagConditionNode') {
    const isTrue = await evaluateTagConditionNode(currentNode, context);
    const targetHandle = isTrue ? 'true' : 'false';
    outgoingEdges = outgoingEdges.filter((e) => e.sourceHandle === targetHandle);

    logStepExecution(context.runId, {
      nodeId: currentNode.id,
      nodeType: 'tagConditionNode',
      nodeLabel: currentNode.data?.label || 'Tag Condition',
      status: 'success',
      executedAt: new Date().toISOString(),
      metadata: { evaluation: targetHandle as 'true' | 'false' },
    });
  } else if (currentNode.type === 'abSplitNode') {
    const splitRatio = (currentNode.data?.config?.splitRatio as number) ?? 50;
    const path = getSplitAssignment(context.entityId || '', context.automationId, currentNode.id, splitRatio, context.payload);
    outgoingEdges = outgoingEdges.filter((e) => e.sourceHandle === path);

    logStepExecution(context.runId, {
      nodeId: currentNode.id,
      nodeType: 'abSplitNode',
      nodeLabel: currentNode.data?.label || 'A/B Split',
      status: 'success',
      executedAt: new Date().toISOString(),
      metadata: { path, splitRatio },
    });
  }

  for (const edge of outgoingEdges) {
    const nextNode = automation.nodes.find((n) => n.id === edge.target);
    if (!nextNode) continue;

    const stepStart = Date.now();

    try {
      if (nextNode.type === 'actionNode') {
        const output = await processActionNode(nextNode, context);

        // Enrich context payload with action output
        const stepNumbers = getStepNumbers(automation);
        const stepNum = stepNumbers[nextNode.id];
        if (stepNum && output && typeof output === 'object') {
          for (const [key, val] of Object.entries(output)) {
            context.payload[`${stepNum}.${key}`] = val;
            context.payload[`${nextNode.id}.${key}`] = val;
          }
        }

        logStepExecution(context.runId, {
          nodeId: nextNode.id,
          nodeType: 'actionNode',
          nodeLabel: nextNode.data?.label || 'Action',
          status: 'success',
          executedAt: new Date().toISOString(),
          durationMs: Date.now() - stepStart,
          metadata: { actionType: nextNode.data?.actionType },
        });
      } else if (nextNode.type === 'tagActionNode') {
        await processTagActionNode(nextNode, context);
        logStepExecution(context.runId, {
          nodeId: nextNode.id,
          nodeType: 'tagActionNode',
          nodeLabel: nextNode.data?.label || 'Tag Action',
          status: 'success',
          executedAt: new Date().toISOString(),
          durationMs: Date.now() - stepStart,
          metadata: { actionType: nextNode.data?.action },
        });
      } else if (nextNode.type === 'delayNode') {
        const { value, unit } = nextNode.data?.config || { value: 5, unit: 'Minutes' };
        const now = new Date();
        const executeAt = new Date(now);
        if (unit === 'Minutes') executeAt.setMinutes(executeAt.getMinutes() + (value || 5));
        else if (unit === 'Hours') executeAt.setHours(executeAt.getHours() + (value || 1));
        else if (unit === 'Days') executeAt.setDate(executeAt.getDate() + (value || 1));
        else if (unit === 'Weeks') executeAt.setDate(executeAt.getDate() + (value || 1) * 7);

        logStepExecution(context.runId, {
          nodeId: nextNode.id,
          nodeType: 'delayNode',
          nodeLabel: nextNode.data?.label || 'Delay',
          status: 'waiting',
          executedAt: now.toISOString(),
          metadata: { delayUntil: executeAt.toISOString() },
        });

        await handleDelayNode(nextNode, context);
        return;
      }

      await traverseNodes(nextNode.id, automation, context);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      const label = nextNode.data?.label as string | undefined ?? nextNode.id;
      logStepExecution(context.runId, {
        nodeId: nextNode.id,
        nodeType: nextNode.type || 'unknown',
        nodeLabel: label,
        status: 'failed',
        executedAt: new Date().toISOString(),
        durationMs: Date.now() - stepStart,
        error: message,
      });

      // Mark run as failed and pause all pending jobs so the contact is held.
      // Guard against redundant writes when a parent recursive call also catches.
      if (context.runId) {
        try {
          const runRef = adminDb.collection('automation_runs').doc(context.runId);
          const runSnap = await runRef.get();
          if (runSnap.data()?.status !== 'failed') {
            await runRef.update({
              status: 'failed',
              finishedAt: new Date().toISOString(),
              error: `Node [${label}] failed: ${message}`,
              currentNodeId: nextNode.id,
              currentNodeLabel: label,
            });

            // Pause pending jobs so the contact doesn't silently advance
            const pendingJobsSnap = await adminDb
              .collection('automation_jobs')
              .where('runId', '==', context.runId)
              .where('status', '==', 'pending')
              .get();

            if (!pendingJobsSnap.empty) {
              const batch = adminDb.batch();
              pendingJobsSnap.docs.forEach((jobDoc) =>
                batch.update(jobDoc.ref, { status: 'paused' })
              );
              await batch.commit();
            }

            // Notify workspace admins immediately (fire-and-forget)
            notifyAutomationFailed({
              automationId: context.automationId,
              automationName: automation.name ?? context.automationId,
              workspaceId: context.workspaceId ?? '',
              stepLabel: label,
              error: message,
            }).catch(() => { /* non-fatal */ });
          }
        } catch (updateErr: unknown) {
          const updateMsg = updateErr instanceof Error ? updateErr.message : String(updateErr);
          console.error('[TRAVERSE] Failed to mark run as failed (non-fatal):', updateMsg);
        }
      }

      throw new Error(`Node [${label}] failed: ${message}`);
    }
  }
}
