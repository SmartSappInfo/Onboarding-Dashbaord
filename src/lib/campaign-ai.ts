'use server';

/**
 * AI copy generation for campaigns using Genkit model resolution.
 * Supports fallback to organization keys, global DB keys, and system defaults.
 */

import { ai, getModel } from '@/ai/genkit';
import { z } from 'genkit';
import type { MessageBlock } from '@/lib/types';

export interface TextPart {
  text: string;
}

export interface MediaPart {
  media: {
    url: string;
    contentType?: string;
  };
}

export type GenkitPromptPart = TextPart | MediaPart;

const ArchitectBlockStyleSchema = z.object({
  textAlign: z.enum(['left', 'center', 'right', 'justify']).optional(),
  backgroundColor: z.string().optional(),
  backgroundImage: z.string().optional(),
  backgroundSize: z.string().optional(),
  color: z.string().optional(),
  padding: z.string().optional(),
  paddingTop: z.string().optional(),
  paddingBottom: z.string().optional(),
  paddingLeft: z.string().optional(),
  paddingRight: z.string().optional(),
  marginTop: z.string().optional(),
  marginBottom: z.string().optional(),
  fontSize: z.string().optional(),
  fontFamily: z.string().optional(),
  fontWeight: z.string().optional(),
  lineHeight: z.string().optional(),
  borderRadius: z.string().optional(),
  borderWidth: z.string().optional(),
  borderStyle: z.string().optional(),
  borderColor: z.string().optional(),
  width: z.string().optional(),
  variant: z.string().optional(),
  animate: z.boolean().optional(),
});

const ArchitectBlockSchema = z.object({
  id: z.string(),
  type: z.enum([
    'heading', 'text', 'image', 'video', 'button', 'quote', 'divider',
    'list', 'logo', 'header', 'footer', 'score-card', 'columns', 'rsvp'
  ]),
  title: z.string().optional(),
  content: z.string().optional(),
  url: z.string().optional(),
  link: z.string().optional(),
  variant: z.enum(['h1', 'h2', 'h3']).optional(),
  listStyle: z.enum(['ordered', 'unordered', 'roman', 'checkmark', 'arrow']).optional(),
  items: z.array(z.string()).optional(),
  goingLabel: z.string().optional(),
  declinedLabel: z.string().optional(),
  laterLabel: z.string().optional(),
  rsvpStyle: z.enum([
    'standard', 'card_bento', 'card_inline',
    'event_full_bento', 'event_full_inline',
    'event_compact_bento', 'event_compact_inline'
  ]).optional(),
  rsvpDate: z.string().optional(),
  rsvpTime: z.string().optional(),
  rsvpLocation: z.string().optional(),
  pillText: z.string().optional(),
  rsvpDateLabel: z.string().optional(),
  rsvpTimeLabel: z.string().optional(),
  rsvpLocationLabel: z.string().optional(),
  style: ArchitectBlockStyleSchema.optional(),
  visibilityLogic: z.object({
    rules: z.array(z.object({
      variableKey: z.string(),
      operator: z.enum(['isEqualTo', 'isNotEqualTo', 'contains', 'doesNotContain', 'isGreaterThan', 'isLessThan', 'isEmpty', 'isNotEmpty']),
      value: z.string().optional(),
    })),
    matchType: z.enum(['all', 'any']),
  }).optional(),
});

const FullBlockSchema: z.ZodType<MessageBlock> = z.lazy(() =>
  (ArchitectBlockSchema.extend({
    columns: z.array(
      z.object({
        width: z.string(),
        blocks: z.array(FullBlockSchema),
      })
    ).optional(),
  }) as unknown) as z.ZodType<MessageBlock>
);

const ArchitectResultSchema = z.object({
  blocks: z.array(FullBlockSchema),
});

interface CopyResult {
  subject: string;
  body: string;
  subjectVariants: string[];
}

const CopyResultSchema = z.object({
  subject: z.string().describe('The primary subject line'),
  body: z.string().describe('The message body content'),
  subjectVariants: z.array(z.string()).describe('Alternative subject lines'),
});

async function callGenkit(params: {
  prompt: string | GenkitPromptPart[];
  organizationId?: string;
  jsonMode?: boolean;
  schema?: unknown;
}): Promise<string> {
  // Resolve model via unified Genkit getModel utility
  const resolvedModel = await getModel({
    organizationId: params.organizationId,
    provider: 'anthropic',
    modelId: 'claude-sonnet-4-6',
  });

  const generatorAi = resolvedModel.customAi || ai;

  const { output, text } = await generatorAi.generate({
    model: resolvedModel.modelString,
    prompt: params.prompt,
    ...(params.jsonMode && params.schema ? { output: { schema: params.schema as z.ZodTypeAny } } : {}),
  });

  if (params.jsonMode && params.schema) {
    if (!output) throw new Error('AI model failed to generate structured copy');
    return JSON.stringify(output);
  }

  if (!text) throw new Error('AI model returned an empty payload');
  return text;
}

