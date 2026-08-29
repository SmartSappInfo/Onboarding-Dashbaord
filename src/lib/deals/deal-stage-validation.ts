/**
 * @fileoverview Pure Stage Transition & Process Gate Validation Engine
 *
 * ARCHITECTURAL POINTER (Deals Platform 2.0 — Phase 2 Pipeline Engine):
 * Provides pure, deterministic validation of deal readiness prior to stage transitions:
 * - Evaluates stage entry/exit criteria & required commercial fields (PRD Section 16).
 * - Identifies terminal stage classification (Won / Lost / Open / Abandoned) (PRD Section 14).
 * - Side-effect free, zero external dependencies, 100% unit-testable.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Missing or legacy stage documents must gracefully return `valid: true` (backward compatibility).
 * - All returned error messages must be actionable and human-readable.
 * - Strict zero 'any' / 'any[]' typing.
 *
 * TESTABILITY POINTER:
 * Unit tests located in `src/lib/deals/__tests__/deal-stage-validation.test.ts`.
 */

import type { Deal, DealStage, StageRequiredField, StageValidationResult } from './deal-types';

/**
 * Human-readable display labels for stage entry required fields
 */
export const STAGE_REQUIRED_FIELD_LABELS: Record<StageRequiredField, string> = {
  value: 'Deal Value ($ > 0)',
  expectedCloseDate: 'Expected Close / Delivery Date',
  primaryContact: 'Linked Stakeholder / Contact',
  decisionMaker: 'Designated Decision Maker',
  nextStep: 'Next Action / Immediate Step',
};

/**
 * Checks if a specific required field is satisfied on a deal opportunity.
 */
export function isDealFieldSatisfied(deal: Partial<Deal>, field: StageRequiredField): boolean {
  switch (field) {
    case 'value':
      return typeof deal.value === 'number' && deal.value > 0;

    case 'expectedCloseDate':
      return Boolean(deal.expectedCloseDate && deal.expectedCloseDate.trim().length > 0);

    case 'primaryContact': {
      const hasContacts = Array.isArray(deal.contacts) && deal.contacts.length > 0;
      const hasFocal = Array.isArray(deal.focalContacts) && deal.focalContacts.length > 0;
      return hasContacts || hasFocal;
    }

    case 'decisionMaker': {
      const focalHasDM = Array.isArray(deal.focalContacts) && deal.focalContacts.some(
        c => c.role && /decision|head|principal|director|ceo|cfo|vp|exec/i.test(c.role)
      );
      const contactHasDM = Array.isArray(deal.contacts) && deal.contacts.some(
        c => c.role && /decision|head|principal|director|ceo|cfo|vp|exec/i.test(c.role)
      );
      return focalHasDM || contactHasDM;
    }

    case 'nextStep': {
      if (typeof deal.nextStep === 'string') {
        return deal.nextStep.trim().length > 0;
      }
      if (deal.nextStep && typeof deal.nextStep === 'object') {
        return Boolean(deal.nextStep.title && deal.nextStep.title.trim().length > 0);
      }
      return false;
    }

    default:
      return true;
  }
}

/**
 * Validates whether a deal satisfies all entry requirements of a target stage.
 *
 * @param deal The deal being moved.
 * @param targetStage The destination stage configuration.
 * @returns StageValidationResult containing validity boolean and list of missing fields.
 */
export function validateStageTransition(
  deal?: Partial<Deal> | null,
  targetStage?: Partial<DealStage> | null
): StageValidationResult {
  if (!deal || !targetStage) {
    return {
      valid: true,
      missingFields: [],
      missingFieldLabels: [],
    };
  }

  const requiredFields = Array.isArray(targetStage.requiredFields) ? targetStage.requiredFields : [];

  if (requiredFields.length === 0) {
    return {
      valid: true,
      missingFields: [],
      missingFieldLabels: [],
    };
  }

  const missingFields: StageRequiredField[] = [];
  const missingFieldLabels: string[] = [];

  for (const field of requiredFields) {
    if (!isDealFieldSatisfied(deal, field)) {
      missingFields.push(field);
      missingFieldLabels.push(STAGE_REQUIRED_FIELD_LABELS[field] || field);
    }
  }

  if (missingFields.length > 0) {
    const stageName = targetStage.name || 'target stage';
    const message = `Cannot move to "${stageName}". ${missingFields.length} required field${
      missingFields.length > 1 ? 's are' : ' is'
    } missing: ${missingFieldLabels.join(', ')}.`;

    return {
      valid: false,
      missingFields,
      missingFieldLabels,
      message,
    };
  }

  return {
    valid: true,
    missingFields: [],
    missingFieldLabels: [],
  };
}

/**
 * Resolves the resulting DealStatus ('won' | 'lost' | 'open') based on the destination stage.
 */
export function resolveStageTerminalStatus(
  stage?: Partial<DealStage> | null
): 'won' | 'lost' | 'open' {
  if (!stage) return 'open';

  if (stage.terminalType === 'won' || stage.isWon) {
    return 'won';
  }

  if (stage.terminalType === 'lost' || stage.terminalType === 'abandoned' || stage.isLost) {
    return 'lost';
  }

  // Fallback for legacy stages named "Won" or "Lost"
  const normalizedName = (stage.name || '').toLowerCase().trim();
  if (normalizedName === 'won' || normalizedName === 'closed won') {
    return 'won';
  }
  if (normalizedName === 'lost' || normalizedName === 'closed lost' || normalizedName === 'abandoned') {
    return 'lost';
  }

  return 'open';
}

/**
 * Determines whether a stage represents a terminal (closed) outcome.
 */
export function isStageTerminal(stage?: Partial<DealStage> | null): boolean {
  const status = resolveStageTerminalStatus(stage);
  return status === 'won' || status === 'lost';
}
