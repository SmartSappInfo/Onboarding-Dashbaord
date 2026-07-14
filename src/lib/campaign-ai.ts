'use server';

/**
 * AI copy generation for campaigns using Genkit model resolution.
 * Supports fallback to organization keys, global DB keys, and system defaults.
 */

import { ai, getModel } from '@/ai/genkit';
import { z } from 'genkit';
import type { MessageBlock, HeadlineVariation } from '@/lib/types';

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
    'heading', 'text', 'image', 'video', 'audio', 'button', 'quote', 'divider',
    'list', 'logo', 'header', 'footer', 'score-card', 'columns', 'rsvp'
  ]),
  title: z.string().optional(),
  content: z.string().optional(),
  url: z.string().optional(),
  link: z.string().optional(),
  audioTitle: z.string().optional(),
  audioDuration: z.string().optional(),
  audioAction: z.enum(['download', 'play_inline', 'redirect']).optional(),
  audioRedirectUrl: z.string().optional(),
  videoThumbnailUrl: z.string().optional(),
  videoAction: z.enum(['download', 'play_inline', 'redirect']).optional(),
  videoRedirectUrl: z.string().optional(),
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
  name: z.string().optional().describe('A short, professional template name/title matching the email purpose (e.g. "Welcome Onboarding", "Monthly Product Update", "Event Reminder")'),
  subject: z.string().optional().describe('Recommended primary email subject line (under 50 characters, includes hook, benefit, personalization)'),
  previewText: z.string().optional().describe('Recommended primary pre-header preview text'),
  subjectOptions: z.array(
    z.object({
      subject: z.string().describe('Alternative subject line Option'),
      previewText: z.string().describe('Alternative pre-header preview text Option')
    })
  ).optional().describe('Exactly two alternative subject line and preview text pairs')
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

function zodToSchemaDescription(schema: unknown, depth = 0): unknown {
  if (depth > 6) return 'recursive_reference';
  if (!schema || typeof schema !== 'object') return 'any';
  
  const def = (schema as { _def?: { typeName?: string; type?: unknown; values?: unknown[]; innerType?: unknown; getter?: () => unknown } })._def;

  if (def && def.typeName === 'ZodLazy' && typeof def.getter === 'function') {
    return zodToSchemaDescription(def.getter(), depth + 1);
  }

  if ('shape' in schema && typeof (schema as { shape: unknown }).shape === 'object') {
    const shape = (schema as { shape: Record<string, unknown> }).shape;
    const obj: Record<string, unknown> = {};
    if (shape) {
      for (const [key, val] of Object.entries(shape)) {
        obj[key] = zodToSchemaDescription(val, depth + 1);
      }
    }
    return obj;
  }
  
  if (def && def.typeName === 'ZodArray') {
    return [zodToSchemaDescription(def.type, depth + 1)];
  }

  if (def && def.typeName === 'ZodEnum' && Array.isArray(def.values)) {
    return `enum (${def.values.join(' | ')})`;
  }

  if (def && (def.typeName === 'ZodOptional' || def.typeName === 'ZodNullable')) {
    return zodToSchemaDescription(def.innerType, depth + 1);
  }

  if (def && def.typeName === 'ZodBoolean') {
    return 'boolean';
  }

  if (def && def.typeName === 'ZodNumber') {
    return 'number';
  }

  return 'string';
}

