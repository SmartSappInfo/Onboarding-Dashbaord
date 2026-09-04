/**
 * @fileOverview CompanyBrain 2.0 Phase 9: Event Trigger Router
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Event Matching Invariant:
 *    - Ingests incoming workspace events (e.g. `crm.deal.stalled`, `crm.lead.created`, `meeting.completed`).
 *    - Validates event payload against trigger filter criteria before dispatching workflow runs.
 * 2. Concurrency & Asynchronous Isolation:
 *    - Dispatches matched workflows using `Promise.allSettled` to prevent one failing workflow from
 *      blocking other triggered automations.
 * 3. Strict Zero-`any` & Zero-`unknown` Invariant:
 *    - All event payloads are typed via `McpPayloadValue`.
 *
 * @testability Covered in `src/lib/workflows/__tests__/workflow-engine.test.ts`.
 */

import { WorkflowEngine } from './workflow-engine';
import type { WorkflowRun, WorkflowEventFilter, WorkflowTriggerConfig } from '../types';
import type { McpPayloadValue } from '@/lib/mcp/types';

export interface WorkspaceTriggerEvent {
  workspaceId: string;
  organizationId: string;
  eventType: string; // e.g. 'crm.deal.stalled' | 'crm.lead.created' | 'meeting.completed'
  payload: Record<string, McpPayloadValue>;
  actorId?: string;
}

export class EventTriggerRouter {
  /**
   * Checks if an incoming event matches a workflow trigger configuration.
   */
  public static matchesTrigger(
    event: WorkspaceTriggerEvent,
    trigger: WorkflowTriggerConfig
  ): boolean {
    if (trigger.type !== 'event') return false;
    if (trigger.eventType && trigger.eventType !== event.eventType) return false;
    if (trigger.filterCriteria && trigger.filterCriteria.length > 0) {
      return this.evaluateFilterCriteria(trigger.filterCriteria, event.payload);
    }
    return true;
  }

  /**
   * Matches an incoming workspace event against active workflows and dispatches runs.
   */
  public static async dispatchWorkspaceEvent(
    event: WorkspaceTriggerEvent
  ): Promise<WorkflowRun[]> {
    const workflows = await WorkflowEngine.listWorkflows(event.workspaceId);

    const matchingWorkflows = workflows.filter((wf) => {
      if (wf.status !== 'active') return false;
      return this.matchesTrigger(event, wf.trigger);
    });

    if (matchingWorkflows.length === 0) {
      return [];
    }

    const spawnedRuns: WorkflowRun[] = [];
    const promises = matchingWorkflows.map(async (wf) => {
      try {
        const run = await WorkflowEngine.startWorkflow(
          wf.id,
          event.payload,
          event.actorId || 'system-event-router'
        );
        return run;
      } catch (err) {
        console.error(`[EventTriggerRouter] Failed to spawn workflow "${wf.id}":`, err);
        return null;
      }
    });

    const settled = await Promise.allSettled(promises);
    for (const res of settled) {
      if (res.status === 'fulfilled' && res.value !== null) {
        spawnedRuns.push(res.value);
      }
    }

    return spawnedRuns;
  }

  /**
   * Evaluates if an event payload satisfies all configured filter criteria.
   */
  public static evaluateFilterCriteria(
    filters: WorkflowEventFilter[],
    payload: Record<string, McpPayloadValue>
  ): boolean {
    for (const filter of filters) {
      const fieldValue = payload[filter.field];
      const targetValue = filter.value;

      if (filter.operator === 'eq' && fieldValue !== targetValue) {
        return false;
      }
      if (filter.operator === 'neq' && fieldValue === targetValue) {
        return false;
      }
      if (filter.operator === 'gt') {
        if (typeof fieldValue !== 'number' || typeof targetValue !== 'number' || fieldValue <= targetValue) {
          return false;
        }
      }
      if (filter.operator === 'lt') {
        if (typeof fieldValue !== 'number' || typeof targetValue !== 'number' || fieldValue >= targetValue) {
          return false;
        }
      }
      if (filter.operator === 'contains') {
        if (!String(fieldValue || '').toLowerCase().includes(String(targetValue).toLowerCase())) {
          return false;
        }
      }
    }

    return true;
  }
}
