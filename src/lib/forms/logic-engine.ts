/**
 * SmartSapp Forms 2.0 Logic Evaluation & DAG Safety Engine
 * 
 * High-performance, memory-safe evaluator for conditional visibility,
 * branching paths, safe arithmetic formulas, and multi-category scoring.
 */

import type {
  LogicCondition,
  LogicConditionGroup,
  FormLogicRule,
  FormCalculationRule,
  FormScoreRule,
  LogicEvaluationResult,
  LogicAction,
} from './form-logic-types';
import type { FormPage } from './form-types';

/**
 * Safely parses and evaluates mathematical arithmetic expressions
 * with variable tokens without using eval() or Function().
 */
export function evaluateSafeFormula(
  formula: string,
  formData: Record<string, unknown>,
  precision = 2
): number | null {
  try {
    if (!formula || typeof formula !== 'string') return null;

    // 1. Replace {{variable_name}} tokens with actual numeric values from formData
    const substituted = formula.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, varName) => {
      const val = formData[varName];
      const num = Number(val);
      return isNaN(num) ? '0' : String(num);
    });

    // 2. Validate arithmetic string against safe whitelist characters: digits, ., +, -, *, /, (, ), %, whitespace
    if (!/^[0-9.+\-*/%()\s]+$/.test(substituted)) {
      return null;
    }

    // 3. Tokenize
    const tokens = substituted.match(/([0-9.]+|[+\-*/%()])/g);
    if (!tokens || tokens.length === 0) return null;

    // 4. Shunting-Yard Algorithm to convert infix tokens to Reverse Polish Notation (RPN)
    const outputQueue: string[] = [];
    const opStack: string[] = [];
    const precedence: Record<string, number> = {
      '+': 1,
      '-': 1,
      '*': 2,
      '/': 2,
      '%': 2,
    };

    for (const token of tokens) {
      if (!isNaN(Number(token))) {
        outputQueue.push(token);
      } else if (token in precedence) {
        while (
          opStack.length > 0 &&
          opStack[opStack.length - 1] in precedence &&
          precedence[opStack[opStack.length - 1]] >= precedence[token]
        ) {
          outputQueue.push(opStack.pop()!);
        }
        opStack.push(token);
      } else if (token === '(') {
        opStack.push(token);
      } else if (token === ')') {
        while (opStack.length > 0 && opStack[opStack.length - 1] !== '(') {
          outputQueue.push(opStack.pop()!);
        }
        opStack.pop(); // Pop '('
      }
    }

    while (opStack.length > 0) {
      outputQueue.push(opStack.pop()!);
    }

    // 5. Evaluate RPN
    const evalStack: number[] = [];
    for (const token of outputQueue) {
      if (!isNaN(Number(token))) {
        evalStack.push(Number(token));
      } else {
        const b = evalStack.pop() ?? 0;
        const a = evalStack.pop() ?? 0;
        switch (token) {
          case '+': evalStack.push(a + b); break;
          case '-': evalStack.push(a - b); break;
          case '*': evalStack.push(a * b); break;
          case '/': evalStack.push(b === 0 ? 0 : a / b); break;
          case '%': evalStack.push(b === 0 ? 0 : a % b); break;
        }
      }
    }

    const rawResult = evalStack.pop();
    if (rawResult === undefined || isNaN(rawResult)) return null;

    const factor = Math.pow(10, precision);
    return Math.round(rawResult * factor) / factor;
  } catch {
    return null;
  }
}

/**
 * Calculates approximate age in years from an ISO date string
 */
