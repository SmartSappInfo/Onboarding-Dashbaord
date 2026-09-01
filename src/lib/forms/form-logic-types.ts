/**
 * SmartSapp Forms 2.0 Logic & Conditional Branching Types
 * 
 * Defines comprehensive domain models for conditional visibility,
 * page branching paths, dynamic arithmetic calculations, multi-category scoring,
 * and reactive expression evaluation.
 */

export type LogicComparisonOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'between'
  | 'not_between'
  | 'is_empty'
  | 'is_not_empty'
  | 'in_list'
  | 'not_in_list'
  | 'regex_matches'
  | 'date_is_before'
  | 'date_is_after'
  | 'date_is_today'
  | 'age_greater_than'
  | 'age_less_than';

export type LogicActionType =
  | 'show_field'
  | 'hide_field'
  | 'enable_field'
  | 'disable_field'
  | 'require_field'
  | 'optional_field'
  | 'set_value'
  | 'clear_value'
  | 'set_label'
  | 'set_help_text'
  | 'set_options'
  | 'show_page'
  | 'hide_page'
  | 'jump_to_page'
  | 'skip_to_end'
  | 'terminate_disqualified'
  | 'calculate_formula'
  | 'add_score'
  | 'subtract_score'
  | 'assign_tag'
  | 'show_message';

export interface LogicCondition {
  id: string;
  fieldId: string;
  operator: LogicComparisonOperator;
  value?: string | number | boolean | string[];
  secondaryValue?: string | number; // Used for between/not_between range bounds
}

export interface LogicConditionGroup {
  id: string;
  combinator: 'AND' | 'OR';
  not?: boolean;
  conditions: LogicCondition[];
}

export interface LogicAction {
  id: string;
  type: LogicActionType;
  targetFieldId?: string;
  targetPageId?: string;
  value?: string | number | boolean;
  textOverride?: string; // For set_label or set_help_text
  optionsOverride?: { label: string; value: string }[];
  formula?: string; // For calculate_formula
  scoreDelta?: number;
  scoreCategory?: string;
  tagId?: string;
  message?: string;
}

export interface FormLogicRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  priority: number;
  conditionGroup: LogicConditionGroup;
  actions: LogicAction[];
  elseActions?: LogicAction[]; // Fallback actions executed when condition is false
}

export interface FormCalculationRule {
  id: string;
  name: string;
  targetFieldId: string;
  formula: string; // e.g. "{{quantity}} * {{unit_price}} * (1 - {{discount}} / 100)"
  precision?: number;
  roundingMode?: 'round' | 'floor' | 'ceil';
  prefix?: string; // e.g. "$"
  suffix?: string; // e.g. " USD"
  enabled: boolean;
}

export interface ScoreCategoryDefinition {
  id: string;
  name: string;
  description?: string;
  targetWeight?: number;
  badgeColor?: string;
}

export interface FormScoreRule {
  id: string;
  name: string;
  conditionGroup: LogicConditionGroup;
  scoreDelta: number;
  category?: string;
}

export interface LogicEvaluationResult {
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
