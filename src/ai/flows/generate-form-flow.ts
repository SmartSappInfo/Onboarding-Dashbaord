'use server';

/**
 * SmartSapp Forms 2.0: AI Form Synthesis Flow
 * 
 * End-to-end AI generation flow that transforms natural language prompts
 * into complete, multi-page, conditionally branched, scored, and CRM-mapped
 * SmartSapp Form specifications.
 */

import { ai, getModel } from '@/ai/genkit';
import { adminDb } from '@/lib/firebase-admin';
import { getBaseUrl } from '@/lib/utils/url-helpers';
import {
  GenerateFormInputSchema,
  GenerateFormOutputSchema,
  type GenerateFormInput,
  type GenerateFormOutput,
} from '@/ai/schemas/form-ai-schemas';

const FORM_GENERATION_PROMPT = `You are an elite Form Architect & Conversion Rate Optimization Specialist.
Your task is to analyze the user's prompt and generate a production-ready, highly engaging, multi-page data capture form schema.

### GUIDELINES & ARCHITECTURE RULES:
1. **Title & Purpose**:
   - Title must be engaging, clear, and professional (max 60 characters).
   - Description should be 1-2 warm, concise sentences setting respondent expectations.
   - Choose the most fitting \`formPurpose\` from: lead_capture, contact, qualification, application, registration, onboarding, feedback, assessment, research, booking_intake.

2. **Page & Step Structure**:
   - If multi-page or auto, split questions into 2-4 logical steps with clear titles (e.g., "Personal Info", "Program Selection", "Preferences & Disclosures").
   - Each page MUST have a unique kebab-case ID (e.g., \`page_contact\`, \`page_details\`) and a sequential 0-indexed \`order\`.

3. **Components & Questions**:
   - Use canonical field types: \`short_text\`, \`long_text\`, \`email\`, \`phone\`, \`select\`, \`multi_select\`, \`radio\`, \`checkbox\`, \`number\`, \`date\`, \`rating\`, \`yes_no\`.
   - Write clear, concise labels and friendly placeholder guidance.
   - Required fields: Keep mandatory questions to essential info to minimize drop-off.
   - If selectable options are needed (for select, radio, checkbox), provide 3-6 realistic, high-quality options with \`label\` and \`value\`.
   - Semantic CRM Binding: If availableAppFields are provided below, map the matching \`appFieldId\` whenever asking for contact attributes (name, email, phone, address, company, etc.).

4. **Conditional Logic (WHEN / THEN Branching)**:
   - When appropriate for the flow, synthesize 1-3 conditional logic rules.
   - E.g., if a question asks "Do you require on-campus accommodation?" (yes_no), create a rule that shows room preference questions ONLY when the answer is "Yes" or true.
   - Comparison operators: \`equals\`, \`not_equals\`, \`contains\`, \`greater_than\`, \`less_than\`, \`is_empty\`, \`is_not_empty\`.
   - Actions: \`show_field\`, \`hide_field\`, \`require_field\`, \`jump_to_page\`, \`apply_crm_tag\`.

5. **Lead Scoring (If Applicable)**:
   - For qualification, admissions, or high-intent forms, assign \`scoringPoints\` to high-intent questions (e.g., enterprise budget, immediate start date).

6. **Tone & Audience**:
   - Match the requested tone (professional, friendly, academic, or modern).

### USER PROMPT:
\`\`\`text
{{{prompt}}}
\`\`\`

### AVAILABLE WORKSPACE CRM FIELDS:
{{{availableFields}}}

### CONFIGURATION:
- Requested Tone: {{{tone}}}
- Page Mode: {{{pageMode}}}
- Lead Scoring Enabled: {{{enableScoring}}}
- Purpose: {{{purpose}}}
`;

/**
 * Unified execution handler with multi-provider fallback.
 */
async function callAIWithFallback<T>(params: {
  prompt: string;
  schema: import('genkit').z.ZodTypeAny;
  organizationId?: string;
  provider?: string;
  modelId?: string;
}): Promise<T> {
  const { prompt, schema, organizationId, provider = 'openrouter', modelId = 'gemini-2.5-flash' } = params;

  try {
    if (provider === 'openrouter') {
      let apiKey: string | undefined;
      if (organizationId) {
        const orgDoc = await adminDb.collection('organizations').doc(organizationId).get();
        if (orgDoc.exists) {
          apiKey = orgDoc.data()?.openRouterApiKey;
        }
      }
      if (!apiKey) {
        apiKey = process.env.OPENROUTER_API_KEY;
      }

      if (apiKey) {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': getBaseUrl(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: modelId,
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'system',
                content: 'You are an expert AI Form Architect. Return strictly valid JSON adhering to the required output schema without markdown fences.',
              },
              { role: 'user', content: prompt },
            ],
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            const cleaned = content.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleaned);
            return schema.parse(parsed) as T;
          }
        }
      }
    }

    // Native Genkit path (Gemini or Claude via getModel)
    const { modelString, customAi } = await getModel({
      organizationId,
      provider: 'googleai',
      modelId: 'gemini-2.5-flash',
    });

    const activeAi = customAi || ai;
    const result = await activeAi.generate({
      model: modelString,
      prompt,
      output: { schema },
    });

    if (!result.output) {
      throw new Error('AI generation produced empty output.');
    }

    return result.output as T;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[AI-FORM-FLOW] Error during generation, attempting fallback schema parse:', msg);
    throw new Error(`AI Form Generation Failed: ${msg}`);
  }
}

export const generateFormFlow = ai.defineFlow(
  {
    name: 'generateFormFlow',
    inputSchema: GenerateFormInputSchema,
    outputSchema: GenerateFormOutputSchema,
  },
  async (input: GenerateFormInput): Promise<GenerateFormOutput> => {
    const fieldsText = (input.availableAppFields || [])
      .map(f => `- ${f.label} (ID: ${f.id}, Variable: {{${f.variableName}}}, Type: ${f.type})`)
      .join('\n') || 'None provided';

    const prompt = FORM_GENERATION_PROMPT
      .replace('{{{prompt}}}', input.prompt)
      .replace('{{{availableFields}}}', fieldsText)
      .replace('{{{tone}}}', input.tone || 'professional')
      .replace('{{{pageMode}}}', input.pageMode || 'auto')
      .replace('{{{enableScoring}}}', input.enableScoring ? 'true' : 'false')
      .replace('{{{purpose}}}', input.purpose || 'lead_capture');

    return callAIWithFallback<GenerateFormOutput>({
      prompt,
      schema: GenerateFormOutputSchema,
      organizationId: input.organizationId,
      provider: 'openrouter',
      modelId: 'google/gemini-2.5-flash',
    });
  }
);

/**
 * Public execution wrapper for generateFormFlow.
 */
export async function generateFormWithAi(input: GenerateFormInput): Promise<GenerateFormOutput> {
  return generateFormFlow(input);
}
