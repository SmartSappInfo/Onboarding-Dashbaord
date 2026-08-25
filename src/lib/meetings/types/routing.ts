/**
 * @fileoverview Domain types for Smart Routing Forms and Conditional Prospect Qualification.
 * Routes prospective leads to matching Event Types, custom URLs, or custom responses based on rules.
 */

import type { BookingQuestion } from '@/lib/types';

export type RoutingConditionOperator = 
  | 'equals' 
  | 'not_equals' 
  | 'contains' 
  | 'not_contains' 
  | 'greater_than' 
  | 'less_than' 
  | 'in_array';

export interface RoutingCondition {
  id: string;
  fieldId: string;
  operator: RoutingConditionOperator;
  value: string | number | string[];
}

export type RoutingDestinationType = 'event_type' | 'custom_url' | 'message';

export interface RoutingDestination {
  type: RoutingDestinationType;
  eventTypeId?: string;
  eventTypeName?: string;
  eventTypeSlug?: string;
  url?: string;
  messageTitle?: string;
  messageBody?: string;
}

export interface RoutingRule {
  id: string;
  name: string;
  conditionLogic: 'and' | 'or';
  conditions: RoutingCondition[];
  destination: RoutingDestination;
  autoTagIds?: string[];
}

export interface RoutingForm {
  id: string;
  workspaceId: string;
  organizationId?: string;
  name: string;
  slug: string;
  description?: string;
  headline?: string;
  subheadline?: string;
  fields: BookingQuestion[];
  rules: RoutingRule[];
  fallbackDestination: RoutingDestination;
  status: 'active' | 'archived';
  autoTagIds?: string[];
  totalSubmissions?: number;
  createdAt: string;
  updatedAt: string;
}

export interface RoutingSubmission {
  id: string;
  formId: string;
  formName: string;
  workspaceId: string;
  organizationId?: string;
  answers: Record<string, string | number | boolean | string[]>;
  evaluatedDestination: RoutingDestination;
  matchedRuleId?: string;
  matchedRuleName?: string;
  contactId?: string;
  submittedAt: string;
}

export interface RoutingEvaluationResult {
  destination: RoutingDestination;
  matchedRule?: RoutingRule;
  appliedTagIds: string[];
}
