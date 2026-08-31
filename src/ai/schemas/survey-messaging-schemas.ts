/**
 * @fileOverview Shared Zod schemas for AI Survey Messaging & Alert Generator.
 * 
 * ARCHITECTURAL POINTER (Rule 10):
 * - SINGLE SOURCE OF TRUTH for Email, SMS, and WhatsApp template generation payloads.
 * - Formatted for 100% compatibility with MessageTemplate in src/lib/types.ts and TemplateWorkshop.
 * - All variable tags follow {{variable_name}} syntax (or {{1}}..{{n}} positional for Meta WhatsApp).
 */

import { z } from 'genkit';

export const MESSAGE_CHANNELS = ['email', 'sms', 'whatsapp'] as const;
export type MessageChannel = (typeof MESSAGE_CHANNELS)[number];

export const SURVEY_MESSAGING_TARGETS = [
  'respondent_outcome',
  'internal_team_alert',
  'external_stakeholder_alert',
  'all'
] as const;
export type SurveyMessagingTarget = (typeof SURVEY_MESSAGING_TARGETS)[number];

export const EmailBlockSchema = z.object({
  id: z.string().describe('Unique block identifier, e.g. blk_header_1'),
  type: z.enum(['heading', 'text', 'image', 'button', 'quote', 'divider', 'list', 'logo', 'header', 'footer', 'score-card']),
  title: z.string().optional(),
  content: z.string().optional(),
  url: z.string().optional(),
  link: z.string().optional(),
  variant: z.enum(['h1', 'h2', 'h3']).optional(),
  items: z.array(z.string()).optional(),
  listStyle: z.enum(['ordered', 'unordered']).optional(),
  style: z.object({
    textAlign: z.enum(['left', 'center', 'right', 'justify']).optional(),
  }).optional(),
});
export type EmailBlock = z.infer<typeof EmailBlockSchema>;

export const GeneratedEmailTemplateSchema = z.object({
  name: z.string().describe('A clear descriptive template title, e.g. "Survey Outcome - Qualified Confirmation"'),
  subject: z.string().describe('Compelling email subject line, e.g. "Your Assessment Results - {{survey_score}}% (Qualified)"'),
  body: z.string().describe('Fallback plain text version of the email'),
  blocks: z.array(EmailBlockSchema).describe('Structured content blocks for high-fidelity responsive email layout'),
  explanation: z.string().optional().describe('Brief rationale of the copywriting and layout design'),
});
export type GeneratedEmailTemplate = z.infer<typeof GeneratedEmailTemplateSchema>;

export const GeneratedSmsTemplateSchema = z.object({
  name: z.string().describe('Descriptive template title, e.g. "Survey Outcome - Qualified SMS Alert"'),
  body: z.string().describe('Concise SMS text (under 160 characters recommended) with dynamic tokens, e.g. "Hi {{contact_name}}, thanks for completing {{survey_name}}. Your score: {{survey_score}}%. View details: {{result_url}}"'),
  explanation: z.string().optional().describe('Brief rationale of the SMS copy'),
});
export type GeneratedSmsTemplate = z.infer<typeof GeneratedSmsTemplateSchema>;

export const GeneratedWhatsappTemplateSchema = z.object({
  name: z.string().describe('Template title adhering to Meta WhatsApp conventions'),
  body: z.string().describe('WhatsApp template body with positional placeholders {{1}}, {{2}}... (under 1024 chars, no markdown links)'),
  bodyParams: z.array(z.string()).describe('Sample value for each positional placeholder in order, e.g. ["John Doe", "95", "Admitted"]'),
  whatsappCategory: z.enum(['UTILITY', 'MARKETING']).default('UTILITY'),
  header: z.string().optional().describe('Optional short header text ≤ 60 chars'),
  footer: z.string().optional().describe('Optional short footer text ≤ 60 chars, e.g. "SmartSapp Team"'),
  explanation: z.string().optional(),
});
export type GeneratedWhatsappTemplate = z.infer<typeof GeneratedWhatsappTemplateSchema>;

export const SurveyMessagingContextInputSchema = z.object({
  surveyTitle: z.string(),
  surveyDescription: z.string().optional(),
  target: z.enum(SURVEY_MESSAGING_TARGETS),
  channels: z.array(z.enum(MESSAGE_CHANNELS)).optional(),
  // Outcome Rule Context (optional, for respondent_outcome target)
  outcomeRule: z.object({
    ruleId: z.string().optional(),
    label: z.string().optional(),
    minScore: z.number().optional(),
    maxScore: z.number().optional(),
    pageTitle: z.string().optional(),
    pageContentSummary: z.string().optional(),
  }).optional(),
  // Key questions context
  keyQuestions: z.array(z.object({
    id: z.string(),
    title: z.string(),
    type: z.string(),
  })).optional(),
  // Scoring context
  scoringEnabled: z.boolean().optional(),
  maxScore: z.number().optional(),
  // Organization / branding
  organizationId: z.string().optional(),
  terminology: z.object({
    singular: z.string().optional(),
    plural: z.string().optional(),
  }).optional(),
  // Available variables
  availableVariables: z.array(z.string()).optional(),
  userPromptInstructions: z.string().optional(),
  provider: z.string().optional(),
  modelId: z.string().optional(),
});
export type SurveyMessagingContextInput = z.infer<typeof SurveyMessagingContextInputSchema>;

export const GenerateSurveyMessagingOutputSchema = z.object({
  email: GeneratedEmailTemplateSchema.optional(),
  sms: GeneratedSmsTemplateSchema.optional(),
  whatsapp: GeneratedWhatsappTemplateSchema.optional(),
  overallSummary: z.string().optional(),
});
export type GenerateSurveyMessagingOutput = z.infer<typeof GenerateSurveyMessagingOutputSchema>;
