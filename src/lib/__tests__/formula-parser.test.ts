import { describe, it, expect } from 'vitest';
import { evaluateFormula, extractFormulaHeaders } from '../formula-parser';

describe('Formula Parser - evaluateFormula', () => {
  describe('String Interpolation', () => {
    it('should interpolate simple dynamic fields', () => {
      const row = { 'First Name': 'John', 'Last Name': 'Doe' };
      const result = evaluateFormula('{{First Name}} {{Last Name}}', row);
      expect(result).toBe('John Doe');
    });

    it('should handle missing or empty fields gracefully by returning empty strings', () => {
      const row = { 'First Name': 'John' };
      const result = evaluateFormula('{{First Name}} {{Last Name}}', row);
      expect(result).toBe('John');
    });

    it('should trim multiple spaces and outer whitespace cleanly', () => {
      const row = { 'First Name': ' John  ', 'Last Name': '  Doe ' };
      const result = evaluateFormula('  {{First Name}}    {{Last Name}}  ', row);
      expect(result).toBe('John Doe');
    });

    it('should return literal string if no placeholders exist', () => {
      const row = { 'First Name': 'John' };
      const result = evaluateFormula('Literal String Text', row);
      expect(result).toBe('Literal String Text');
    });
  });

  describe('Math Formulas', () => {
    it('should evaluate basic mathematical operations', () => {
      const row = { Price: '10', Qty: '3' };
      const result = evaluateFormula('={{Price}} * {{Qty}}', row);
      expect(result).toBe(30);
    });

    it('should handle mathematical operations with parenthesis and decimals', () => {
      const row = { A: '10.5', B: '2.5', C: '2' };
      const result = evaluateFormula('=(({{A}} + {{B}}) * {{C}})', row);
      expect(result).toBe(26);
    });

    it('should treat missing math fields as 0 gracefully', () => {
      const row = { Price: '10' };
      const result = evaluateFormula('={{Price}} * {{Qty}}', row);
      expect(result).toBe(0);
    });

    it('should remove thousands separator commas from numeric inputs', () => {
      const row = { Price: '1,250.50', Qty: '2' };
      const result = evaluateFormula('={{Price}} * {{Qty}}', row);
      expect(result).toBe(2501);
    });

    it('should fall back to 0 on syntax errors like division by zero or malformed operators', () => {
      const row = { Price: '10' };
      const result = evaluateFormula('={{Price}} / 0', row); // division by zero resulting in Infinity
      expect(result).toBe(0);
    });
  });

  describe('Security and Sandboxing', () => {
    it('should reject and fall back to 0 for math formulas containing non-math characters', () => {
      const row = { Price: '10' };
      const result = evaluateFormula('={{Price}}; console.log("Hacked!")', row);
      expect(result).toBe(0);
    });

    it('should block arbitrary javascript function calls in the formula', () => {
      const row = { Price: '10' };
      const result = evaluateFormula('=alert({{Price}})', row);
      expect(result).toBe(0);
    });

    it('should block dynamic fields that resolve to non-numeric strings containing execution code', () => {
      const row = { Price: '10 + console.log(1)' };
      const result = evaluateFormula('={{Price}}', row);
      // parseFloat('10 + console.log(1)') is 10, which is safe.
      expect(result).toBe(10);

      const row2 = { Price: 'console.log(1)' };
      const result2 = evaluateFormula('={{Price}}', row2);
      // parseFloat('console.log(1)') is NaN -> fallback to 0.
      expect(result2).toBe(0);
    });
  });
});

describe('Formula Parser - extractFormulaHeaders', () => {
  it('should extract all placeholders as headers', () => {
    const headers = extractFormulaHeaders('{{First Name}} {{Last Name}}');
    expect(headers).toEqual(['First Name', 'Last Name']);
  });

  it('should return unique headers', () => {
    const headers = extractFormulaHeaders('={{Price}} * {{Qty}} + {{Price}}');
    expect(headers).toEqual(['Price', 'Qty']);
  });

  it('should return an empty array if there are no placeholders', () => {
    const headers = extractFormulaHeaders('No placeholders here');
    expect(headers).toEqual([]);
  });
});