/**
 * Generate campaign copy (subject + body + variants) using resolved Genkit model.
 */
export async function generateCampaignCopy(params: {
  channel: 'email' | 'sms';
  target: string;
  campaignName: string;
  context?: string;
  organizationId?: string;
}): Promise<{ success: boolean; result?: CopyResult; error?: string }> {
  try {
    const channelGuidance = params.channel === 'sms'
      ? 'Keep the body under 160 characters. No HTML. Plain text only. Be concise and punchy.'
      : 'Write professional email content. Include a compelling subject line.';

    const targetGuidance = params.target === 'internal_team'
      ? 'Tone: professional but warm, like a colleague. Use first-person plural (we/our).'
      : 'Tone: professional and respectful. Address the recipient formally. Focus on value proposition.';

    const prompt = `You are a professional marketing copywriter for a CRM platform.

Generate campaign content for the following:
- Campaign name: "${params.campaignName}"
- Channel: ${params.channel.toUpperCase()}
- Target audience: ${params.target === 'internal_team' ? 'Internal team / staff' : 'External clients / customers'}
${params.context ? `- Additional context: ${params.context}` : ''}

${channelGuidance}
${targetGuidance}

Available template variables (use double curly braces): entity_name, entity_email, entity_phone, org_name`;

    const text = await callGenkit({
      prompt,
      organizationId: params.organizationId,
      jsonMode: true,
      schema: CopyResultSchema,
    });
    const parsed = JSON.parse(text) as CopyResult;

    return {
      success: true,
      result: {
        subject: parsed.subject || '',
        body: parsed.body || '',
        subjectVariants: parsed.subjectVariants || [],
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[CAMPAIGN-AI] Generate failed:', message);
    return { success: false, error: message };
  }
}

/**
 * Refine existing campaign copy using Genkit model with a natural language instruction.
 */
export async function refineCampaignCopy(params: {
  original: string;
  instruction: string;
  field: 'subject' | 'body';
  organizationId?: string;
}): Promise<{ success: boolean; refined?: string; error?: string }> {
  try {
    const prompt = `You are a professional copywriter. Refine the following ${params.field === 'subject' ? 'email subject line' : 'message body'}.

Original:
"""
${params.original}
"""

Instruction: ${params.instruction}

Rules:
- Maintain the original intent and key information
- Apply the requested changes precisely
- Return ONLY the refined text, nothing else (no JSON, no explanation, no quotes)`;

    const refined = await callGenkit({
      prompt,
      organizationId: params.organizationId,
      jsonMode: false,
    });
    return { success: true, refined: refined.trim() };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[CAMPAIGN-AI] Refine failed:', message);
    return { success: false, error: message };
  }
}

/**
 * Generate outbound call script template using resolved Genkit model.
 */
export async function generateCallScript(params: {
  campaignName: string;
  objective: string;
  targetAudience: string;
  tone: string;
  customGuidelines?: string;
  organizationId?: string;
}): Promise<{ success: boolean; script?: string; error?: string }> {
  try {
    const prompt = `You are an expert sales and CRM outreach calling scriptwriter.
Generate a highly effective outbound calling script for a call campaign.

Campaign Context:
- Campaign Name: "${params.campaignName}"
- Objective: "${params.objective}"
- Target Audience: "${params.targetAudience}"
- Tone: "${params.tone}" (e.g., professional, warm, urgent, authoritative)
${params.customGuidelines ? `- Custom Guidelines: ${params.customGuidelines}` : ''}

Calling Script Rules:
1. Provide a logical flow: Introduction, Main Hook/Value Proposition, Handling common objections, and Call to Action/Next Steps.
2. Use double curly brace placeholders for dynamic contact token replacement where appropriate.
   Available variables:
   - {{FIRST_NAME}} (Contact's name)
   - {{AGENT_NAME}} (Caller's name)
   - {{SCHOOL_NAME}} (Organization / School name)
   - {{EMAIL}} (Contact's email)
   - {{PHONE}} (Contact's phone number)
3. Keep the script conversational, professional, and easy to read/speak aloud.
4. Output ONLY the script body text. No introductions like "Here is your script", no quotes, no conversational filler. Start directly with the script.`;

    const script = await callGenkit({
      prompt,
      organizationId: params.organizationId,
      jsonMode: false,
    });

    return {
      success: true,
      script: script.trim(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[CAMPAIGN-AI] Generate script failed:', message);
    return { success: false, error: message };
  }
}

/**
 * Refine an existing call script using Genkit model with a natural language instruction.
 */
export async function refineCallScript(params: {
  original: string;
  instruction: string;
  organizationId?: string;
}): Promise<{ success: boolean; refined?: string; error?: string }> {
  try {
    const isJson = params.original.trim().startsWith('{') || params.original.trim().startsWith('[');
    
    let prompt = '';
    if (isJson) {
      prompt = `You are a professional call script copywriter. Refine the text and labels within the following visual call script JSON graph.

Original Script Graph (JSON):
"""
${params.original}
"""

Instruction: ${params.instruction}

Rules for JSON graph refinement:
1. Parse the JSON and locate the text properties (e.g., 'text', 'label') inside each node's 'data' object.
2. Refine these text properties according to the instruction while maintaining all dynamic placeholders (e.g., {{FIRST_NAME}}, {{AGENT_NAME}}).
3. CRITICAL: You must preserve and copy over all other custom configurations and metadata inside the node 'data' block exactly as they are. This includes properties such as:
   - 'startConfig' (checkDnc, checkTimezone, allowedHoursStart, allowedHoursEnd)
   - 'sayConfig' (complianceVerify, complianceText)
   - 'questionConfig' (fieldBinding, fieldName, fieldType, selectOptions, validationPattern)
   - 'objectionConfig' (keywordTriggers)
   - 'actionConfig' (webhookUrl, webhookHeaders, triggerDelaySeconds)
   - 'outcomeConfig' (suppressDays, followUpCampaignId)
   - 'endConfig' (wrapUpTemplateId)
   - Any other structural or configuration keys.
4. Do NOT change node IDs or edge structures unless explicitly requested by the instruction.
5. Return ONLY the valid refined JSON graph matching the original structure. Do not wrap in quotes, do not add comments, explanations, or introductory text.`;
    } else {
      prompt = `You are a professional call script copywriter. Refine the following outreach calling script.

Original Script:
"""
${params.original}
"""

Instruction: ${params.instruction}

Rules:
- Keep the overall intent, dynamic placeholders (e.g., {{FIRST_NAME}}, {{AGENT_NAME}}), and flow.
- Apply the requested refinement changes precisely.
- Return ONLY the refined calling script text. Do not wrap in quotes, do not add comments, explanations, or introductory text.`;
    }

    const refined = await callGenkit({
      prompt,
      organizationId: params.organizationId,
      jsonMode: false,
    });
    return { success: true, refined: refined.trim() };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[CAMPAIGN-AI] Refine script failed:', message);
    return { success: false, error: message };
  }
}

/**
 * Generate structured email blocks using Genkit.
 */
export async function generateEmailBlocksAction(params: {
  prompt?: string;
  imageUrl?: string;
  mode?: 'layout_analysis' | 'direct_placement';
  brandColors?: { primary?: string; secondary?: string; background?: string };
  // Backwards compatibility/alternative fields
  instruction?: string;
  campaignName?: string;
  context?: string;
  organizationId?: string;
}): Promise<{ success: boolean; blocks?: MessageBlock[]; error?: string }> {
  try {
    const activePrompt = params.prompt || params.instruction || '';
    const activeMode = params.mode || 'layout_analysis';
    const brandColors = params.brandColors;

    const brandGuidance = brandColors 
      ? `Brand Guidelines: Primary color is ${brandColors.primary || '#2563eb'}. Secondary color is ${brandColors.secondary || '#475569'}.`
      : 'Brand Guidelines: Use standard professional enterprise styles (e.g. blue buttons, dark text).';

    const systemPrompt = `You are a visual email designer and layout architect.
Generate structured email layout blocks based on the user request.
${brandGuidance}

Mode Guidelines:
- "layout_analysis": Analyze the provided visual mockup/inspiration image and recreate its core grid, headers, and text structure in blocks.
- "direct_placement": Include the provided image URL directly in an image block, generating copywriting and paragraphs around it.

Rules:
1. Output MUST strictly match the structured schema.
2. For headers, use type 'heading' with 'h1', 'h2', or 'h3'.
3. For body text, use type 'text'.
4. For columns, partition sections evenly (e.g. two columns with width '50%').`;

    const promptText = `${systemPrompt}\nUser prompt: "${activePrompt}"`;

    const promptParts: GenkitPromptPart[] = [
      { text: promptText },
      ...(params.imageUrl ? [{ media: { url: params.imageUrl, contentType: 'image/jpeg' } }] : [])
    ];

    const text = await callGenkit({
      prompt: promptParts,
      organizationId: params.organizationId,
      jsonMode: true,
      schema: ArchitectResultSchema,
    });

    const parsed = JSON.parse(text) as { blocks: MessageBlock[] };
    return {
      success: true,
      blocks: parsed.blocks || [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[CAMPAIGN-AI] Generate email blocks failed:', message);
    return { success: false, error: message };
  }
}
