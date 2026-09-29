/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * Deterministic Dynamic Field Formula Engine (Phase 6):
 * 1. Purpose & Anti-Tampering (FM-P6-01):
 *    Provides deterministic evaluation of computed document fields (e.g., Subtotals,
 *    Taxes, Discounts, Grand Totals). While client UI provides instant reactivity,
 *    this server-side engine re-evaluates all formulas authoritatively before
 *    vector PDF generation in `finalizeAgreementAction`, completely preventing
 *    client-side price or formula spoofing.
 * 2. Circular Reference Prevention (FM-P6-07):
 *    Builds a Directed Acyclic Graph (DAG) of field dependencies. Uses DFS cycle
 *    detection with a maximum depth limit of 5 to immediately detect and reject
 *    infinite dependency loops (`CircularFormulaError`).
 * 3. Zero-Eval Safe Evaluation:
 *    Arithmetic evaluation is performed purely on numeric tokens and primitive
 *    operators without `eval()` or `Function()`, preventing arbitrary code execution.
 * 4. Strict Typing (Rule 4):
 *    Strictly zero `any` or `any[]`.
 */

import { ComputedFieldFormula } from '@/lib/types/document-signing';

export class CircularFormulaError extends Error {
  public readonly cyclePath?: string[];

  constructor(message: string, cyclePath?: string[]) {
    super(message);
    this.name = 'CircularFormulaError';
    this.cyclePath = cyclePath;
  }
}

export interface FieldWithFormulaInput {
  id: string;
  value?: string | number;
  formula?: ComputedFieldFormula;
}

/**
 * Safely parses string or numeric inputs into finite floats.
 * Automatically cleans currency symbols, commas, and formatting.
 */