async function callGenkit(params: {
  prompt: string | GenkitPromptPart[];
  organizationId?: string;
  jsonMode?: boolean;
  schema?: unknown;
  provider?: string;
  modelId?: string;
}): Promise<string> {
  const resolvedModel = await getModel({
    organizationId: params.organizationId,
    provider: params.provider || 'anthropic',
    modelId: params.modelId || 'claude-3-5-sonnet',
  });

  const generatorAi = resolvedModel.customAi || ai;
  const isAnthropic = resolvedModel.modelString.startsWith('anthropic/');

  let activePrompt = params.prompt;
  const activeSchema = params.schema;

  if (params.jsonMode && activeSchema) {
    const schemaDesc = JSON.stringify(zodToSchemaDescription(activeSchema), null, 2);
    const schemaInstructions = `\n\nCRITICAL: You MUST output your response strictly as a JSON object matching this schema structure:
${schemaDesc}

Rules:
1. Return ONLY the raw JSON object conforming to this schema.
2. Do NOT wrap it in markdown code blocks (e.g. do not write \`\`\`json ... \`\`\`).
3. Do NOT include any intro text, conversational words, or trailing markdown comments.
4. Output valid, parseable JSON text only.`;

    if (typeof activePrompt === 'string') {
      activePrompt = activePrompt + schemaInstructions;
    } else if (Array.isArray(activePrompt)) {
      const textPartIndex = activePrompt.findIndex(part => 'text' in part);
      if (textPartIndex !== -1) {
        const originalText = (activePrompt[textPartIndex] as TextPart).text;
        activePrompt[textPartIndex] = { text: originalText + schemaInstructions };
      } else {
        activePrompt.push({ text: schemaInstructions });
      }
    }
  }

  const runGenerate = async (genAi: typeof ai, model: string, isModelAnthropic: boolean) => {
    return await genAi.generate({
      model,
      ...(typeof activePrompt === 'string'
        ? { prompt: activePrompt }
        : { messages: [{ role: 'user', content: activePrompt }] }),
      ...(!isModelAnthropic && params.jsonMode ? { output: { format: 'json' } } : {}),
    });
  };

  let output: unknown;
  let text: string | undefined;
  let usedIsAnthropic = isAnthropic;

  try {
    const res = await runGenerate(generatorAi, resolvedModel.modelString, isAnthropic);
    output = res.output;
    text = res.text;
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const isAuthError = errorMsg.includes('401') || 
                        errorMsg.includes('UNAUTHENTICATED') || 
                        errorMsg.includes('x-api-key') || 
                        errorMsg.includes('authentication_error') ||
                        errorMsg.includes('permission_denied') ||
                        errorMsg.includes('403');
    const isConnectionError = errorMsg.toLowerCase().includes('connection') ||
                              errorMsg.toLowerCase().includes('fetch') ||
                              errorMsg.toLowerCase().includes('timeout') ||
                              errorMsg.toLowerCase().includes('econnrefused') ||
                              errorMsg.toLowerCase().includes('enotfound') ||
                              errorMsg.toLowerCase().includes('network');
    
    if ((isAuthError || isConnectionError) && isAnthropic) {
      console.warn(`[CAMPAIGN-AI] Anthropic generate failed with error: "${errorMsg}". Trying Gemini fallback.`);
      try {
        const geminiModel = await getModel({
          organizationId: params.organizationId,
          provider: 'googleai',
          modelId: 'gemini-3.5-flash',
        });
        const fallbackAi = geminiModel.customAi || ai;
        usedIsAnthropic = false;
        const res = await runGenerate(fallbackAi, geminiModel.modelString, false);
        output = res.output;
        text = res.text;
      } catch (fallbackError) {
        console.error('[CAMPAIGN-AI] Gemini fallback also failed:', fallbackError);
        throw error;
      }
    } else {
      throw error;
    }
  }

  if (params.jsonMode && activeSchema) {
    if (!usedIsAnthropic && output) {
      return JSON.stringify(output);
    }
    
    if (!text) throw new Error('AI model returned an empty payload');
    let rawText = text.trim();
    if (rawText.startsWith('```')) {
      rawText = rawText.replace(/^```(?:json)?\n/, '').replace(/\n```$/, '').trim();
    }
    const firstBrace = rawText.indexOf('{');
    const lastBrace = rawText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      rawText = rawText.substring(firstBrace, lastBrace + 1);
    }
    return rawText;
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
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(text);
    } catch (e) {
      console.error('[CAMPAIGN-AI] Failed to parse campaign copy JSON:', text);
      return { success: false, error: 'AI output was not valid JSON' };
    }

    const validation = CopyResultSchema.safeParse(parsedJson);
    if (!validation.success) {
      console.error('[CAMPAIGN-AI] Campaign copy validation failed:', validation.error);
      return { success: false, error: 'AI output failed validation against expected structure' };
    }

    const parsed = validation.data;

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
    - {{contact_name}} (Contact's name)
    - {{agent_name}} (Caller's name)
    - {{org_name}} (Organization name)
    - {{contact_email}} (Contact's email)
    - {{contact_phone}} (Contact's phone number)
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
2. Refine these text properties according to the instruction while maintaining all dynamic placeholders (e.g., {{contact_name}}, {{agent_name}}).
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
- Keep the overall intent, dynamic placeholders (e.g., {{contact_name}}, {{agent_name}}), and flow.
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
  provider?: string;
  modelId?: string;
}): Promise<{
  success: boolean;
  blocks?: MessageBlock[];
  name?: string;
  subject?: string;
  previewText?: string;
  subjectOptions?: Array<{ subject: string; previewText: string }>;
  error?: string;
}> {
  try {
    const activePrompt = params.prompt || params.instruction || '';
    const activeMode = params.mode || 'layout_analysis';
    const brandColors = params.brandColors;

    const brandGuidance = brandColors 
      ? `Brand Guidelines: Primary color is ${brandColors.primary || '#2563eb'}. Secondary color is ${brandColors.secondary || '#475569'}.`
      : 'Brand Guidelines: Use standard professional enterprise styles (e.g. blue buttons, dark text).';

    const systemPrompt = `You are an expert visual email designer, content copywriter, and layout architect.
Your task is to take the user's raw text/copy or prompt and convert it into a highly professional, beautifully structured, and high-converting visual email template composed of layout blocks.

${brandGuidance}

Mode Guidelines:
- "layout_analysis": Analyze the provided visual mockup/inspiration image and recreate its core grid, headers, and text structure in blocks.
- "direct_placement": Include the provided image URL directly in an image block, generating copywriting and paragraphs around it.

EMAIL HEADER RULES (CRITICAL COMPLIANCE):
1. The generated 'subject' line MUST be between 30 and 60 characters long.
2. The generated 'subject' line MUST use Title Case (e.g. Capitalize First Letters) and MUST NOT be written in all-caps or all CAPITAL letters.
3. The generated 'subject' and 'previewText' MUST NOT contain spam trigger phrases (such as "guaranteed", "100% free", "risk free", "make money", "cash", "earn money").
4. The generated 'subject' and 'previewText' should naturally incorporate personalization variables like "{{contact_name}}" or "{{org_name}}" if applicable.
5. The generated 'subject' line must not contain more than 1 exclamation mark (!).
6. Propose exactly two alternative 'subjectOptions' matching these rules.

BLOCK COMPOSITION RULES:
1. DO NOT merge the entire text into a single block. Segment the content logically.
2. Top-Branding: Place a 'logo' or 'header' block at the very top (utilizing '{{org_logo_url}}' for logo url).
3. Headers: Use 'heading' blocks with variant 'h1' for the main subject/title, and 'h2' or 'h3' for sub-sections. Keep headings short and punchy. ALWAYS use Title Case (Capitalize First Letters, not all-caps/CAPITAL letters) for headings and titles, even if the user's raw prompt/copy is written in CAPITAL letters.
4. Body Text: Use 'text' blocks for paragraph content. Split long paragraphs into separate, readable 'text' blocks.
5. Lists: If the source text contains bullet points, numbered items, or checklists (e.g., benefits, features, rewards, rewards checklist), convert them to a single 'list' block. Set 'listStyle' to 'checkmark' (preferred for benefits), 'arrow', 'unordered', or 'ordered', and put the list items in the 'items' array.
6. Buttons (Call to Action): Scan for links, placeholders like "[Reserve My Place]", or instructions like "Click the link below to reserve today". Convert these into a 'button' block. Set the button label in 'title' (defaulting to a suitable copy like 'Learn More' or 'Reserve My Spot' if not specified in the prompt), and the link in 'link' (defaulting to '{{rsvp_going_url}}' or a custom link if provided).
7. Score Card: If the email copy suggests a survey score, assessment result, points, or survey marks (e.g., "you scored 85", "your result: 92 points", "your survey score card"), insert a 'score-card' block to visually highlight the score.
8. Dividers: Insert 'divider' blocks to partition large sections (e.g. separating the body text from the monthly rewards checklist, or separating the body from the signature).
9. Sign-off / Signature: Use a 'text' block for the sign-off ("Warm regards,", name, title) and style it nicely.
10. Footer: Always append a 'footer' block at the end with standard compliance links (Unsubscribe, contact information) and copyrights using '{{org_name}}'.

BLOCK PROPERTY MAPPING RULES:
- Heading Blocks ('heading'):
  1. Main Title Text: MUST always be placed in the 'title' property. Do NOT leave 'title' empty or undefined.
  2. Sub-heading/Description Text: If there is a supporting sub-heading or tagline underneath the main heading, place it in the 'content' property. If there is NO sub-heading/tagline, leave the 'content' property empty or undefined.
  3. Badge/Pill Text: If there is a small category tag or label above the heading, place it in the 'pillText' property.
- Text Blocks ('text'):
  1. Paragraph Body: Place the text content in the 'content' property. Do NOT place paragraph body text in the 'title' property.
- Button Blocks ('button'):
  1. Button Label: Place the short call-to-action text in the 'title' property. Do NOT place it in 'content'. If the copy is missing or empty, suggest a suitable text like 'Reserve My Spot' or 'Click Here'.
  2. Button Link: Place the destination URL in the 'link' property.
- List Blocks ('list'):
  1. List Items: Provide the list entries inside the 'items' array of strings.
- Divider Blocks ('divider'):
  1. Properties: Keep 'title', 'content', and 'url' empty or undefined.
- Template Title/Name ('name' field in result):
  1. Title generation: Propose a short, professional, and descriptive template title/name corresponding to the email content purpose, and return it in the root 'name' field.

DYNAMIC VARIABLE REPLACEMENT RULES (TRUE INTELLIGENCE):
Scan the input copy and replace specific personal or organizational placeholders with dynamic double-bracket system tags:
1. Recipient Greetings: Replace greetings like "Dear (Name)", "Dear [Name]", "Dear Parent", "Hi [Client]" with "Dear {{contact_name}}" or "Hi {{contact_name}}".
2. School/Organization Name (The Sender): Replace occurrences of the sending school or company name (e.g. "SmartSapp", "our school", "the school name") with "{{org_name}}". **Note: Do NOT use "{{org_name}}" for personalizing client details; it is strictly for the sender. For the recipient client's own school/business/organization name, use "{{entity_name}}".**
3. Contact Details:
   - Replace phone numbers of the sender/school with "{{org_phone}}".
   - Replace email addresses of the sender/school with "{{org_email}}".
   - Replace physical addresses of the sender/school with "{{org_address}}".
4. Recipient Client details (The Recipient):
   - Recipient's business/school/organization/company name -> "{{entity_name}}"
   - Recipient Email -> "{{contact_email}}"
   - Recipient Phone -> "{{contact_phone}}"
   - Recipient Name -> "{{contact_name}}"

AESTHETIC RULES:
- Set alignment inside block.style.textAlign (e.g., 'center' for main headings and buttons, 'left' for body paragraphs).
- Apply colors from Brand Guidelines if provided (e.g., matching the primary color for the button style, header text, list checkmarks, or borders).
- Ensure 100% of the user's provided copywriting is preserved, refined, and distributed logically across the blocks. Do not use dummy placeholder text or 'Lorem Ipsum'.`;

    const promptText = `${systemPrompt}\nUser prompt/copy to parse:\n"""\n${activePrompt}\n"""`;

    const promptParts: GenkitPromptPart[] = [
      { text: promptText },
      ...(params.imageUrl ? [{ media: { url: params.imageUrl, contentType: 'image/jpeg' } }] : [])
    ];

    const text = await callGenkit({
      prompt: promptParts,
      organizationId: params.organizationId,
      jsonMode: true,
      schema: ArchitectResultSchema,
      provider: params.provider,
      modelId: params.modelId,
    });

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(text);
    } catch (e) {
      console.error('[CAMPAIGN-AI] Failed to parse email blocks result JSON:', text);
      return { success: false, error: 'AI output was not valid JSON' };
    }

    const validation = ArchitectResultSchema.safeParse(parsedJson);
    if (!validation.success) {
      console.error('[CAMPAIGN-AI] Email blocks validation failed:', validation.error);
      return { success: false, error: 'AI output failed validation against expected structure' };
    }

    const parsed = validation.data;

    const sanitizeBlocks = (blocks: MessageBlock[]): MessageBlock[] => {
      return (blocks || []).map(block => {
        const updated = { ...block };
        if (updated.type === 'button') {
          // Prioritize title first, fallback to content, fallback to default copy
          let buttonText = (updated.title || updated.content || '').trim();
          if (!buttonText) {
            buttonText = 'Learn More';
          }
          updated.title = buttonText;
          // Delete content if it exists to clean up
          delete updated.content;
        }
        if (updated.columns && Array.isArray(updated.columns)) {
          updated.columns = updated.columns.map(col => ({
            ...col,
            blocks: sanitizeBlocks(col.blocks)
          }));
        }
        return updated;
      });
    };

    return {
      success: true,
      blocks: sanitizeBlocks(parsed.blocks),
      name: parsed.name,
      subject: parsed.subject,
      previewText: parsed.previewText,
      subjectOptions: parsed.subjectOptions,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[CAMPAIGN-AI] Generate email blocks failed:', message);
    return { success: false, error: message };
  }
}

const HeadlineVariationSchema = z.object({
  title: z.string().describe('The generated variation subject line or title under 60 characters, retaining personalization variables.'),
  previewText: z.string().describe('The generated preview text under 100 characters.'),
  explanation: z.string().describe('A brief explanation of how the copywriting framework was applied.'),
});

const HeadlineVariationsResultSchema = z.object({
  variations: z.array(HeadlineVariationSchema),
});

export async function generateHeadlineVariations(params: {
  currentTitle: string;
  currentPreviewText?: string;
  framework: 'aida' | '4us' | 'pas';
  emailContext?: string;
  organizationId?: string;
}): Promise<{ success: boolean; result?: HeadlineVariation[]; error?: string }> {
  try {
    const prompt = `You are a world-class copywriter specializing in conversion rate optimization (CRO).
Your task is to generate exactly 3 high-converting variations of an email/message title and preview text based on the selected marketing framework: "${params.framework.toUpperCase()}".

Original Headline: "${params.currentTitle}"
Original Preview Text: "${params.currentPreviewText || ''}"
Email Context: "${params.emailContext || 'General notifications and updates'}"

Copywriting Framework Rules:
${
  params.framework === 'aida'
    ? `- AIDA (Attention, Interest, Desire, Action):
  - Title/Subject: Grab Attention immediately and build Interest in opening.
  - Preview Text: Focus on creating Desire (stating key benefit or value) and driving Action (clever call to action).`
    : params.framework === 'pas'
    ? `- PAS (Problem, Agitation, Solution):
  - Title/Subject: Highlight the main Problem or Agitate the pain point/consequence.
  - Preview Text: Position this communication as the clear path to the Solution.`
    : `- 4 U's (Urgency, Uniqueness, Specificity, Usefulness):
  - Title/Subject: Create Uniqueness and Ultra-specificity (what exactly they will get).
  - Preview Text: Highlight the Usefulness (benefit) and create subtle Urgency.`
}

CRITICAL RULES:
1. Preserve all template variables (such as {{contact_name}}, {{entity_name}}, {{org_name}}, {{unsubscribe_link}} etc.) exactly as they appear in the original headline or preview text. Do NOT modify the spelling, spacing, or capitalization inside double-braces (e.g. do NOT change {{contact_name}} to {{ContactName}}).
2. Keep all generated variation titles strictly under 60 characters.
3. Keep preview texts strictly under 100 characters.
4. Output must be plain text. Do NOT use HTML tags or markdown formatting.`;

    const text = await callGenkit({
      prompt,
      organizationId: params.organizationId,
      jsonMode: true,
      schema: HeadlineVariationsResultSchema,
    });

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(text);
    } catch (e) {
      console.error('[CAMPAIGN-AI] Failed to parse HeadlineIQ result JSON:', text);
      return { success: false, error: 'AI output was not valid JSON' };
    }

    const validation = HeadlineVariationsResultSchema.safeParse(parsedJson);
    if (!validation.success) {
      console.error('[CAMPAIGN-AI] HeadlineIQ validation failed:', validation.error);
      return { success: false, error: 'AI output failed validation against expected structure' };
    }

    const variationsList = validation.data.variations || [];
    const originalTags = params.currentTitle.match(/\{\{.*?\}\}/g) || [];

    const validatedVariations = variationsList.map(variation => {
      let cleanTitle = (variation.title || '').trim();
      if (cleanTitle.length > 60) {
        cleanTitle = cleanTitle.substring(0, 57) + '...';
      }

      // Ensure all original tags are preserved
      originalTags.forEach(tag => {
        if (!cleanTitle.includes(tag) && !(variation.previewText || '').includes(tag)) {
          cleanTitle += ` ${tag}`;
        }
      });

      return {
        title: cleanTitle,
        previewText: (variation.previewText || '').trim(),
        explanation: (variation.explanation || '').trim(),
      };
    });

    return {
      success: true,
      result: validatedVariations,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[CAMPAIGN-AI] Generate headline variations failed:', message);
    return { success: false, error: message };
  }
}
