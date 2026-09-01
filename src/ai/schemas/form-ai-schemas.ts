/**
 * SmartSapp Forms 2.0 AI Schemas
 * 
 * Shared Zod schemas for AI Form Generation, in-canvas AI Copilot suggestions,
 * logic rule synthesis, friction audits, and question copy refinement.
 * 
 * Aligned 1:1 with canonical domain schemas in src/lib/forms/form-types.ts,
 * src/lib/forms/form-logic-types.ts, and src/lib/types.ts.
 */

import { z } from 'genkit';

// ──────────────────────────────────────────────────────────
// Canonical Enums
// ──────────────────────────────────────────────────────────

export const FORM_PURPOSES = [
  'lead_capture',
  'contact',
  'qualification',
  'application',
  'registration',
  'onboarding',
  'feedback',
  'assessment',
  'research',
  'booking_intake',
  'payment',
  'support',
  'internal_request',
  'data_update',
  'custom'
] as const;

export const AUDIENCE_MODES = [
  'anonymous',
  'known_contact',
  'crm_bound',
  'authenticated',
  'mixed'
] as const;

export const FIELD_TYPES = [
  'short_text',
  'long_text',
  'select',
  'multi_select',
  'radio',
  'checkbox',
  'number',
  'email',
  'phone',
  'date',
  'time',
  'file',
  'rating',
  'yes_no',
  'url'
] as const;

export const LOGIC_COMPARISON_OPERATORS = [
  'equals',
  'not_equals',
  'contains',
  'not_contains',
  'starts_with',
  'ends_with',
  'greater_than',
  'less_than',
  'greater_than_or_equal',
  'less_than_or_equal',
  'is_empty',
  'is_not_empty'
] as const;

export const LOGIC_ACTIONS = [
  'show_field',
  'hide_field',
  'enable_field',
  'disable_field',
  'require_field',
  'optional_field',
  'jump_to_page',
  'skip_to_end',
  'apply_crm_tag'
] as const;

// ──────────────────────────────────────────────────────────
// Step 1: Form Generation Schemas
// ──────────────────────────────────────────────────────────

export const FormComponentGeneratedSchema = z.object({
  id: z.string().describe('Unique kebab-case component ID, e.g. comp_email or comp_full_name'),
  pageId: z.string().describe('ID of the page this component belongs to'),
  type: z.enum(FIELD_TYPES).describe('Canonical field semantic type'),
  label: z.string().describe('Display label for the respondent'),
  placeholder: z.string().optional().describe('Input placeholder text'),
  helpText: z.string().optional().describe('Optional helper or guidance text'),
  isRequired: z.boolean().default(false).describe('Whether answering this field is mandatory'),
  options: z.array(z.object({
    label: z.string().describe('Option title visible to user'),
    value: z.string().describe('Option value stored in database')
  })).optional().describe('Selectable options for select, radio, or checkbox fields'),
  appFieldId: z.string().optional().describe('Matched workspace AppField ID if semantically bound'),
  scoringPoints: z.number().optional().describe('Optional point weight for lead scoring'),
});

export const FormPageGeneratedSchema = z.object({
  id: z.string().describe('Unique kebab-case page ID, e.g. page_intro or page_qualification'),
  title: z.string().describe('Display title for this step/page'),
  subtitle: z.string().optional().describe('Optional page subtitle or instruction'),
  order: z.number().describe('Sequential 0-indexed page order'),
});

export const FormLogicConditionGeneratedSchema = z.object({
  fieldId: z.string().describe('Component ID that triggers the condition'),
  operator: z.enum(LOGIC_COMPARISON_OPERATORS).describe('Comparison operator'),
  value: z.union([z.string(), z.number(), z.boolean()]).describe('Target value for condition evaluation'),
});

export const FormLogicRuleGeneratedSchema = z.object({
  id: z.string().describe('Unique rule ID, e.g. rule_show_boarding_options'),
  name: z.string().describe('Human readable name for this rule'),
  conditionGroup: z.object({
    operator: z.enum(['AND', 'OR']),
    conditions: z.array(FormLogicConditionGeneratedSchema),
  }),
  actions: z.array(z.object({
    type: z.enum(LOGIC_ACTIONS),
    targetFieldId: z.string().optional().describe('Target field ID if modifying field state'),
    targetPageId: z.string().optional().describe('Target page ID if jumping pages'),
    tagValue: z.string().optional().describe('Tag name if applying CRM tag'),
  })),
});

export const GenerateFormInputSchema = z.object({
  prompt: z.string().describe('Natural language prompt describing what form to build'),
  workspaceId: z.string().describe('Target workspace identifier'),
  organizationId: z.string().optional(),
  purpose: z.enum(FORM_PURPOSES).optional().default('lead_capture'),
  audienceMode: z.enum(AUDIENCE_MODES).optional().default('anonymous'),
  tone: z.enum(['professional', 'friendly', 'academic', 'modern']).optional().default('professional'),
  pageMode: z.enum(['auto', 'single', 'multi']).optional().default('auto'),
  enableScoring: z.boolean().optional().default(false),
  availableAppFields: z.array(z.object({
    id: z.string(),
    label: z.string(),
    variableName: z.string(),
    type: z.string()
  })).optional().describe('Available workspace CRM fields for semantic binding'),
});
export type GenerateFormInput = z.infer<typeof GenerateFormInputSchema>;

