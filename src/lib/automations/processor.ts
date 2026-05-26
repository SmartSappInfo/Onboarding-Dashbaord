/**
 * Automation execution engine — public API.
 * Import from `@/lib/automation-processor` for backward compatibility.
 */
export { MAX_AUTOMATION_CHAIN_DEPTH, type ExecutionContext } from './execution-types';
export { triggerAutomationProtocols } from './orchestrator';
export { processScheduledJobsAction } from './resume';
export { runAutomationById } from './run-by-id';
export { executeAutomation } from './executor';
