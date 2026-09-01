'use server';

/**
 * SmartSapp Forms 2.0: In-Canvas AI Assistant Flows
 * 
 * Provides focused, sub-second AI operations for the visual builder copilot:
 * - Suggest next follow-up questions
 * - Audit form friction and drop-off risks
 * - Plain English to AST logic rule synthesis
 * - Question label and placeholder tone adaptation
 */

import { ai, getModel } from '@/ai/genkit';
import { adminDb } from '@/lib/firebase-admin';
import { getBaseUrl } from '@/lib/utils/url-helpers';
import {
  SuggestQuestionsInputSchema,
  SuggestQuestionsOutputSchema,
  FormFrictionAuditInputSchema,
  FormFrictionAuditOutputSchema,
  SynthesizeLogicInputSchema,
  SynthesizeLogicOutputSchema,
  RewriteCopyInputSchema,
  RewriteCopyOutputSchema,
  type SuggestQuestionsInput,
  type SuggestQuestionsOutput,
  type FormFrictionAuditInput,
  type FormFrictionAuditOutput,
  type SynthesizeLogicInput,
  type SynthesizeLogicOutput,
  type RewriteCopyInput,
  type RewriteCopyOutput,
} from '@/ai/schemas/form-ai-schemas';

/**
 * Helper to call AI with OpenRouter / Native Genkit fallback.
 */
async function callAssistantAI<T>(params: {
  prompt: string;
  schema: import('genkit').z.ZodTypeAny;
  organizationId?: string;
}): Promise<T> {
  const { prompt, schema, organizationId } = params;

  try {
    let apiKey = process.env.OPENROUTER_API_KEY;
    if (organizationId) {
      const orgDoc = await adminDb.collection('organizations').doc(organizationId).get();
      if (orgDoc.exists && orgDoc.data()?.openRouterApiKey) {
        apiKey = orgDoc.data()?.openRouterApiKey;
      }
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
          model: 'google/gemini-2.5-flash',
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: 'You are an AI Form Copilot assistant. Return strictly valid JSON matching the schema constraints.',
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

    // Fallback to Native Genkit
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
      throw new Error('Assistant output was empty.');
    }

    return result.output as T;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[AI-ASSISTANT-FLOW] Call failed:', msg);
    throw new Error(`AI Assistant Error: ${msg}`);
  }
}

// ──────────────────────────────────────────────────────────
// 1. Suggest Questions Flow
// ──────────────────────────────────────────────────────────

export const suggestQuestionsFlow = ai.defineFlow(
  {
    name: 'suggestQuestionsFlow',
    inputSchema: SuggestQuestionsInputSchema,
    outputSchema: SuggestQuestionsOutputSchema,
  },
  async (input: SuggestQuestionsInput): Promise<SuggestQuestionsOutput> => {
    const existingList = input.existingQuestions
      .map(q => `- ${q.label} (Type: ${q.type}, ID: ${q.id})`)
      .join('\n');

    const prompt = `You are an expert form designer. Analyze the following form and suggest 3 to 5 logical, high-converting follow-up questions to enhance data collection and lead qualification.

FORM TITLE: ${input.formTitle}
FORM DESCRIPTION: ${input.formDescription || 'None'}
EXISTING QUESTIONS:
${existingList || 'No questions yet'}

ADDITIONAL CONTEXT / USER REQUEST:
${input.contextPrompt || 'Suggest the best next questions to complete this intake workflow.'}

RULES:
- Provide 3-5 unique, non-redundant questions.
- Choose appropriate field types (short_text, long_text, select, radio, checkbox, number, email, phone, date, rating, yes_no).
- Include realistic options for select/radio/checkbox fields.
- Provide a clear rationale for each suggestion.
`;

    return callAssistantAI<SuggestQuestionsOutput>({
      prompt,
      schema: SuggestQuestionsOutputSchema,
    });
  }
);

// ──────────────────────────────────────────────────────────
// 2. Audit Form Friction Flow
// ──────────────────────────────────────────────────────────

