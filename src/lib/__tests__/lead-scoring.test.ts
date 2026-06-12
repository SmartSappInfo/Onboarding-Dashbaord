import { describe, it, expect } from 'vitest';
import { calculateNewVerifyScores, calculateEngagementAdjustment } from '../scoring-rules-engine';
import type { EntityContact, EmailVerificationRule } from '../types';

describe('scoring-rules-engine tests', () => {
  describe('calculateNewVerifyScores', () => {
    const rules: EmailVerificationRule[] = [
      { minScore: 90, scoreValue: 10 },
      { minScore: 40, scoreValue: 5 },
      { minScore: 0, scoreValue: 0 }
    ];

    it('should assign correct verification score based on rules', () => {
      const contacts: EntityContact[] = [
        { id: 'c1', name: 'John', email: 'john@example.com', typeKey: 'primary', isPrimary: true, isSignatory: true, order: 0, score: 0 }
      ];

      const result = calculateNewVerifyScores(contacts, 'john@example.com', 95, rules);
      expect(result.entityContacts[0].emailVerificationScore).toBe(10);
      expect(result.entityContacts[0].score).toBe(10);
      expect(result.leadScore).toBe(10);
    });

    it('should apply delta score to prevent double-counting when re-verifying', () => {
      const contacts: EntityContact[] = [
        { 
          id: 'c1', 
          name: 'John', 
          email: 'john@example.com', 
          typeKey: 'primary', 
          isPrimary: true, 
          isSignatory: true, 
          order: 0, 
          emailVerificationScore: 5, 
          score: 8 // 5 points from verification, 3 points from engagement
        }
      ];

      // Re-verify at 95% -> should map to 10 points verification score.
      // Net change = 10 - 5 = +5. Total score should be 8 + 5 = 13.
      const result = calculateNewVerifyScores(contacts, 'john@example.com', 95, rules);
      expect(result.entityContacts[0].emailVerificationScore).toBe(10);
      expect(result.entityContacts[0].score).toBe(13);
      expect(result.leadScore).toBe(13);
    });

    it('should clamp contact score at zero and prevent negative scores', () => {
      const contacts: EntityContact[] = [
        { 
          id: 'c1', 
          name: 'John', 
          email: 'john@example.com', 
          typeKey: 'primary', 
          isPrimary: true, 
          isSignatory: true, 
          order: 0, 
          emailVerificationScore: 10, 
          score: 5 // Lower than verification score due to other calculations
        }
      ];

      // Re-verify at 0% -> should map to 0 points.
      // Delta change = 0 - 10 = -10. New score = Math.max(0, 5 - 10) = 0.
      const result = calculateNewVerifyScores(contacts, 'john@example.com', 0, rules);
      expect(result.entityContacts[0].emailVerificationScore).toBe(0);
      expect(result.entityContacts[0].score).toBe(0);
      expect(result.leadScore).toBe(0);
    });
  });

  describe('calculateEngagementAdjustment', () => {
    it('should add score points to target contact', () => {
      const contacts: EntityContact[] = [
        { id: 'c1', name: 'John', email: 'john@example.com', typeKey: 'primary', isPrimary: true, isSignatory: true, order: 0, score: 5 }
      ];

      const result = calculateEngagementAdjustment(contacts, 'john@example.com', 10, 'add');
      expect(result.entityContacts[0].score).toBe(15);
      expect(result.leadScore).toBe(15);
    });

    it('should subtract score points and clamp at zero', () => {
      const contacts: EntityContact[] = [
        { id: 'c1', name: 'John', email: 'john@example.com', typeKey: 'primary', isPrimary: true, isSignatory: true, order: 0, score: 5 }
      ];

      const result = calculateEngagementAdjustment(contacts, 'john@example.com', 10, 'subtract');
      expect(result.entityContacts[0].score).toBe(0);
      expect(result.leadScore).toBe(0);
    });

    it('should set score points exactly', () => {
      const contacts: EntityContact[] = [
        { id: 'c1', name: 'John', email: 'john@example.com', typeKey: 'primary', isPrimary: true, isSignatory: true, order: 0, score: 5 }
      ];

      const result = calculateEngagementAdjustment(contacts, 'john@example.com', 12, 'set');
      expect(result.entityContacts[0].score).toBe(12);
      expect(result.leadScore).toBe(12);
    });

    it('should fallback to primary contact if target email/id matches nothing', () => {
      const contacts: EntityContact[] = [
        { id: 'c1', name: 'John', email: 'john@example.com', typeKey: 'billing', isPrimary: false, isSignatory: true, order: 0, score: 2 },
        { id: 'c2', name: 'Alice', email: 'alice@example.com', typeKey: 'primary', isPrimary: true, isSignatory: false, order: 1, score: 5 }
      ];

      const result = calculateEngagementAdjustment(contacts, 'unknown@example.com', 5, 'add');
      expect(result.entityContacts[0].score).toBe(2); // Unchanged
      expect(result.entityContacts[1].score).toBe(10); // Primary adjusted
      expect(result.leadScore).toBe(12);
    });

    it('should fallback to first contact if no primary exists and target matches nothing', () => {
      const contacts: EntityContact[] = [
        { id: 'c1', name: 'John', email: 'john@example.com', typeKey: 'billing', isPrimary: false, isSignatory: true, order: 0, score: 2 },
        { id: 'c2', name: 'Alice', email: 'alice@example.com', typeKey: 'manager', isPrimary: false, isSignatory: false, order: 1, score: 5 }
      ];

      const result = calculateEngagementAdjustment(contacts, 'unknown@example.com', 5, 'add');
      expect(result.entityContacts[0].score).toBe(7); // First contact adjusted
      expect(result.entityContacts[1].score).toBe(5); // Unchanged
      expect(result.leadScore).toBe(12);
    });
  });
});
