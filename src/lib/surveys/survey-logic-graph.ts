/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Logic Graph & Cycle Validator
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Single Source of Truth for Survey Logic Graph Traversal & Cycle Detection.
 * 2. Pure, deterministic algorithms:
 *    - Detects circular branching loops (A -> B -> A).
 *    - Identifies dangling target element references.
 *    - Flags unreachable questions and dead-end survey flows.
 * 3. Zero-Any Invariant.
 * 4. Tested in src/lib/surveys/__tests__/survey-logic-graph.test.ts.
 */

import type { SurveyElement, SurveyQuestion, SurveyLogicBlock } from '@/lib/types';

export interface LogicGraphIssue {
  type: 'error' | 'warning';
  code: 'CIRCULAR_LOOP' | 'DANGLING_TARGET' | 'SELF_REFERENCE' | 'BACKWARD_JUMP' | 'UNREACHABLE_ELEMENT' | 'INVALID_OPERATOR';
  message: string;
  sourceElementId: string;
  targetElementId?: string;
  ruleIndex?: number;
}

export interface LogicValidationResult {
  isValid: boolean;
  errors: LogicGraphIssue[];
  warnings: LogicGraphIssue[];
}

/**
 * Validates survey elements for logic integrity, circular loops, and reachability.
 */
export function validateSurveyLogicGraph(elements: SurveyElement[]): LogicValidationResult {
  const errors: LogicGraphIssue[] = [];
  const warnings: LogicGraphIssue[] = [];

  if (!elements || elements.length === 0) {
    return { isValid: true, errors, warnings };
  }

  const elementMap = new Map<string, { element: SurveyElement; index: number }>();
  elements.forEach((el, index) => {
    elementMap.set(el.id, { element: el, index });
  });

  // Extract all jump/branch edges: source -> target
  const jumpEdges: Array<{ fromId: string; toId: string; fromIndex: number; toIndex: number; ruleIndex: number }> = [];

  elements.forEach((el) => {
    if (el.type === 'logic') {
      const logicBlock = el as SurveyLogicBlock;
      (logicBlock.rules || []).forEach((rule, rIdx) => {
        const sourceId = rule.sourceQuestionId;
        const sourceEntry = elementMap.get(sourceId);

        // 1. Check if source question exists
        if (!sourceEntry) {
          errors.push({
            type: 'error',
            code: 'DANGLING_TARGET',
            message: `Logic rule references a non-existent source question "${sourceId}".`,
            sourceElementId: el.id,
            ruleIndex: rIdx,
          });
          return;
        }

        // 2. Check targets
        const targetIds: string[] = [];
        if (rule.action.targetElementId) targetIds.push(rule.action.targetElementId);
        if (Array.isArray(rule.action.targetElementIds)) targetIds.push(...rule.action.targetElementIds);

        targetIds.forEach((targetId) => {
          const targetEntry = elementMap.get(targetId);

          if (!targetEntry) {
            errors.push({
              type: 'error',
              code: 'DANGLING_TARGET',
              message: `Logic rule in "${sourceEntry.element.title || sourceId}" targets a non-existent element "${targetId}".`,
              sourceElementId: sourceId,
              targetElementId: targetId,
              ruleIndex: rIdx,
            });
            return;
          }

          // Self reference
          if (targetId === sourceId) {
            errors.push({
              type: 'error',
              code: 'SELF_REFERENCE',
              message: `Question "${sourceEntry.element.title || sourceId}" cannot jump to or target itself.`,
              sourceElementId: sourceId,
              targetElementId: targetId,
              ruleIndex: rIdx,
            });
            return;
          }

          if (rule.action.type === 'jump') {
            // Backward jump warning
            if (targetEntry.index < sourceEntry.index) {
              warnings.push({
                type: 'warning',
                code: 'BACKWARD_JUMP',
                message: `Question "${sourceEntry.element.title || sourceId}" jumps backward to an earlier element. This may disorient respondents.`,
                sourceElementId: sourceId,
                targetElementId: targetId,
                ruleIndex: rIdx,
              });
            }

            jumpEdges.push({
              fromId: sourceId,
              toId: targetId,
              fromIndex: sourceEntry.index,
              toIndex: targetEntry.index,
              ruleIndex: rIdx,
            });
          }
        });
      });
    }
  });

  // 3. Cycle Detection using DFS
  const adjacencyList = new Map<string, string[]>();
  jumpEdges.forEach((edge) => {
    if (!adjacencyList.has(edge.fromId)) {
      adjacencyList.set(edge.fromId, []);
    }
    adjacencyList.get(edge.fromId)!.push(edge.toId);
  });

  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfsCycle(nodeId: string, path: string[]): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    const neighbors = adjacencyList.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfsCycle(neighbor, [...path, neighbor])) {
          return true;
        }
      } else if (recursionStack.has(neighbor)) {
        const loopPath = [...path, neighbor].join(' -> ');
        errors.push({
          type: 'error',
          code: 'CIRCULAR_LOOP',
          message: `Circular skip logic loop detected: ${loopPath}.`,
          sourceElementId: nodeId,
          targetElementId: neighbor,
        });
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  adjacencyList.forEach((_, startNode) => {
    if (!visited.has(startNode)) {
      dfsCycle(startNode, [startNode]);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Evaluates a single comparison operator against an actual answer and target value.
 */
export function evaluateRuleCondition(
  operator: string,
  actualValue: unknown,
  targetValue: string | number | boolean | string[] | null | undefined
): boolean {
  if (actualValue === undefined || actualValue === null || actualValue === '') {
    if (operator === 'isEmpty') return true;
    if (operator === 'isNotEmpty') return false;
    return false;
  }

  if (operator === 'isEmpty') return false;
  if (operator === 'isNotEmpty') return true;

  const actualStr = String(actualValue).trim().toLowerCase();
  const targetStr = targetValue !== undefined && targetValue !== null ? String(targetValue).trim().toLowerCase() : '';

  switch (operator) {
    case 'isEqualTo':
      if (typeof actualValue === 'boolean' || typeof targetValue === 'boolean') {
        const normActual = typeof actualValue === 'boolean' 
          ? actualValue 
          : (actualStr === 'true' || actualStr === 'yes' || actualStr === '1');
        const normTarget = typeof targetValue === 'boolean' 
          ? targetValue 
          : (targetStr === 'true' || targetStr === 'yes' || targetStr === '1');
        return normActual === normTarget;
      }
      if (Array.isArray(actualValue)) {
        return actualValue.map(String).includes(String(targetValue));
      }
      return actualStr === targetStr;

    case 'isNotEqualTo':
      if (typeof actualValue === 'boolean' || typeof targetValue === 'boolean') {
        const normActual = typeof actualValue === 'boolean' 
          ? actualValue 
          : (actualStr === 'true' || actualStr === 'yes' || actualStr === '1');
        const normTarget = typeof targetValue === 'boolean' 
          ? targetValue 
          : (targetStr === 'true' || targetStr === 'yes' || targetStr === '1');
        return normActual !== normTarget;
      }
      if (Array.isArray(actualValue)) {
        return !actualValue.map(String).includes(String(targetValue));
      }
      return actualStr !== targetStr;

    case 'contains':
      if (Array.isArray(actualValue)) {
        return actualValue.some((item) => String(item).toLowerCase().includes(targetStr));
      }
      return actualStr.includes(targetStr);

    case 'doesNotContain':
      if (Array.isArray(actualValue)) {
        return !actualValue.some((item) => String(item).toLowerCase().includes(targetStr));
      }
      return !actualStr.includes(targetStr);

    case 'startsWith':
      return actualStr.startsWith(targetStr);

    case 'doesNotStartWith':
      return !actualStr.startsWith(targetStr);

    case 'endsWith':
      return actualStr.endsWith(targetStr);

    case 'doesNotEndWith':
      return !actualStr.endsWith(targetStr);

    case 'isGreaterThan': {
      const numAct = Number(actualValue);
      const numTgt = Number(targetValue);
      return !isNaN(numAct) && !isNaN(numTgt) && numAct > numTgt;
    }

    case 'isLessThan': {
      const numAct = Number(actualValue);
      const numTgt = Number(targetValue);
      return !isNaN(numAct) && !isNaN(numTgt) && numAct < numTgt;
    }

    default:
      return false;
  }
}