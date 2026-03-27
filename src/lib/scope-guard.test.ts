/**
 * Property-Based Tests for ScopeGuard Invariant
 * 
 * Property 1: ScopeGuard Invariant
 * Validates: Requirements 4
 * 
 * This test suite uses property-based testing to verify that the ScopeGuard
 * validation function correctly enforces the architectural rule:
 * entity.entityType === workspace.contactScope
 * 
 * The test generates random combinations of entityType and contactScope values
 * and asserts that:
 * 1. Matching pairs are always accepted
 * 2. Mismatched pairs are always rejected with SCOPE_MISMATCH error
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validateScopeMatch, SCOPE_ERROR_CODES } from './scope-guard';
import { EntityType, ContactScope } from './types';

describe('ScopeGuard Invariant - Property-Based Tests', () => {
  /**
   * Property 1.1: Matching entity type and contact scope always succeed
   * 
   * For any valid entityType, when contactScope equals entityType,
   * the validation must succeed.
   */
  it('should always accept matching entityType and contactScope', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<EntityType>('institution', 'family', 'person'),
        (scope) => {
          const result = validateScopeMatch(scope, scope);
          
          expect(result.valid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1.2: Mismatched entity type and contact scope always fail
   * 
   * For any combination where entityType !== contactScope,
   * the validation must fail with a SCOPE_MISMATCH error.
   */
  it('should always reject mismatched entityType and contactScope', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<EntityType>('institution', 'family', 'person'),
        fc.constantFrom<ContactScope>('institution', 'family', 'person'),
        (entityType, contactScope) => {
          // Only test mismatched pairs
          fc.pre(entityType !== contactScope);
          
          const result = validateScopeMatch(entityType, contactScope);
          
          expect(result.valid).toBe(false);
          if (!result.valid) {
            expect(result.error.code).toBe(SCOPE_ERROR_CODES.SCOPE_MISMATCH);
            expect(result.error.entityType).toBe(entityType);
            expect(result.error.contactScope).toBe(contactScope);
            expect(result.error.message).toContain(entityType);
            expect(result.error.message).toContain(contactScope);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1.3: Error messages are always descriptive and contain both values
   * 
   * When validation fails, the error message must contain both the entityType
   * and contactScope values to help with debugging.
   */
  it('should always provide descriptive error messages for mismatches', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<EntityType>('institution', 'family', 'person'),
        fc.constantFrom<ContactScope>('institution', 'family', 'person'),
        (entityType, contactScope) => {
          fc.pre(entityType !== contactScope);
          
          const result = validateScopeMatch(entityType, contactScope);
          
          if (!result.valid) {
            const message = result.error.message;
            expect(message).toBeTruthy();
            expect(message.length).toBeGreaterThan(0);
            expect(message).toMatch(new RegExp(entityType));
            expect(message).toMatch(new RegExp(contactScope));
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1.4: Validation is deterministic
   * 
   * For the same inputs, validateScopeMatch must always return the same result.
   * This property verifies that the function has no side effects and is pure.
   */
  it('should return consistent results for the same inputs', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<EntityType>('institution', 'family', 'person'),
        fc.constantFrom<ContactScope>('institution', 'family', 'person'),
        (entityType, contactScope) => {
          const result1 = validateScopeMatch(entityType, contactScope);
          const result2 = validateScopeMatch(entityType, contactScope);
          
          expect(result1.valid).toBe(result2.valid);
          
          if (!result1.valid && !result2.valid) {
            expect(result1.error.code).toBe(result2.error.code);
            expect(result1.error.message).toBe(result2.error.message);
            expect(result1.error.entityType).toBe(result2.error.entityType);
            expect(result1.error.contactScope).toBe(result2.error.contactScope);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1.5: All possible combinations are covered
   * 
   * This test exhaustively checks all 9 possible combinations (3x3 matrix)
   * to ensure complete coverage of the scope validation logic.
   */
  it('should handle all possible entityType and contactScope combinations', () => {
    const entityTypes: EntityType[] = ['institution', 'family', 'person'];
    const contactScopes: ContactScope[] = ['institution', 'family', 'person'];
    
    const results: Array<{
      entityType: EntityType;
      contactScope: ContactScope;
      valid: boolean;
    }> = [];
    
    for (const entityType of entityTypes) {
      for (const contactScope of contactScopes) {
        const result = validateScopeMatch(entityType, contactScope);
        results.push({
          entityType,
          contactScope,
          valid: result.valid,
        });
      }
    }
    
    // Verify we tested all 9 combinations
    expect(results).toHaveLength(9);
    
    // Verify exactly 3 combinations succeed (diagonal: institution-institution, family-family, person-person)
    const successCount = results.filter(r => r.valid).length;
    expect(successCount).toBe(3);
    
    // Verify exactly 6 combinations fail (off-diagonal)
    const failureCount = results.filter(r => !r.valid).length;
    expect(failureCount).toBe(6);
    
    // Verify the specific successful combinations
    expect(results.find(r => r.entityType === 'institution' && r.contactScope === 'institution')?.valid).toBe(true);
    expect(results.find(r => r.entityType === 'family' && r.contactScope === 'family')?.valid).toBe(true);
    expect(results.find(r => r.entityType === 'person' && r.contactScope === 'person')?.valid).toBe(true);
  });
});