export const auditFormFrictionFlow = ai.defineFlow(
  {
    name: 'auditFormFrictionFlow',
    inputSchema: FormFrictionAuditInputSchema,
    outputSchema: FormFrictionAuditOutputSchema,
  },
  async (input: FormFrictionAuditInput): Promise<FormFrictionAuditOutput> => {
    const questionsList = input.questions
      .map((q, idx) => `${idx + 1}. [${q.type}] ${q.label} ${q.isRequired ? '(Required)' : '(Optional)'}`)
      .join('\n');

    const prompt = `You are a Conversion Rate Optimization & Form UX Auditor.
Analyze the following form and provide a comprehensive friction analysis and UX health score (0-100).

FORM TITLE: ${input.formTitle}
TOTAL PAGES: ${input.pagesCount}
QUESTIONS:
${questionsList}

AUDIT OBJECTIVES:
1. Estimate completion time in seconds for an average user on a mobile device.
2. Assess reading level ('simple', 'moderate', 'complex').
3. Calculate an objective UX health score (0-100), where 90+ is friction-free and <60 is high risk of abandonment.
4. Identify strengths and specific friction points (e.g. too many required fields, complex textareas, ambiguous labels).
5. Propose 2-4 concrete 1-click optimization actions.
`;

    return callAssistantAI<FormFrictionAuditOutput>({
      prompt,
      schema: FormFrictionAuditOutputSchema,
    });
  }
);

// ──────────────────────────────────────────────────────────
// 3. Synthesize Logic Rule Flow
// ──────────────────────────────────────────────────────────

export const synthesizeLogicRuleFlow = ai.defineFlow(
  {
    name: 'synthesizeLogicRuleFlow',
    inputSchema: SynthesizeLogicInputSchema,
    outputSchema: SynthesizeLogicOutputSchema,
  },
  async (input: SynthesizeLogicInput): Promise<SynthesizeLogicOutput> => {
    const fieldsList = input.availableFields
      .map(f => `- Field: "${f.label}" (ID: ${f.id}, Type: ${f.type}${f.options ? `, Options: ${f.options.map(o => o.value).join(', ')}` : ''})`)
      .join('\n');

    const pagesList = (input.availablePages || [])
      .map(p => `- Page: "${p.title}" (ID: ${p.id})`)
      .join('\n');

    const prompt = `You are an AST Logic Compiler for SmartSapp Forms 2.0.
Translate the user's natural language instruction into strict, AST-compliant conditional logic rules.

USER INSTRUCTION:
"${input.instruction}"

AVAILABLE FIELDS:
${fieldsList}

AVAILABLE PAGES:
${pagesList || 'None (Single page form)'}

RULES:
- Condition operators allowed: equals, not_equals, contains, not_contains, starts_with, ends_with, greater_than, less_than, is_empty, is_not_empty.
- Actions allowed: show_field, hide_field, enable_field, disable_field, require_field, optional_field, jump_to_page, skip_to_end, apply_crm_tag.
- Target the exact field ID or page ID from the lists above.
- Provide a clear, non-technical explanation of how this rule behaves.
`;

    return callAssistantAI<SynthesizeLogicOutput>({
      prompt,
      schema: SynthesizeLogicOutputSchema,
    });
  }
);

// ──────────────────────────────────────────────────────────
// 4. Rewrite Question Copy Flow
// ──────────────────────────────────────────────────────────

export const rewriteQuestionCopyFlow = ai.defineFlow(
  {
    name: 'rewriteQuestionCopyFlow',
    inputSchema: RewriteCopyInputSchema,
    outputSchema: RewriteCopyOutputSchema,
  },
  async (input: RewriteCopyInput): Promise<RewriteCopyOutput> => {
    const prompt = `You are a professional UX Copywriter specializing in form completion and engagement.
Rewrite the following question copy to match the target tone: "${input.targetTone}".

ORIGINAL LABEL: "${input.label}"
ORIGINAL PLACEHOLDER: "${input.placeholder || ''}"
ORIGINAL HELP TEXT: "${input.helpText || ''}"

TONE SPECIFICATIONS:
- 'professional': Authoritative, polished, enterprise-ready, polite.
- 'friendly': Warm, conversational, encouraging, welcoming.
- 'concise': Extremely brief, clear, zero fluff, high signal-to-noise ratio.
- 'accessible': Simple plain language, inclusive, unambiguous.

Return the improved label, placeholder, helpText, and brief rationale.
`;

    return callAssistantAI<RewriteCopyOutput>({
      prompt,
      schema: RewriteCopyOutputSchema,
    });
  }
);