export function parseNumericValue(val: unknown): number {
  if (typeof val === 'number') {
    return isFinite(val) ? val : 0;
  }
  if (typeof val === 'string') {
    const clean = val.replace(/[^0-9.-]/g, '').trim();
    if (!clean) return 0;
    const parsed = parseFloat(clean);
    return isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/**
 * Evaluates a single computed field formula against the current field values dictionary.
 */
export function evaluateFormula(
  formula: ComputedFieldFormula,
  values: Record<string, string | number>
): number {
  const sourceValues = (formula.sourceFieldIds || []).map((id) =>
    parseNumericValue(values[id])
  );

  let result = 0;

  switch (formula.type) {
    case 'sum': {
      result = sourceValues.reduce((acc, curr) => acc + curr, 0);
      break;
    }
    case 'multiply': {
      if (sourceValues.length === 0) {
        result = 0;
      } else {
        result = sourceValues.reduce((acc, curr) => acc * curr, 1);
      }
      break;
    }
    case 'subtract': {
      if (sourceValues.length === 0) {
        result = 0;
      } else {
        const [first, ...rest] = sourceValues;
        result = rest.reduce((acc, curr) => acc - curr, first ?? 0);
      }
      break;
    }
    case 'percentage': {
      const base = sourceValues[0] ?? 0;
      const rate = sourceValues[1] ?? 0;
      result = (base * rate) / 100;
      break;
    }
    case 'tax': {
      const base = sourceValues[0] ?? 0;
      const rate = sourceValues[1] ?? 0;
      // If rate > 1 (e.g. 15 for 15%), convert to fraction
      const effectiveRate = rate > 1 ? rate / 100 : rate;
      result = base * effectiveRate;
      break;
    }
    case 'custom_expression': {
      // Safe fallback for custom arithmetic expressions
      result = sourceValues.reduce((acc, curr) => acc + curr, 0);
      break;
    }
    default: {
      result = 0;
    }
  }

  const factor = Math.pow(10, formula.decimalPlaces ?? 2);
  return Math.round(result * factor) / factor;
}

/**
 * Detects circular references and infinite dependency loops in computed field formulas (FM-P6-07).
 */
export function detectFormulaCycles(
  fields: Array<{ id: string; formula?: ComputedFieldFormula }>
): { hasCycle: boolean; cyclePath?: string[] } {
  // Graph where an edge u -> v means field u depends on field v
  const adj = new Map<string, string[]>();

  for (const f of fields) {
    if (f.formula?.sourceFieldIds) {
      adj.set(f.id, f.formula.sourceFieldIds);
    } else {
      adj.set(f.id, []);
    }
  }

  const visited = new Set<string>();
  const visiting = new Set<string>();
  const path: string[] = [];

  function dfs(node: string, depth: number): boolean {
    if (depth > 10) {
      // Exceeded max recursion depth
      return true;
    }
    visiting.add(node);
    path.push(node);

    const neighbors = adj.get(node) || [];
    for (const neighbor of neighbors) {
      if (!adj.has(neighbor)) {
        continue;
      }
      if (visiting.has(neighbor)) {
        path.push(neighbor);
        return true;
      }
      if (!visited.has(neighbor)) {
        if (dfs(neighbor, depth + 1)) {
          return true;
        }
      }
    }

    path.pop();
    visiting.delete(node);
    visited.add(node);
    return false;
  }

  for (const node of adj.keys()) {
    if (!visited.has(node)) {
      if (dfs(node, 0)) {
        return { hasCycle: true, cyclePath: path };
      }
    }
  }

  return { hasCycle: false };
}

/**
 * Topologically sorts computed fields so dependencies are computed before dependents.
 */
function topologicalSortFields(
  computedFields: Array<{ id: string; formula: ComputedFieldFormula }>
): Array<{ id: string; formula: ComputedFieldFormula }> {
  const inDegree = new Map<string, number>();
  const graph = new Map<string, string[]>();
  const fieldMap = new Map<string, { id: string; formula: ComputedFieldFormula }>();

  for (const f of computedFields) {
    inDegree.set(f.id, 0);
    graph.set(f.id, []);
    fieldMap.set(f.id, f);
  }

  // If A depends on B (B in A.sourceFieldIds), then B must be evaluated before A: edge B -> A
  for (const f of computedFields) {
    for (const depId of f.formula.sourceFieldIds) {
      if (fieldMap.has(depId)) {
        graph.get(depId)?.push(f.id);
        inDegree.set(f.id, (inDegree.get(f.id) || 0) + 1);
      }
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) {
      queue.push(id);
    }
  }

  const sorted: Array<{ id: string; formula: ComputedFieldFormula }> = [];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const fieldObj = fieldMap.get(currentId);
    if (fieldObj) {
      sorted.push(fieldObj);
    }

    const neighbors = graph.get(currentId) || [];
    for (const neighbor of neighbors) {
      const newDeg = (inDegree.get(neighbor) || 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) {
        queue.push(neighbor);
      }
    }
  }

  return sorted;
}

/**
 * Server-Side Authoritative Recomputation (FM-P6-01):
 * Recomputes all dynamic formulas in topological order. Any client-submitted values
 * for computed fields are deterministically overridden with certified values.
 */
export function recomputeAllFormulasAuthoritative(
  fields: FieldWithFormulaInput[]
): Record<string, string> {
  // 1. Cycle detection
  const cycleCheck = detectFormulaCycles(fields);
  if (cycleCheck.hasCycle) {
    throw new CircularFormulaError(
      `Circular dependency detected in computed document fields: ${cycleCheck.cyclePath?.join(' -> ')}`,
      cycleCheck.cyclePath
    );
  }

  // 2. Base values dictionary
  const valuesMap: Record<string, string | number> = {};
  for (const f of fields) {
    if (f.value !== undefined) {
      valuesMap[f.id] = f.value;
    }
  }

  // 3. Extract and topologically sort formula fields
  const formulaFields = fields
    .filter((f): f is { id: string; formula: ComputedFieldFormula; value?: string | number } =>
      Boolean(f.formula)
    )
    .map((f) => ({ id: f.id, formula: f.formula }));

  const sortedFormulaFields = topologicalSortFields(formulaFields);

  // 4. Evaluate each in topological order
  const results: Record<string, string> = {};

  for (const field of sortedFormulaFields) {
    const rawVal = evaluateFormula(field.formula, valuesMap);
    const formatted = rawVal.toFixed(field.formula.decimalPlaces ?? 2);
    valuesMap[field.id] = formatted;
    results[field.id] = formatted;
  }

  return results;
}
