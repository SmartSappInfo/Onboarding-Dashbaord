// This file intentionally does NOT have 'use server' — it exports
// constants and Zod schemas (objects), not server actions.

/**
 * @fileOverview Shared Zod schemas for all AI survey flows.
 * 
 * SINGLE SOURCE OF TRUTH — These schemas are aligned 1:1 with the TypeScript
 * interfaces in src/lib/types.ts (SurveyQuestion, SurveyLayoutBlock, SurveyLogicBlock,
 * SurveyResultBlock, SurveyResultRule, SurveyResultPage).
 * 
 * Imported by:
 * - generate-survey-chunked-flow.ts (three-phase pipeline)
 * - modify-survey-flow.ts (chat-based editing)
 * - generate-survey-flow.ts (legacy monolithic — deprecated)
 */

import { z } from 'genkit';

// ──────────────────────────────────────────────────────────
// Canonical Enums (must match types.ts exactly)
// ──────────────────────────────────────────────────────────

export const QUESTION_TYPES = [
  'text', 'long-text', 'yes-no', 'multiple-choice', 'checkboxes',
  'dropdown', 'rating', 'date', 'time', 'file-upload', 'email', 'phone'
] as const;

export const LAYOUT_TYPES = [
  'heading', 'description', 'divider', 'image', 'video',
  'audio', 'document', 'embed', 'section'
] as const;

export const RESULT_BLOCK_TYPES = [
  'heading', 'text', 'image', 'video', 'button', 'quote',
  'divider', 'score-card', 'list', 'logo', 'header', 'footer'
] as const;

export const LOGIC_OPERATORS = [
  'isEqualTo', 'isNotEqualTo', 'contains', 'doesNotContain',
  'startsWith', 'doesNotStartWith', 'endsWith', 'doesNotEndWith',
  'isEmpty', 'isNotEmpty', 'isGreaterThan', 'isLessThan'
] as const;

export const LOGIC_ACTIONS = [
  'jump', 'require', 'show', 'hide', 'disableSubmit'
] as const;

export const HEADING_VARIANTS = ['h1', 'h2', 'h3'] as const;

export const TEXT_ALIGN = ['left', 'center', 'right', 'justify'] as const;

export const BACKGROUND_PATTERNS = [
  'none', 'dots', 'grid', 'circuit', 'topography', 'cubes', 'gradient'
] as const;

// ──────────────────────────────────────────────────────────
// Element Schemas
// ──────────────────────────────────────────────────────────

export const questionSchema = z.object({
  id: z.string().describe('Unique kebab-case ID, e.g. q_entity_name'),
  title: z.string().describe('The question text displayed to the respondent'),
  type: z.enum(QUESTION_TYPES),
  options: z.array(z.string()).optional().describe('REQUIRED for multiple-choice, dropdown, checkboxes. 2+ items.'),
  allowOther: z.boolean().optional().describe('Only for checkboxes — adds a free-text "Other" field'),
  isRequired: z.boolean().describe('true for critical questions'),
  hidden: z.boolean().optional().describe('If true, hidden by default (can be shown via logic)'),
  placeholder: z.string().optional().describe('Placeholder text for text/long-text/email/phone inputs'),
  defaultValue: z.any().optional(),
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  enableScoring: z.boolean().optional().describe('MUST be true for this question to contribute to score calculation'),
  optionScores: z.array(z.number()).optional().describe('Point values per option. MUST be same length as options[]. For checkboxes, scores are cumulative.'),
  yesScore: z.number().optional().describe('Points awarded when answer is "Yes" (yes-no only)'),
  noScore: z.number().optional().describe('Points awarded when answer is "No" (yes-no only)'),
  autoAdvance: z.boolean().optional().describe('Auto-proceed to next page on selection (yes-no, multiple-choice only)'),
  style: z.object({
    textAlign: z.enum(TEXT_ALIGN).optional(),
  }).optional(),
});

export const layoutBlockSchema = z.object({
  id: z.string().describe('Unique kebab-case ID, e.g. sec_demographics'),
  type: z.enum(LAYOUT_TYPES),
  title: z.string().optional().describe('Heading text or section title'),
  text: z.string().optional().describe('Body text for description blocks'),
  url: z.string().optional().describe('Media URL for image, video, audio, document blocks'),
  html: z.string().optional().describe('Raw HTML for embed blocks'),
  hidden: z.boolean().optional(),
  description: z.string().optional().describe('Subtitle text for section blocks'),
  renderAsPage: z.boolean().optional().describe('If true, this section starts a new page in multi-page mode'),
  validateBeforeNext: z.boolean().optional().describe('If true, all required questions in this section must be filled before proceeding'),
  stepperTitle: z.string().optional().describe('Short label shown in the progress stepper (e.g. "Profile", "Assessment")'),
  variant: z.enum(HEADING_VARIANTS).optional().describe('Heading size variant'),
  style: z.object({
    textAlign: z.enum(TEXT_ALIGN).optional(),
  }).optional(),
});

export const logicActionSchema = z.object({
  type: z.enum(LOGIC_ACTIONS),
  targetElementId: z.string().optional().describe('ID of element to jump to, show, hide, or require'),
  targetElementIds: z.array(z.string()).optional().describe('Multiple element IDs for batch show/hide/require'),
});

export const logicBlockSchema = z.object({
  id: z.string().describe('Unique ID, e.g. logic_skip_assessment'),
  type: z.literal('logic'),
  rules: z.array(z.object({
    sourceQuestionId: z.string().describe('ID of the question whose answer triggers this rule'),
    operator: z.enum(LOGIC_OPERATORS),
    targetValue: z.any().optional().describe('Value to compare against'),
    action: logicActionSchema,
  })),
});

export const elementSchema = z.union([questionSchema, layoutBlockSchema, logicBlockSchema]);

// ──────────────────────────────────────────────────────────
// Result Page Schemas
// ──────────────────────────────────────────────────────────

export const resultBlockSchema = z.object({
  id: z.string(),
  type: z.enum(RESULT_BLOCK_TYPES),
  title: z.string().optional(),
  content: z.string().optional().describe('Rich text content for text blocks'),
  url: z.string().optional().describe('Image/video URL'),
  link: z.string().optional().describe('Button destination URL'),
  openInNewTab: z.boolean().optional(),
  variant: z.enum(HEADING_VARIANTS).optional(),
  listStyle: z.enum(['ordered', 'unordered']).optional().describe('REQUIRED for list blocks'),
  items: z.array(z.string()).optional().describe('List items — REQUIRED for list blocks'),
  style: z.object({
    textAlign: z.enum(TEXT_ALIGN).optional(),
    variant: z.string().optional(),
    animate: z.boolean().optional(),
    color: z.string().optional(),
    backgroundColor: z.string().optional(),
    padding: z.string().optional(),
    width: z.string().optional(),
  }).optional(),
});

export const resultPageSchema = z.object({
  id: z.string(),
  name: z.string(),
  isDefault: z.boolean(),
  blocks: z.array(resultBlockSchema),
});

export const resultRuleSchema = z.object({
  id: z.string(),
  label: z.string().describe('Human-readable label, e.g. "High Risk", "Excellent"'),
  minScore: z.number(),
  maxScore: z.number(),
  priority: z.number().describe('Lower number = higher priority'),
  pageId: z.string().describe('ID of the result page to display'),
});
