'use server';

/**
 * AI copy generation for campaigns using Genkit model resolution.
 * Supports fallback to organization keys, global DB keys, and system defaults.
 */

import { ai, getModel } from '@/ai/genkit';
import { z } from 'genkit';

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
  prompt: string;
  organizationId?: string;
  jsonMode?: boolean;
  schema?: any;
}): Promise<string> {
  // Resolve model via unified Genkit getModel utility
  const resolvedModel = await getModel({
    organizationId: params.organizationId,
    provider: 'anthropic',
    modelId: 'claude-3-5-sonnet',
  });

  const generatorAi = resolvedModel.customAi || ai;

  const { output, text } = await generatorAi.generate({
    model: resolvedModel.modelString,
    prompt: params.prompt,
    ...(params.jsonMode && params.schema && { output: { schema: params.schema } }),
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
  } catch (error: any) {
    console.error('[CAMPAIGN-AI] Generate failed:', error.message);
    return { success: false, error: error.message };
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
  } catch (error: any) {
    console.error('[CAMPAIGN-AI] Refine failed:', error.message);
    return { success: false, error: error.message };
  }
}
