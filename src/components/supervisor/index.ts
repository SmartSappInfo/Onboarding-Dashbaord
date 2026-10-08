/**
 * @fileOverview Public Barrel for Supervisor UI Components (Phase 13 Milestone 5)
 *
 * Implements Rule 69 (Strangler Fig Invariant) by exporting canonical modern modals
 * alongside preexisting supervisor assets without breaking existing imports.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

export { SupervisorMissionModal, type SupervisorMissionModalProps } from './SupervisorMissionModal';
export { DelegationTreeModal, type DelegationTreeModalProps } from './DelegationTreeModal';
export {
  GraphReasoningModal,
  type GraphReasoningModalProps,
  type GraphReasoningMode,
} from './GraphReasoningModal';

// Preexisting Supervisor components (Phase 7 Strangler Invariant)
export { SupervisorApprovalBanner } from './SupervisorApprovalBanner';
export { SupervisorMissionControl } from './SupervisorMissionControl';
export { SupervisorMissionInput } from './SupervisorMissionInput';
export { SupervisorPlanGraph } from './SupervisorPlanGraph';
export { SupervisorResultCard } from './SupervisorResultCard';
export { SupervisorRunsHistoryTable } from './SupervisorRunsHistoryTable';
export { SupervisorStepInspectorDrawer } from './SupervisorStepInspectorDrawer';
