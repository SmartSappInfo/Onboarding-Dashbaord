import { adminDb } from '../../firebase-admin';
import type { Automation } from '../../types';
import { MAX_AUTOMATION_CHAIN_DEPTH, type ExecutionContext } from '../execution-types';

export async function handleRunAutomation(
  config: Record<string, unknown>,
  context: ExecutionContext
): Promise<void> {
  const depth = context.chainDepth ?? 0;
  if (depth >= MAX_AUTOMATION_CHAIN_DEPTH) {
    throw new Error(`Automation chain depth exceeded (${MAX_AUTOMATION_CHAIN_DEPTH}).`);
  }
  if (!config.automationId) throw new Error('Run automation action missing automationId.');

  const autoDoc = await adminDb.collection('automations').doc(config.automationId as string).get();
  if (!autoDoc.exists) return;

  const automation = { id: autoDoc.id, ...autoDoc.data() } as Automation;
  if (!automation.isActive) return;

  const { executeAutomation } = await import('../executor');
  await executeAutomation(
    automation,
    {
      ...context.payload,
      _chainDepth: depth + 1,
    },
    depth + 1
  );
}