function calculateAgeFromDate(dateStr: string): number | null {
  try {
    const birthDate = new Date(dateStr);
    if (isNaN(birthDate.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  } catch {
    return null;
  }
}

/**
 * Evaluates a single comparison condition against runtime form data
 */
export function evaluateCondition(
  condition: LogicCondition,
  formData: Record<string, unknown>,
  fieldAliasMap?: Record<string, string>
): boolean {
  const resolvedKey = formData[condition.fieldId] !== undefined
    ? condition.fieldId
    : (fieldAliasMap ? fieldAliasMap[condition.fieldId] : undefined);
  
  const actualValue = resolvedKey !== undefined ? formData[resolvedKey] : formData[condition.fieldId];
  const expectedValue = condition.value;

  switch (condition.operator) {
    case 'is_empty':
      return actualValue === undefined || actualValue === null || actualValue === '' || (Array.isArray(actualValue) && actualValue.length === 0);
    case 'is_not_empty':
      return actualValue !== undefined && actualValue !== null && actualValue !== '' && (!Array.isArray(actualValue) || actualValue.length > 0);
    case 'equals':
      return String(actualValue ?? '').trim().toLowerCase() === String(expectedValue ?? '').trim().toLowerCase();
    case 'not_equals':
      return String(actualValue ?? '').trim().toLowerCase() !== String(expectedValue ?? '').trim().toLowerCase();
    case 'contains':
      if (Array.isArray(actualValue)) {
        return actualValue.some(v => String(v).trim().toLowerCase() === String(expectedValue ?? '').trim().toLowerCase());
      }
      return String(actualValue ?? '').toLowerCase().includes(String(expectedValue ?? '').toLowerCase());
    case 'not_contains':
      if (Array.isArray(actualValue)) {
        return !actualValue.some(v => String(v).trim().toLowerCase() === String(expectedValue ?? '').trim().toLowerCase());
      }
      return !String(actualValue ?? '').toLowerCase().includes(String(expectedValue ?? '').toLowerCase());
    case 'starts_with':
      return String(actualValue ?? '').toLowerCase().startsWith(String(expectedValue ?? '').toLowerCase());
    case 'ends_with':
      return String(actualValue ?? '').toLowerCase().endsWith(String(expectedValue ?? '').toLowerCase());
    case 'greater_than':
      return Number(actualValue) > Number(expectedValue);
    case 'less_than':
      return Number(actualValue) < Number(expectedValue);
    case 'greater_than_or_equal':
      return Number(actualValue) >= Number(expectedValue);
    case 'less_than_or_equal':
      return Number(actualValue) <= Number(expectedValue);
    case 'between': {
      const num = Number(actualValue);
      const min = Number(expectedValue);
      const max = Number(condition.secondaryValue);
      return !isNaN(num) && !isNaN(min) && !isNaN(max) && num >= min && num <= max;
    }
    case 'not_between': {
      const num = Number(actualValue);
      const min = Number(expectedValue);
      const max = Number(condition.secondaryValue);
      return !isNaN(num) && !isNaN(min) && !isNaN(max) && (num < min || num > max);
    }
    case 'in_list': {
      const list = Array.isArray(expectedValue) ? expectedValue : String(expectedValue || '').split(',').map(s => s.trim().toLowerCase());
      return list.includes(String(actualValue ?? '').trim().toLowerCase());
    }
    case 'not_in_list': {
      const list = Array.isArray(expectedValue) ? expectedValue : String(expectedValue || '').split(',').map(s => s.trim().toLowerCase());
      return !list.includes(String(actualValue ?? '').trim().toLowerCase());
    }
    case 'regex_matches':
      try {
        const regex = new RegExp(String(expectedValue || ''));
        return regex.test(String(actualValue ?? ''));
      } catch {
        return false;
      }
    case 'date_is_before':
      return new Date(String(actualValue)).getTime() < new Date(String(expectedValue)).getTime();
    case 'date_is_after':
      return new Date(String(actualValue)).getTime() > new Date(String(expectedValue)).getTime();
    case 'date_is_today': {
      const d1 = new Date(String(actualValue));
      const today = new Date();
      return d1.toDateString() === today.toDateString();
    }
    case 'age_greater_than': {
      const age = calculateAgeFromDate(String(actualValue));
      return age !== null && age > Number(expectedValue);
    }
    case 'age_less_than': {
      const age = calculateAgeFromDate(String(actualValue));
      return age !== null && age < Number(expectedValue);
    }
    default:
      return false;
  }
}

/**
 * Evaluates a composite condition group with AND/OR combinators and optional negation
 */
export function evaluateConditionGroup(
  group: LogicConditionGroup,
  formData: Record<string, unknown>,
  fieldAliasMap?: Record<string, string>
): boolean {
  if (!group.conditions || group.conditions.length === 0) return true;

  let result = false;
  if (group.combinator === 'OR') {
    result = group.conditions.some(cond => evaluateCondition(cond, formData, fieldAliasMap));
  } else {
    result = group.conditions.every(cond => evaluateCondition(cond, formData, fieldAliasMap));
  }

  return group.not ? !result : result;
}

/**
 * Validates a list of rules for circular jumps and unreachable pages using DAG analysis
 */
export function detectLogicCycles(
  pages: FormPage[],
  rules: FormLogicRule[]
): { hasCycle: boolean; cyclePath?: string[]; unreachablePageIds?: string[]; error?: string } {
  if (!pages || pages.length === 0) return { hasCycle: false };

  const pageOrderMap = new Map<string, number>();
  pages.forEach((p, idx) => pageOrderMap.set(p.id, idx));

  // Build adjacency list for jump actions
  const adjList = new Map<string, Set<string>>();
  pages.forEach(p => adjList.set(p.id, new Set<string>()));

  // Default forward edge between consecutive pages
  for (let i = 0; i < pages.length - 1; i++) {
    adjList.get(pages[i].id)?.add(pages[i + 1].id);
  }

  // Add explicit branching jump edges from actions and elseActions
  for (const rule of rules) {
    if (!rule.enabled) continue;
    const allActions = [...rule.actions, ...(rule.elseActions || [])];
    for (const action of allActions) {
      if (action.type === 'jump_to_page' && action.targetPageId) {
        // Find which page contains the trigger field
        const triggerFieldId = rule.conditionGroup.conditions[0]?.fieldId;
        const sourcePage = pages.find(p =>
          p.components.some(c => c.fieldId === triggerFieldId || c.field?.id === triggerFieldId)
        );
        if (sourcePage && adjList.has(sourcePage.id)) {
          adjList.get(sourcePage.id)?.add(action.targetPageId);
        }
      }
    }
  }

  // Tarjan / DFS Cycle Detection
  const visited = new Set<string>();
  const recStack = new Set<string>();
  const path: string[] = [];

  function dfs(pageId: string): boolean {
    visited.add(pageId);
    recStack.add(pageId);
    path.push(pageId);

    const neighbors = adjList.get(pageId) || new Set<string>();
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true;
      } else if (recStack.has(neighbor)) {
        path.push(neighbor);
        return true;
      }
    }

    recStack.delete(pageId);
    path.pop();
    return false;
  }

  for (const page of pages) {
    if (!visited.has(page.id)) {
      if (dfs(page.id)) {
        return {
          hasCycle: true,
          cyclePath: path,
          error: `Circular logic jump detected along path: ${path.join(' -> ')}`,
        };
      }
    }
  }

  return { hasCycle: false };
}