export const GenerateFormOutputSchema = z.object({
  title: z.string().describe('Concise, professional title for the form (max 60 chars)'),
  description: z.string().describe('Warm, clear 1-2 sentence introduction for respondents'),
  formPurpose: z.enum(FORM_PURPOSES).describe('Form purpose classification'),
  audienceMode: z.enum(AUDIENCE_MODES).describe('Audience mode'),
  pages: z.array(FormPageGeneratedSchema).describe('Multi-page or single-page layout structure'),
  components: z.array(FormComponentGeneratedSchema).describe('All form question & input components'),
  logicRules: z.array(FormLogicRuleGeneratedSchema).optional().default([]).describe('Conditional branching and jump logic'),
  successMessage: z.string().default('Thank you for your submission! Your response has been recorded.'),
  suggestedNotifications: z.object({
    sendConfirmationReceipt: z.boolean().default(true),
    alertDealOwner: z.boolean().default(true),
    confirmationSubject: z.string().default('Thank you for your submission'),
  }).optional(),
});
export type GenerateFormOutput = z.infer<typeof GenerateFormOutputSchema>;

// ──────────────────────────────────────────────────────────
// Step 2: Question Suggestions Schemas
// ──────────────────────────────────────────────────────────

export const SuggestQuestionsInputSchema = z.object({
  formTitle: z.string(),
  formDescription: z.string().optional(),
  existingQuestions: z.array(z.object({
    id: z.string(),
    label: z.string(),
    type: z.string(),
  })),
  contextPrompt: z.string().optional().describe('Optional guidance, e.g. "Add questions for dietary preferences"'),
});
export type SuggestQuestionsInput = z.infer<typeof SuggestQuestionsInputSchema>;

export const SuggestQuestionsOutputSchema = z.object({
  suggestions: z.array(z.object({
    id: z.string(),
    label: z.string().describe('Suggested question label'),
    type: z.enum(FIELD_TYPES).describe('Recommended field type'),
    placeholder: z.string().optional(),
    helpText: z.string().optional(),
    isRequired: z.boolean().default(false),
    options: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
    rationale: z.string().describe('Why this question improves the form flow or lead data'),
  })).describe('Array of 3-5 suggested next questions'),
});
export type SuggestQuestionsOutput = z.infer<typeof SuggestQuestionsOutputSchema>;

// ──────────────────────────────────────────────────────────
// Step 3: Form Friction & UX Audit Schemas
// ──────────────────────────────────────────────────────────

export const FormFrictionAuditInputSchema = z.object({
  formTitle: z.string(),
  pagesCount: z.number(),
  questions: z.array(z.object({
    id: z.string(),
    label: z.string(),
    type: z.string(),
    isRequired: z.boolean(),
  })),
});
export type FormFrictionAuditInput = z.infer<typeof FormFrictionAuditInputSchema>;

export const FormFrictionAuditOutputSchema = z.object({
  healthScore: z.number().min(0).max(100).describe('Overall UX & conversion health score (0-100)'),
  estimatedCompletionSeconds: z.number().describe('Estimated seconds for respondent to complete'),
  readabilityLevel: z.enum(['simple', 'moderate', 'complex']).describe('Reading level assessment'),
  strengths: z.array(z.string()).describe('Positive aspects of the form layout'),
  frictionPoints: z.array(z.object({
    severity: z.enum(['low', 'medium', 'high']),
    fieldId: z.string().optional(),
    issue: z.string().describe('Identified drop-off friction point'),
    suggestion: z.string().describe('Concrete recommendation to fix'),
  })).describe('Identified issues causing drop-off or hesitation'),
  suggestedOptimizations: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    actionType: z.enum(['remove_field', 'make_optional', 'split_page', 'rephrase_label']),
    targetFieldId: z.string().optional(),
  })).describe('1-click actionable optimization proposals'),
});
export type FormFrictionAuditOutput = z.infer<typeof FormFrictionAuditOutputSchema>;

// ──────────────────────────────────────────────────────────
// Step 4: Logic Rule Synthesizer Schemas
// ──────────────────────────────────────────────────────────

export const SynthesizeLogicInputSchema = z.object({
  instruction: z.string().describe('Plain English instruction, e.g. "If applicant selects boarding, show room preference"'),
  availableFields: z.array(z.object({
    id: z.string(),
    label: z.string(),
    type: z.string(),
    options: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
  })),
  availablePages: z.array(z.object({
    id: z.string(),
    title: z.string(),
  })).optional(),
});
export type SynthesizeLogicInput = z.infer<typeof SynthesizeLogicInputSchema>;

export const SynthesizeLogicOutputSchema = z.object({
  rules: z.array(FormLogicRuleGeneratedSchema).describe('Synthesized logic rules'),
  explanation: z.string().describe('Plain English explanation of how the logic will evaluate'),
});
export type SynthesizeLogicOutput = z.infer<typeof SynthesizeLogicOutputSchema>;

// ──────────────────────────────────────────────────────────
// Step 5: Question Copy Refinement Schemas
// ──────────────────────────────────────────────────────────

export const RewriteCopyInputSchema = z.object({
  label: z.string(),
  placeholder: z.string().optional(),
  helpText: z.string().optional(),
  targetTone: z.enum(['professional', 'friendly', 'concise', 'accessible']),
});
export type RewriteCopyInput = z.infer<typeof RewriteCopyInputSchema>;

export const RewriteCopyOutputSchema = z.object({
  label: z.string(),
  placeholder: z.string().optional(),
  helpText: z.string().optional(),
  toneExplanation: z.string().describe('Brief rationale for the phrasing changes'),
});
export type RewriteCopyOutput = z.infer<typeof RewriteCopyOutputSchema>;
