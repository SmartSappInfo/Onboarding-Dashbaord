import { describe, it, expect } from 'vitest';
import {
  evaluateFormula,
  detectFormulaCycles,
  recomputeAllFormulasAuthoritative,
  CircularFormulaError,
} from '@/lib/documents/computed-field-service';
import { ComputedFieldFormula } from '@/lib/types/document-signing';

describe('Deterministic Dynamic Field Formula Engine (Phase 6)', () => {
  describe('evaluateFormula', () => {
    it('evaluates sum formula correctly with decimal rounding', () => {
      const formula: ComputedFieldFormula = {
        type: 'sum',
        expression: 'SUM(line1, line2, line3)',
        sourceFieldIds: ['line1', 'line2', 'line3'],
        decimalPlaces: 2,
        currencySymbol: '$',
      };

      const values = {
        line1: '100.50',
        line2: '200.25',
        line3: 50,
      };

      const result = evaluateFormula(formula, values);
      expect(result).toBe(350.75);
    });

    it('evaluates multiply formula correctly (e.g. quantity * unit price)', () => {
      const formula: ComputedFieldFormula = {
        type: 'multiply',
        expression: 'MULTIPLY(quantity, unit_price)',
        sourceFieldIds: ['quantity', 'unit_price'],
        decimalPlaces: 2,
      };

      const values = {
        quantity: '5',
        unit_price: '19.99',
      };

      const result = evaluateFormula(formula, values);
      expect(result).toBe(99.95);
    });

    it('evaluates subtraction formula correctly (e.g. subtotal - discount)', () => {
      const formula: ComputedFieldFormula = {
        type: 'subtract',
        expression: 'SUBTRACT(subtotal, discount)',
        sourceFieldIds: ['subtotal', 'discount'],
        decimalPlaces: 2,
      };

      const values = {
        subtotal: '500.00',
        discount: '75.50',
      };

      const result = evaluateFormula(formula, values);
      expect(result).toBe(424.5);
    });

    it('evaluates percentage formula correctly (e.g. subtotal * 15%)', () => {
      const formula: ComputedFieldFormula = {
        type: 'percentage',
        expression: 'PERCENTAGE(subtotal, tax_rate)',
        sourceFieldIds: ['subtotal', 'tax_rate'],
        decimalPlaces: 2,
      };

      const values = {
        subtotal: '200.00',
        tax_rate: '15', // 15%
      };

      const result = evaluateFormula(formula, values);
      expect(result).toBe(30.0);
    });

    it('safely handles missing or NaN field values by defaulting to 0', () => {
      const formula: ComputedFieldFormula = {
        type: 'sum',
        expression: 'SUM(f1, f2)',
        sourceFieldIds: ['f1', 'f2'],
        decimalPlaces: 2,
      };

      const values = {
        f1: 'invalid-string',
      };

      const result = evaluateFormula(formula, values);
      expect(result).toBe(0);
    });
  });

  describe('detectFormulaCycles (FM-P6-07)', () => {
    it('returns hasCycle: false for acyclic dependency DAGs', () => {
      const fields = [
        { id: 'qty', value: '2' },
        { id: 'rate', value: '50' },
        {
          id: 'subtotal',
          formula: {
            type: 'multiply' as const,
            expression: 'MULTIPLY(qty, rate)',
            sourceFieldIds: ['qty', 'rate'],
            decimalPlaces: 2,
          },
        },
        {
          id: 'total',
          formula: {
            type: 'sum' as const,
            expression: 'SUM(subtotal, tax)',
            sourceFieldIds: ['subtotal'],
            decimalPlaces: 2,
          },
        },
      ];

      const check = detectFormulaCycles(fields);
      expect(check.hasCycle).toBe(false);
    });

    it('detects direct 2-node cycle and returns true with cycle path', () => {
      const fields = [
        {
          id: 'field_A',
          formula: {
            type: 'sum' as const,
            expression: 'SUM(field_B)',
            sourceFieldIds: ['field_B'],
            decimalPlaces: 2,
          },
        },
        {
          id: 'field_B',
          formula: {
            type: 'sum' as const,
            expression: 'SUM(field_A)',
            sourceFieldIds: ['field_A'],
            decimalPlaces: 2,
          },
        },
      ];

      const check = detectFormulaCycles(fields);
      expect(check.hasCycle).toBe(true);
      expect(check.cyclePath).toBeDefined();
    });

    it('detects indirect 3-node cycle (A -> B -> C -> A)', () => {
      const fields = [
        {
          id: 'A',
          formula: {
            type: 'sum' as const,
            expression: 'SUM(B)',
            sourceFieldIds: ['B'],
            decimalPlaces: 2,
          },
        },
        {
          id: 'B',
          formula: {
            type: 'sum' as const,
            expression: 'SUM(C)',
            sourceFieldIds: ['C'],
            decimalPlaces: 2,
          },
        },
        {
          id: 'C',
          formula: {
            type: 'sum' as const,
            expression: 'SUM(A)',
            sourceFieldIds: ['A'],
            decimalPlaces: 2,
          },
        },
      ];

      const check = detectFormulaCycles(fields);
      expect(check.hasCycle).toBe(true);
    });
  });

  describe('recomputeAllFormulasAuthoritative (Anti-Spoofing FM-P6-01)', () => {
    it('authoritatively recomputes chained formulas in topological order and overrides spoofed client values', () => {
      const fields = [
        { id: 'item_price', value: '100' },
        { id: 'item_qty', value: '3' },
        {
          id: 'subtotal',
          value: '50.00', // Maliciously altered client value! Should be overwritten to 300.00
          formula: {
            type: 'multiply' as const,
            expression: 'MULTIPLY(item_price, item_qty)',
            sourceFieldIds: ['item_price', 'item_qty'],
            decimalPlaces: 2,
          },
        },
        {
          id: 'tax',
          value: '1.00', // Maliciously spoofed low tax!
          formula: {
            type: 'percentage' as const,
            expression: 'PERCENTAGE(subtotal, tax_rate)',
            sourceFieldIds: ['subtotal', 'tax_rate'],
            decimalPlaces: 2,
          },
        },
        { id: 'tax_rate', value: '10' }, // 10%
        {
          id: 'grand_total',
          value: '51.00', // Spoofed client total!
          formula: {
            type: 'sum' as const,
            expression: 'SUM(subtotal, tax)',
            sourceFieldIds: ['subtotal', 'tax'],
            decimalPlaces: 2,
          },
        },
      ];

      const computed = recomputeAllFormulasAuthoritative(fields);

      // Verify authoritative recalculations
      expect(computed['subtotal']).toBe('300.00');
      expect(computed['tax']).toBe('30.00');
      expect(computed['grand_total']).toBe('330.00');
    });

    it('throws CircularFormulaError when attempting to recompute cyclic fields', () => {
      const fields = [
        {
          id: 'X',
          formula: {
            type: 'sum' as const,
            expression: 'SUM(Y)',
            sourceFieldIds: ['Y'],
            decimalPlaces: 2,
          },
        },
        {
          id: 'Y',
          formula: {
            type: 'sum' as const,
            expression: 'SUM(X)',
            sourceFieldIds: ['X'],
            decimalPlaces: 2,
          },
        },
      ];

      expect(() => recomputeAllFormulasAuthoritative(fields)).toThrow(CircularFormulaError);
    });
  });
});