/**
 * Executes a list of actions on the evaluation state
 */
function applyActionsToState(
  actions: LogicAction[],
  formData: Record<string, unknown>,
  state: {
    hiddenFieldIds: Set<string>;
    disabledFieldIds: Set<string>;
    requiredFieldIds: Set<string>;
    overrideValues: Record<string, unknown>;
    labelOverrides: Record<string, string>;
    helpTextOverrides: Record<string, string>;
    optionsOverrides: Record<string, { label: string; value: string }[]>;
    hiddenPageIds: Set<string>;
    nextPageId?: string;
    isDisqualified: boolean;
    disqualificationMessage?: string;
    totalScore: number;
    scoreBreakdown: Record<string, number>;
    activeMessages: string[];
    appliedTags: string[];
  }
) {
  for (const action of actions) {
    switch (action.type) {
      case 'hide_field':
        if (action.targetFieldId) state.hiddenFieldIds.add(action.targetFieldId);
        break;
      case 'show_field':
        if (action.targetFieldId) state.hiddenFieldIds.delete(action.targetFieldId);
        break;
      case 'disable_field':
        if (action.targetFieldId) state.disabledFieldIds.add(action.targetFieldId);
        break;
      case 'enable_field':
        if (action.targetFieldId) state.disabledFieldIds.delete(action.targetFieldId);
        break;
      case 'require_field':
        if (action.targetFieldId) state.requiredFieldIds.add(action.targetFieldId);
        break;
      case 'optional_field':
        if (action.targetFieldId) state.requiredFieldIds.delete(action.targetFieldId);
        break;
      case 'set_value':
        if (action.targetFieldId && action.value !== undefined) {
          state.overrideValues[action.targetFieldId] = action.value;
        }
        break;
      case 'clear_value':
        if (action.targetFieldId) {
          state.overrideValues[action.targetFieldId] = '';
        }
        break;
      case 'set_label':
        if (action.targetFieldId && action.textOverride) {
          state.labelOverrides[action.targetFieldId] = action.textOverride;
        }
        break;
      case 'set_help_text':
        if (action.targetFieldId && action.textOverride) {
          state.helpTextOverrides[action.targetFieldId] = action.textOverride;
        }
        break;
      case 'set_options':
        if (action.targetFieldId && action.optionsOverride) {
          state.optionsOverrides[action.targetFieldId] = action.optionsOverride;
        }
        break;
      case 'hide_page':
        if (action.targetPageId) state.hiddenPageIds.add(action.targetPageId);
        break;
      case 'show_page':
        if (action.targetPageId) state.hiddenPageIds.delete(action.targetPageId);
        break;
      case 'jump_to_page':
        if (action.targetPageId) state.nextPageId = action.targetPageId;
        break;
      case 'terminate_disqualified':
        state.isDisqualified = true;
        if (action.message) state.disqualificationMessage = action.message;
        break;
      case 'calculate_formula':
        if (action.targetFieldId && action.formula) {
          const calcVal = evaluateSafeFormula(action.formula, formData);
          if (calcVal !== null) {
            state.overrideValues[action.targetFieldId] = calcVal;
          }
        }
        break;
      case 'add_score': {
        const delta = action.scoreDelta || 0;
        state.totalScore += delta;
        const cat = action.scoreCategory || 'general';
        state.scoreBreakdown[cat] = (state.scoreBreakdown[cat] || 0) + delta;
        break;
      }
      case 'subtract_score': {
        const delta = action.scoreDelta || 0;
        state.totalScore -= delta;
        const cat = action.scoreCategory || 'general';
        state.scoreBreakdown[cat] = (state.scoreBreakdown[cat] || 0) - delta;
        break;
      }
      case 'assign_tag':
        if (action.tagId && !state.appliedTags.includes(action.tagId)) {
          state.appliedTags.push(action.tagId);
        }
        break;
      case 'show_message':
        if (action.message) state.activeMessages.push(action.message);
        break;
    }
  }
}

