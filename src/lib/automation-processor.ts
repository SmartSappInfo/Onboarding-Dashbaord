/**
 * @deprecated Import from `@/lib/automations/processor` for new code.
 * Re-export barrel — keeps existing imports working.
 */
export {
  MAX_AUTOMATION_CHAIN_DEPTH,
  type ExecutionContext,
  triggerAutomationProtocols,
  triggerAutomationProtocolsBulk,
  processScheduledJobsAction,
  runAutomationById,
  executeAutomation,
} from './automations/processor';
