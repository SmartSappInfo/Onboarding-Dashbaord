'use server';

import type { Automation } from './types';
import {
  removeAutomation,
  saveAutomation,
  seedDefaultDealAutomation,
  setAutomationStatus,
  manuallyReleaseWaitJob,
  manuallyEndAutomationRun,
  archiveAutomation,
  restoreAutomation,
  deleteAllArchivedAutomations,
} from './automations/service';
import { testAutomationFlow } from './automations/test-flow';
import type { TestAutomationFlowInput } from './automations/test-flow';

/**
 * Thin server-action boundary — business logic lives in `automations/service.ts`.
 */
export async function saveAutomationAction(
  id: string | null,
  data: Partial<Automation>,
  userId: string
) {
  return saveAutomation(id, data, userId);
}

export async function deleteAutomationAction(id: string, userId: string) {
  return removeAutomation(id, userId);
}

export async function archiveAutomationAction(id: string, userId: string) {
  return archiveAutomation(id, userId);
}

export async function restoreAutomationAction(id: string, userId: string) {
  return restoreAutomation(id, userId);
}

export async function deleteAllArchivedAutomationsAction(workspaceId: string, userId: string) {
  return deleteAllArchivedAutomations(workspaceId, userId);
}

export async function toggleAutomationStatusAction(id: string, active: boolean, userId: string) {
  return setAutomationStatus(id, active, userId);
}

export async function seedDefaultAutomationsAction(
  workspaceId: string,
  organizationId: string,
  userId: string
) {
  return seedDefaultDealAutomation(workspaceId, organizationId, userId);
}

export async function testAutomationFlowAction(
  automationId: string,
  userId: string,
  input: TestAutomationFlowInput
) {
  return testAutomationFlow(automationId, userId, input);
}

export async function testAutomationStepAction(
  automationId: string,
  nodeId: string,
  entityId: string,
  nodeDataOverride: any,
  userId: string
) {
  const { testAutomationStep } = await import('./automations/test-step');
  return testAutomationStep(automationId, nodeId, entityId, nodeDataOverride, userId);
}

export async function pulseAutomationEngineAction() {
  const { processScheduledJobsAction } = await import('./automations/processor');
  return processScheduledJobsAction();
}

export async function manuallyReleaseWaitJobAction(jobId: string, userId: string) {
  return manuallyReleaseWaitJob(jobId, userId);
}

export async function manuallyEndAutomationRunAction(runId: string, userId: string) {
  return manuallyEndAutomationRun(runId, userId);
}
