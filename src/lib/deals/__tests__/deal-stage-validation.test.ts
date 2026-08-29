import { describe, it, expect } from 'vitest';
import {
  isDealFieldSatisfied,
  validateStageTransition,
  resolveStageTerminalStatus,
  isStageTerminal,
  STAGE_REQUIRED_FIELD_LABELS,
} from '../deal-stage-validation';
import type { Deal, DealStage } from '../deal-types';

describe('Deal Stage Validation Engine', () => {
  const baseDeal: Partial<Deal> = {
    id: 'deal-101',
    name: 'Apollo High School',
    value: 12000,
    expectedCloseDate: '2026-11-30T00:00:00.000Z',
    contacts: [{ entityId: 'c-1', role: 'Decision Maker', name: 'Dr. Apollo' }],
    nextStep: { type: 'task', title: 'Send contract draft', dueDate: '2026-12-01' },
  };

  const baseStage: Partial<DealStage> = {
    id: 'stage-proposal',
    name: 'Proposal',
    order: 3,
    probability: 60,
    slaDays: 7,
    terminalType: 'none',
    requiredFields: ['value', 'expectedCloseDate', 'primaryContact', 'decisionMaker', 'nextStep'],
  };

  describe('isDealFieldSatisfied', () => {
    it('evaluates value field requirement correctly', () => {
      expect(isDealFieldSatisfied({ value: 5000 }, 'value')).toBe(true);
      expect(isDealFieldSatisfied({ value: 0 }, 'value')).toBe(false);
      expect(isDealFieldSatisfied({ value: undefined }, 'value')).toBe(false);
      expect(isDealFieldSatisfied({ value: -100 }, 'value')).toBe(false);
    });

    it('evaluates expectedCloseDate field requirement correctly', () => {
      expect(isDealFieldSatisfied({ expectedCloseDate: '2026-12-01' }, 'expectedCloseDate')).toBe(true);
      expect(isDealFieldSatisfied({ expectedCloseDate: '' }, 'expectedCloseDate')).toBe(false);
      expect(isDealFieldSatisfied({ expectedCloseDate: undefined }, 'expectedCloseDate')).toBe(false);
    });

    it('evaluates primaryContact field requirement correctly', () => {
      expect(isDealFieldSatisfied({ contacts: [{ entityId: 'c-1', role: 'Buyer' }] }, 'primaryContact')).toBe(true);
      expect(isDealFieldSatisfied({ focalContacts: [{ id: 'fc-1', name: 'John' }] }, 'primaryContact')).toBe(true);
      expect(isDealFieldSatisfied({ contacts: [] }, 'primaryContact')).toBe(false);
      expect(isDealFieldSatisfied({}, 'primaryContact')).toBe(false);
    });

    it('evaluates decisionMaker field requirement correctly', () => {
      expect(isDealFieldSatisfied({ contacts: [{ entityId: 'c-1', role: 'Decision Maker' }] }, 'decisionMaker')).toBe(true);
      expect(isDealFieldSatisfied({ focalContacts: [{ id: 'fc-1', name: 'Jane', role: 'Principal' }] }, 'decisionMaker')).toBe(true);
      expect(isDealFieldSatisfied({ contacts: [{ entityId: 'c-1', role: 'Advisor' }] }, 'decisionMaker')).toBe(false);
      expect(isDealFieldSatisfied({}, 'decisionMaker')).toBe(false);
    });

    it('evaluates nextStep field requirement correctly', () => {
      expect(isDealFieldSatisfied({ nextStep: { type: 'task', title: 'Call client on Friday', dueDate: '2026-12-01' } }, 'nextStep')).toBe(true);
      expect(isDealFieldSatisfied({ nextStep: 'Legacy string next step' as unknown as Deal['nextStep'] }, 'nextStep')).toBe(true);
      expect(isDealFieldSatisfied({ nextStep: { type: 'task', title: '   ', dueDate: '2026-12-01' } }, 'nextStep')).toBe(false);
      expect(isDealFieldSatisfied({}, 'nextStep')).toBe(false);
    });
  });

  describe('validateStageTransition', () => {
    it('returns valid: true when all required fields are present', () => {
      const res = validateStageTransition(baseDeal, baseStage);
      expect(res.valid).toBe(true);
      expect(res.missingFields.length).toBe(0);
    });

    it('identifies missing fields and returns actionable message', () => {
      const incompleteDeal: Partial<Deal> = {
        id: 'deal-102',
        name: 'Incomplete Opportunity',
        value: 0,
        expectedCloseDate: undefined,
        contacts: [],
      };

      const res = validateStageTransition(incompleteDeal, baseStage);
      expect(res.valid).toBe(false);
      expect(res.missingFields).toContain('value');
      expect(res.missingFields).toContain('expectedCloseDate');
      expect(res.missingFields).toContain('primaryContact');
      expect(res.missingFields).toContain('decisionMaker');
      expect(res.missingFields).toContain('nextStep');
      expect(res.message).toContain('Cannot move to "Proposal"');
      expect(res.message).toContain('Deal Value ($ > 0)');
    });

    it('gracefully passes when target stage has no required fields (backward compatibility)', () => {
      const legacyStage: Partial<DealStage> = {
        id: 'stage-lead',
        name: 'Lead Qualification',
      };

      const res = validateStageTransition({}, legacyStage);
      expect(res.valid).toBe(true);
      expect(res.missingFields.length).toBe(0);
    });
  });

  describe('resolveStageTerminalStatus', () => {
    it('resolves won status from terminalType or isWon flag', () => {
      expect(resolveStageTerminalStatus({ terminalType: 'won' })).toBe('won');
      expect(resolveStageTerminalStatus({ isWon: true })).toBe('won');
      expect(resolveStageTerminalStatus({ name: 'Closed Won' })).toBe('won');
    });

    it('resolves lost status from terminalType, isLost flag, or abandoned', () => {
      expect(resolveStageTerminalStatus({ terminalType: 'lost' })).toBe('lost');
      expect(resolveStageTerminalStatus({ terminalType: 'abandoned' })).toBe('lost');
      expect(resolveStageTerminalStatus({ isLost: true })).toBe('lost');
      expect(resolveStageTerminalStatus({ name: 'Closed Lost' })).toBe('lost');
    });

    it('resolves open status for active pipeline stages', () => {
      expect(resolveStageTerminalStatus({ terminalType: 'none', name: 'Negotiation' })).toBe('open');
      expect(resolveStageTerminalStatus(baseStage)).toBe('open');
    });
  });

  describe('isStageTerminal', () => {
    it('correctly identifies terminal stages', () => {
      expect(isStageTerminal({ terminalType: 'won' })).toBe(true);
      expect(isStageTerminal({ terminalType: 'lost' })).toBe(true);
      expect(isStageTerminal({ terminalType: 'none' })).toBe(false);
      expect(isStageTerminal(baseStage)).toBe(false);
    });
  });
});
