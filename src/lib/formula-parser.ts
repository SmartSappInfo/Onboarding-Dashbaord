/**
 * Evaluates a formula against a CSV row object.
 * Supports:
 * 1. Math formulas (starting with '='): e.g. "={{Price}} * {{Qty}}"
 * 2. String interpolation: e.g. "{{First Name}} {{Last Name}}"
 */
export function evaluateFormula(formula: string, row: Record<string, any>): string | number {
  if (!formula) return "";
  
  const trimmedFormula = formula.trim();
  if (trimmedFormula.startsWith('=')) {
    // Math Formula
    const mathExpressionTemplate = trimmedFormula.substring(1).trim();
    // Replace all placeholders with numeric values
    let mathExpression = mathExpressionTemplate.replace(/\{\{([^}]+)\}\}/g, (_, fieldName) => {
      const trimmedFieldName = fieldName.trim();
      const val = row[trimmedFieldName];
      if (val === undefined || val === null || val === '') {
        return '0';
      }
      // Parse as float to ensure it's numeric. Remove any comma thousand separators.
      const cleanedVal = String(val).replace(/,/g, '');
      const num = parseFloat(cleanedVal);
      return isNaN(num) ? '0' : String(num);
    });

    // Security check: only allow digits, arithmetic operators, parentheses, decimal point, and spaces
    const safeMathRegex = /^[0-9+\-*/().\s]+$/;
    if (!safeMathRegex.test(mathExpression)) {
      console.warn(`FormulaParser: Rejected unsafe math expression: "${mathExpression}"`);
      return 0;
    }

    try {
      // Evaluate the math expression safely using Function
      const result = new Function(`return (${mathExpression})`)();
      if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
        return result;
      }
      return 0;
    } catch (e) {
      console.error(`FormulaParser: Error evaluating math expression "${mathExpression}":`, e);
      return 0;
    }
  } else {
    // String interpolation
    const result = trimmedFormula.replace(/\{\{([^}]+)\}\}/g, (_, fieldName) => {
      const trimmedFieldName = fieldName.trim();
      const val = row[trimmedFieldName];
      if (val === undefined || val === null) {
        return '';
      }
      return String(val);
    });

    // Clean up multiple spaces and trim
    return result.replace(/\s+/g, ' ').trim();
  }
}

/**
 * Extracts unique CSV header names referenced within a formula.
 * e.g., "{{First Name}} {{Last Name}}" -> ["First Name", "Last Name"]
 */
export function extractFormulaHeaders(formula: string): string[] {
  if (!formula) return [];
  const matches = formula.match(/\{\{([^}]+)\}\}/g);
  if (!matches) return [];
  const headers = matches.map(m => m.slice(2, -2).trim());
  return Array.from(new Set(headers));
}