/**
 * Main evaluation loop: executes all visibility rules, calculations,
 * scoring models, and branching paths in a single pass.
 */
export function evaluateFormLogic(
  rules: FormLogicRule[],
  scoreRules: FormScoreRule[],
  calculations: FormCalculationRule[],
  formData: Record<string, unknown>,
  fieldAliasMap?: Record<string, string>
): LogicEvaluationResult {
  const state: LogicEvaluationResult = {
    hiddenFieldIds: new Set<string>(),
    disabledFieldIds: new Set<string>(),
    requiredFieldIds: new Set<string>(),
    overrideValues: {},
    labelOverrides: {},
    helpTextOverrides: {},
    optionsOverrides: {},
    hiddenPageIds: new Set<string>(),
    isDisqualified: false,
    totalScore: 0,
    scoreBreakdown: {},
    activeMessages: [],
    appliedTags: [],
  };

  // 1. Process Calculation Rules First
  for (const calc of calculations) {
    if (!calc.enabled) continue;
    const calcVal = evaluateSafeFormula(calc.formula, formData, calc.precision || 2);
    if (calcVal !== null) {
      let finalVal: string | number = calcVal;
      if (calc.prefix || calc.suffix) {
        finalVal = `${calc.prefix || ''}${calcVal}${calc.suffix || ''}`;
      }
      state.overrideValues[calc.targetFieldId] = finalVal;
    }
  }

  // 2. Sort Logic Rules by Priority and Evaluate
  const sortedRules = [...rules]
    .filter(r => r.enabled)
    .sort((a, b) => (a.priority || 0) - (b.priority || 0));

  for (const rule of sortedRules) {
    const isMatch = evaluateConditionGroup(
      rule.conditionGroup,
      {
        ...formData,
        ...state.overrideValues,
      },
      fieldAliasMap
    );

    if (isMatch) {
      applyActionsToState(rule.actions, formData, state);
    } else if (rule.elseActions && rule.elseActions.length > 0) {
      applyActionsToState(rule.elseActions, formData, state);
    }
  }

  // 3. Evaluate Scoring Rules
  for (const sr of scoreRules) {
    if (
      evaluateConditionGroup(
        sr.conditionGroup,
        { ...formData, ...state.overrideValues },
        fieldAliasMap
      )
    ) {
      state.totalScore += sr.scoreDelta || 0;
      const cat = sr.category || 'general';
      state.scoreBreakdown[cat] = (state.scoreBreakdown[cat] || 0) + (sr.scoreDelta || 0);
    }
  }

  return state;
}
