/**
 * SmartSapp Forms 2.0 AI Assistant & Generator Types
 * 
 * Defines domain models for AI Form synthesis, suggestion engines,
 * friction auditing, and copilot actions.
 */

import type { FormPurpose, AudienceMode } from './form-types';
import type { FormLogicRule } from './form-logic-types';

export interface GenerateFormActionPayload {
  prompt: string;
  workspaceId: string;
  organizationId?: string;
  userId: string;
  purpose?: FormPurpose;
  audienceMode?: AudienceMode;
  tone?: 'professional' | 'friendly' | 'academic' | 'modern';
  pageMode?: 'auto' | 'single' | 'multi';
  enableScoring?: boolean;
}

export interface GeneratedFormResponse {
  success: boolean;
  formId?: string;
  slug?: string;
  title?: string;
  error?: string;
}

export interface QuestionSuggestion {
  id: string;
  label: string;
  type: string;
  placeholder?: string;
  helpText?: string;
  isRequired: boolean;
  options?: Array<{ label: string; value: string }>;
  rationale: string;
}

export interface FormFrictionReport {
  healthScore: number;
  estimatedCompletionSeconds: number;
  readabilityLevel: 'simple' | 'moderate' | 'complex';
  strengths: string[];
  frictionPoints: Array<{
    severity: 'low' | 'medium' | 'high';
    fieldId?: string;
    issue: string;
    suggestion: string;
  }>;
  suggestedOptimizations: Array<{
    id: string;
    title: string;
    description: string;
    actionType: 'remove_field' | 'make_optional' | 'split_page' | 'rephrase_label';
    targetFieldId?: string;
  }>;
}

export interface SynthesizedLogicResult {
  rules: FormLogicRule[];
  explanation: string;
}

export interface QuestionCopyRefinement {
  label: string;
  placeholder?: string;
  helpText?: string;
  toneExplanation: string;
}
