/**
 * @fileoverview Domain Types for Automated CRM Deal Stage Advancement & Sales Effort Logging.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% pure schemas.
 * - Zero 'any' policy strictly enforced.
 */

export interface DealAdvancementRule {
  triggerOutcome: 'meeting_completed' | 'proposal_requested' | 'high_intent_detected' | 'no_show';
  sourceStageId?: string;
  targetStageId: string;
  autoAssignTags?: string[];
  logActivityNote: boolean;
}

export interface DealAdvancementResult {
  dealId: string;
  previousStageId: string;
  newStageId: string;
  appliedTags: string[];
  salesEffortLogged: boolean;
  timestamp: string;
}
