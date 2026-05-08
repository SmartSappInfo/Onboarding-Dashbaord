'use server';

/**
 * @fileOverview Three-phase chunked AI survey generation pipeline.
 * 
 * Splits survey generation into three focused AI calls to avoid timeouts:
 * - Phase 1 (Blueprint): Title, description, section outline, styling
 * - Phase 2 (Questions): All questions and layout blocks organized by sections
 * - Phase 3 (Logic & Scoring): Scoring weights, logic blocks, result rules, outcome pages
 * 
 * Each phase has independent retry logic with exponential backoff.
 * Intermediate results are returned to the client so retries resume from the failed phase.
 */

import { ai, getModel } from '@/ai/genkit';
import { adminDb } from '@/lib/firebase-admin';
import { z } from 'genkit';
import {
  questionSchema,
  layoutBlockSchema,
  logicBlockSchema,
  elementSchema,
  resultBlockSchema,
  resultPageSchema,
  resultRuleSchema,
  QUESTION_TYPES,
  HEADING_VARIANTS,
  BACKGROUND_PATTERNS,
} from '@/ai/schemas/survey-schemas';

// ══════════════════════════════════════════════════════════
// PHASE 1 — BLUEPRINT
// ══════════════════════════════════════════════════════════

const BlueprintInputSchema = z.object({
  sourceType: z.enum(['text', 'url']),
  content: z.string(),
  organizationId: z.string().optional(),
  provider: z.string().optional().default('googleai'),
  modelId: z.string().optional().default('gemini-3-flash-preview'),
});
type BlueprintInput = z.infer<typeof BlueprintInputSchema>;

const BlueprintOutputSchema = z.object({
  title: z.string().describe('A concise, engaging survey title'),
  description: z.string().describe('A brief introduction for respondents (1-2 sentences)'),
  sections: z.array(z.object({
    id: z.string().describe('Unique kebab-case ID, e.g. sec_entity_profile'),
    title: z.string().describe('Full section title'),
    stepperTitle: z.string().describe('Short stepper label, e.g. "Profile"'),
    description: z.string().optional().describe('Section subtitle/instructions'),
    estimatedQuestions: z.number().describe('Approx questions in this section'),
  })).describe('Logical groupings of the survey content'),
  scoringEnabled: z.boolean().describe('true if content is an assessment, quiz, or qualification'),
  thankYouTitle: z.string().default('Thank you!'),
  thankYouDescription: z.string().default('We appreciate your feedback.'),
  bannerImageQuery: z.string().optional().default('abstract background pattern'),
});
type BlueprintOutput = z.infer<typeof BlueprintOutputSchema>;

const BLUEPRINT_PROMPT = `You are an expert survey architect. Analyze the provided source material and create a high-level blueprint (outline) for an intelligent survey.

### YOUR TASK:
Create the survey's identity and section structure. Do NOT generate individual questions — only identify the logical groupings.

### RULES:
1. **Title**: Concise, professional, and engaging. Max 60 characters.
2. **Description**: 1-2 sentence introduction for respondents.
3. **Sections**: Identify 2-6 logical groupings from the content. Each section gets:
   - A unique kebab-case ID (e.g. \`sec_entity_profile\`, \`sec_risk_assessment\`)
   - A full title and a short stepper label (max 15 chars)
   - An estimate of how many questions belong in that group
4. **Scoring**: Set \`scoringEnabled: true\` ONLY if the content is clearly an assessment, quiz, qualification check, or risk evaluation. Simple feedback surveys should be \`false\`.
5. **Thank You**: Always generate a warm, professional thank-you title and description.

### SOURCE MATERIAL:
\`\`\`text
{{{sourceText}}}
\`\`\`
`;

const generateBlueprintFlow = ai.defineFlow(
  {
    name: 'generateSurveyBlueprintFlow',
    inputSchema: BlueprintInputSchema,
    outputSchema: BlueprintOutputSchema,
  },
  async (input) => {
    const sourceText = await resolveSourceText(input);

    return callAI<BlueprintOutput>({
      prompt: BLUEPRINT_PROMPT.replace('{{{sourceText}}}', sourceText),
      schema: BlueprintOutputSchema,
      input,
      phaseName: 'Blueprint',
    });
  }
);

export async function generateSurveyBlueprint(input: BlueprintInput): Promise<BlueprintOutput> {
  return generateBlueprintFlow(input);
}

// ══════════════════════════════════════════════════════════
// PHASE 2 — QUESTIONS & ELEMENTS
// ══════════════════════════════════════════════════════════

const QuestionsInputSchema = z.object({
  sourceText: z.string(),
  blueprint: BlueprintOutputSchema,
  organizationId: z.string().optional(),
  provider: z.string().optional().default('googleai'),
  modelId: z.string().optional().default('gemini-3-flash-preview'),
});
type QuestionsInput = z.infer<typeof QuestionsInputSchema>;

const QuestionsOutputSchema = z.object({
  elements: z.array(elementSchema).describe('Complete array of sections, questions, headings, descriptions, and dividers. Do NOT include logic blocks or scoring fields.'),
});
type QuestionsOutput = z.infer<typeof QuestionsOutputSchema>;

const QUESTIONS_PROMPT = `You are an expert survey architect building the questions for a survey. You have been given a blueprint (section outline) and the original source material.

### YOUR TASK:
1. **Faithful Extraction (GOLDEN RULE)**: If the source material provides a list of options for a question, you MUST include EVERY SINGLE ONE in the \`options\` array. Do NOT skip, summarize, or truncate the list. An empty \`options\` array for a choice-based question is a FAILURE.
2. Generate ALL questions, section containers, and layout blocks. Organize them strictly according to the blueprint sections.

### PATTERN RECOGNITION:
- **Questions**: Usually start with a number (e.g., "1.", "5.") or are on a single line ending in a question mark.
- **Options**: The lines immediately following a question that represent choices. You MUST collect all these into the \`options\` array.
- **Instruction/Category Lines**: Lines like "1. Ice Breaker Question" should NOT be separate blocks. Merge them into the question title (e.g., "Ice Breaker: [Question Text]") or use a \`heading\` block if it's a section title. NEVER generate a question block without options if the source material provides them immediately below.
- **Description/Content Blocks**: For blocks with type \`description\`, \`text\`, or \`heading\`, you MUST follow the source copy EXACTLY. Do NOT summarize or rephrase.
- **Formatting**: Respect all whitespace, carriage returns, and paragraphs. Use double newlines (\`\\n\\n\`) in the \`content\` or \`description\` fields to preserve paragraph breaks. NEVER lump multiple paragraphs into a single block of text.
- **De-duplication**: NEVER generate the same question twice. If you see a header and then a question, they are ONE element.

### ELEMENT ORDERING:
1. A \`section\` block (with \`renderAsPage: true\`, \`validateBeforeNext: true\`)
2. Optional \`heading\` or \`description\` blocks for section instructions
3. The questions for that section
4. Optional \`divider\` blocks between logical sub-groups

### QUESTION TYPES AVAILABLE:
- \`text\`: Short single-line text input
- \`long-text\`: Multi-line textarea
- \`email\`: Email address input (USE THIS when asking for email addresses)
- \`phone\`: Phone number input (USE THIS when asking for phone/mobile numbers)
- \`yes-no\`: Binary choice (renderer expects answers "Yes" or "No" exactly)
- \`multiple-choice\`: Single selection from options (MUST include \`options: string[]\`, can set \`allowOther: true\`)
- \`checkboxes\`: Multi-selection (MUST include \`options: string[]\`, can set \`allowOther: true\`)
- \`dropdown\`: Single selection dropdown (MUST include \`options: string[]\` with 3+ items)
- \`rating\`: 1-5 star rating
- \`date\`: Calendar date picker
- \`time\`: Time input
- \`file-upload\`: File attachment

### CRITICAL RULES:
1. **"Other" Option Logic**: 
   - If the source text includes "Other" or "Please specify" as an option, do NOT add it to the \`options\` array.
   - Instead, set \`allowOther: true\` on the question element.
2. **Unique IDs**: Every element MUST have a unique kebab-case ID (e.g. \`q_entity_name\`, \`sec_demographics\`, \`head_intro\`)
3. **Section IDs**: Use the exact section IDs from the blueprint
4. **Required Fields (STRICT)**: 
   - Set \`isRequired: false\` by default for all questions.
   - ONLY set \`isRequired: true\` if the source text explicitly includes "Required", an asterisk (*), or if it is a critical contact field (Email/Phone).
5. **autoAdvance**: Set to \`true\` on \`yes-no\` and \`multiple-choice\` questions where it makes sense for flow
6. **No Scoring**: Do NOT set \`enableScoring\`, \`optionScores\`, \`yesScore\`, or \`noScore\` — Phase 3 handles scoring
7. **No Logic Blocks**: Do NOT generate elements with \`type: "logic"\` — Phase 3 handles logic
8. **Headings**: Use \`variant: "h1"\` for main titles, \`"h2"\` for section headers, \`"h3"\` for sub-headers

### BLUEPRINT:
Title: {{{title}}}
Description: {{{description}}}
Sections:
{{{sections}}}

### SOURCE MATERIAL:
\`\`\`text
{{{sourceText}}}
\`\`\`
`;

const generateQuestionsFlow = ai.defineFlow(
  {
    name: 'generateSurveyQuestionsFlow',
    inputSchema: QuestionsInputSchema,
    outputSchema: QuestionsOutputSchema,
  },
  async (input) => {
    const sectionsText = input.blueprint.sections
      .map((s, i) => `${i + 1}. [${s.id}] "${s.title}" (stepper: "${s.stepperTitle}") — ~${s.estimatedQuestions} questions`)
      .join('\n');

    const prompt = QUESTIONS_PROMPT
      .replace('{{{title}}}', input.blueprint.title)
      .replace('{{{description}}}', input.blueprint.description)
      .replace('{{{sections}}}', sectionsText)
      .replace('{{{sourceText}}}', input.sourceText);

    const result = await callAI<QuestionsOutput>({
      prompt,
      schema: QuestionsOutputSchema,
      input,
      phaseName: 'Questions',
    });

    // Validation: reject if too few elements were generated
    if (!result.elements || result.elements.length < 3) {
      throw new Error('Phase 2 generated too few elements. The AI may not have understood the source material.');
    }

    return result;
  }
);

export async function generateSurveyQuestions(input: QuestionsInput): Promise<QuestionsOutput> {
  return generateQuestionsFlow(input);
}

// ══════════════════════════════════════════════════════════
// PHASE 3 — LOGIC, SCORING & OUTCOMES
// ══════════════════════════════════════════════════════════

const LogicInputSchema = z.object({
  blueprint: BlueprintOutputSchema,
  elements: z.array(z.any()).describe('Elements from Phase 2'),
  organizationId: z.string().optional(),
  provider: z.string().optional().default('googleai'),
  modelId: z.string().optional().default('gemini-3-flash-preview'),
});
type LogicInput = z.infer<typeof LogicInputSchema>;

const ScoringPatchSchema = z.object({
  questionId: z.string(),
  enableScoring: z.literal(true),
  optionScores: z.array(z.number()).optional(),
  yesScore: z.number().optional(),
  noScore: z.number().optional(),
});

const LogicOutputSchema = z.object({
  scoringPatches: z.array(ScoringPatchSchema).optional().default([]).describe('Scoring weights to apply to existing questions. ONLY for questions that should contribute to score.'),
  logicBlocks: z.array(logicBlockSchema).optional().default([]).describe('Conditional logic blocks referencing exact question IDs from Phase 2'),
  maxScore: z.number().describe('Sum of all highest-possible scores across all scored questions'),
  resultRules: z.array(resultRuleSchema).optional().default([]).describe('Score range to outcome page mappings. Ranges should not overlap.'),
  resultPages: z.array(resultPageSchema).optional().default([]).describe('Outcome pages with rich content blocks'),
});
type LogicOutput = z.infer<typeof LogicOutputSchema>;

const LOGIC_PROMPT = `You are an expert survey architect. You have been given a completed survey blueprint and all its questions. Your job is to add scoring, conditional logic, and outcome pages.

### YOUR TASK:
1. If scoring is enabled, assign point values to appropriate questions
2. Create conditional logic blocks to skip irrelevant questions
3. Design outcome pages for different score ranges

### SCORING CONTRACT (CRITICAL):
The survey engine's \`calculateScore()\` function ONLY evaluates questions where \`enableScoring === true\`.
- For \`yes-no\` questions: set \`yesScore\` and \`noScore\` (numbers)
- For \`multiple-choice\`/\`dropdown\`/\`checkboxes\`: set \`optionScores\` — an array of numbers with EXACTLY the same length as the question's \`options\` array
- For \`checkboxes\`: scores are cumulative (each selected option's score is added)
- \`maxScore\` = sum of all highest-possible scores (e.g. for checkboxes, sum ALL option scores)

### LOGIC BLOCK RULES:
- **Type Compliance**: Every logic block MUST have \`type: "logic"\`.
- **Target Specification (CRITICAL)**: Every logic rule MUST include either \`targetElementId\` OR \`targetElementIds\`. Rules with empty targets are BROKEN.
- **Placement**: Place logic blocks immediately following the \`sourceQuestionId\` in the elements array for better readability.
- **Follow-up Logic (Negative Exclusion)**: If a question is a follow-up to a previous one (e.g., "If yes, why?", "If you would like, share..."), you MUST create a logic block to HIDE the follow-up if the parent question's answer makes it irrelevant (e.g., hiding a follow-up if the answer is "Never", "No", or "None").
- \`sourceQuestionId\` MUST be an exact ID from the list below (e.g. \`q_satisfaction\`).
- \`targetElementId\` MUST be an exact ID from the list below (e.g. \`q_feedback\`).

#### Logic Example:
If a user answers "No" to a question with ID \`q_has_experience\`, hide the question with ID \`q_experience_years\`:
\`\`\`json
{
  "id": "logic_experience_skip",
  "type": "logic",
  "rules": [
    {
      "sourceQuestionId": "q_has_experience",
      "operator": "isEqualTo",
      "targetValue": "No",
      "action": {
        "type": "hide",
        "targetElementId": "q_experience_years"
      }
    }
  ]
}
\`\`\`

#### Logic Checklist:
- [ ] Does every action have a \`targetElementId\` or \`targetElementIds\`?
- [ ] Are all IDs identical to the ones in the "EXISTING ELEMENTS" list?
- [ ] Is the \`type\` field set to "logic"?


### RESULT PAGE RULES:
- Create 2-4 outcome buckets with NON-OVERLAPPING score ranges
- Every result page MUST start with a \`score-card\` block (shows animated score)
- Use \`heading\`, \`text\`, \`list\`, \`button\`, \`quote\`, \`divider\` blocks for content
- \`list\` blocks MUST include \`listStyle\` ("ordered" or "unordered") and \`items: string[]\`
- \`button\` blocks MUST include \`title\` (button label), \`link\` (URL), \`openInNewTab: true\`
- Each \`resultRule\` needs a unique ID, \`priority\` (lower = higher), and \`pageId\` matching a result page ID
- **Message Templates**: If an outcome is significant (e.g., "High Risk", "Selected"), you may set placeholder IDs like \`"email_template_placeholder"\` or \`"sms_template_placeholder"\` in the \`resultRule\` — the system will prompt the user to link actual templates later.

### BLUEPRINT:
Title: {{{title}}}
Scoring Enabled: {{{scoringEnabled}}}

### EXISTING ELEMENTS (with their IDs and types):
{{{elementsRef}}}

{{{scoringInstructions}}}
`;

const generateLogicFlow = ai.defineFlow(
  {
    name: 'generateSurveyLogicFlow',
    inputSchema: LogicInputSchema,
    outputSchema: LogicOutputSchema,
  },
  async (input) => {
    // Build a compact reference of elements for the AI to reference
    const elementsRef = input.elements
      .map((el: any) => {
        if (el.type === 'logic') return null;
        let line = `- [${el.id}] type="${el.type}"`;
        if (el.title) line += ` title="${el.title}"`;
        if (el.options) line += ` options=${JSON.stringify(el.options)}`;
        if (el.type === 'section') line += ` (section)`;
        return line;
      })
      .filter(Boolean)
      .join('\n');

    const scoringInstructions = input.blueprint.scoringEnabled
      ? '### IMPORTANT: Scoring is ENABLED. You MUST generate scoringPatches, resultRules, and resultPages.'
      : '### NOTE: Scoring is DISABLED. Set maxScore to 0 and return empty arrays for scoringPatches, resultRules, and resultPages. You may still generate logicBlocks if conditional branching makes sense.';

    const prompt = LOGIC_PROMPT
      .replace('{{{title}}}', input.blueprint.title)
      .replace('{{{scoringEnabled}}}', String(input.blueprint.scoringEnabled))
      .replace('{{{elementsRef}}}', elementsRef)
      .replace('{{{scoringInstructions}}}', scoringInstructions);

    return callAI<LogicOutput>({
      prompt,
      schema: LogicOutputSchema,
      input,
      phaseName: 'Logic',
    });
  }
);

export async function generateSurveyLogic(input: LogicInput): Promise<LogicOutput> {
  return generateLogicFlow(input);
}

// ══════════════════════════════════════════════════════════
// MERGE — imported from utility (not a server action)
// ══════════════════════════════════════════════════════════

// The merge function lives in a separate non-'use server' file because
// it's a pure synchronous utility that runs client-side.
import { mergeSurveyPhases } from '@/ai/utils/merge-survey-phases';

// ══════════════════════════════════════════════════════════
// ORCHESTRATOR — Called by the UI
// ══════════════════════════════════════════════════════════

/**
 * Full orchestrator that runs all three phases sequentially.
 * For the UI's phased approach, call individual phase functions directly instead.
 */
export async function generateSurveyChunked(input: {
  sourceType: 'text' | 'url';
  content: string;
  organizationId?: string;
  provider?: string;
  modelId?: string;
}) {
  const sourceText = await resolveSourceText(input);
  const provider = input.provider || 'openrouter';
  const modelId = input.modelId || 'gemini-3-flash-preview';

  // Phase 1
  const blueprint = await generateSurveyBlueprint({
    content: sourceText,
    sourceType: 'text',
    organizationId: input.organizationId,
    provider,
    modelId,
  });

  // Phase 2
  const questions = await generateSurveyQuestions({
    sourceText,
    blueprint,
    organizationId: input.organizationId,
    provider,
    modelId,
  });

  // Phase 3
  const logic = await generateSurveyLogic({
    blueprint,
    elements: questions.elements as any[],
    organizationId: input.organizationId,
    provider,
    modelId,
  });

  return mergeSurveyPhases(blueprint, questions, logic);
}

// ══════════════════════════════════════════════════════════
// SHARED UTILITIES
// ══════════════════════════════════════════════════════════

/**
 * Resolves source text from URL or direct text input.
 */
async function resolveSourceText(input: { sourceType: string; content: string }): Promise<string> {
  if (input.sourceType === 'url') {
    try {
      const response = await fetch(input.content);
      if (!response.ok) throw new Error(`Failed to fetch URL: ${response.statusText}`);
      const text = await response.text();
      return text.substring(0, 20000); // Limit to avoid prompt blowup
    } catch (e: any) {
      console.error('[CHUNKED] URL fetch failed:', e.message);
      throw new Error('Could not retrieve content from the provided URL.');
    }
  }
  return input.content;
}

/**
 * Unified AI call handler with retry logic, OpenRouter bypass, and error recovery.
 * Follows the same pattern as modify-survey-flow.ts.
 */
async function callAI<T>(params: {
  prompt: string;
  schema: any; // z.ZodType — using any to support ZodDefault/ZodOptional wrappers
  input: { organizationId?: string; provider?: string; modelId?: string };
  phaseName: string;
}): Promise<T> {
  const { prompt, schema, input, phaseName } = params;
  const provider = input.provider || 'openrouter';
  const modelId = input.modelId || 'gemini-3-flash-preview';

  let retries = 0;
  const maxRetries = 3;

  while (retries < maxRetries) {
    try {
      // OpenRouter bypass (same as generate-survey-flow.ts)
      if (provider === 'openrouter') {
        let apiKey: string | undefined;
        let aiKeyMode: 'platform' | 'custom' = 'platform';

        if (input.organizationId) {
          const orgDoc = await adminDb.collection('organizations').doc(input.organizationId).get();
          aiKeyMode = orgDoc.data()?.aiKeyMode || 'platform';
          
          if (aiKeyMode === 'custom') {
            apiKey = orgDoc.data()?.openRouterApiKey;
            if (!apiKey) throw new Error('Organization is configured to use custom AI APIs, but OpenRouter API key is missing. Please add it to your organization settings.');
          }
        }

        if (aiKeyMode === 'platform') {
          apiKey = process.env.OPENROUTER_API_KEY;
          if (!apiKey) throw new Error('Platform AI API keys are not configured. Please contact the administrator or switch to custom API keys in your organization settings.');
        }

        const fullPrompt = `${prompt}\n\nYou MUST return raw, strictly well-formed JSON matching the exact schema requirements defined. Do not use markdown wrappers.`;

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://localhost:3000',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: modelId,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: 'You are an AI generating exactly formatted JSON mapping back to strict schema constraints.' },
              { role: 'user', content: fullPrompt },
            ],
          }),
        });

        if (!response.ok) throw new Error(`OpenRouter API refused generation: ${response.statusText}`);
        const data = await response.json();
        const contentString = data.choices?.[0]?.message?.content;
        if (!contentString) throw new Error('OpenRouter returned an empty payload.');

        const parsed = JSON.parse(contentString.replace(/```json/g, '').replace(/```/g, '').trim());
        return schema.parse(parsed);
      }

      // Native Genkit path (Gemini, OpenAI)
      const model = await getModel({
        organizationId: input.organizationId,
        provider,
        modelId,
      });

      const { output } = await ai.generate({
        model,
        prompt,
        output: { schema },
      });

      if (!output) throw new Error(`Phase ${phaseName}: AI model returned empty output.`);
      return output;

    } catch (error: any) {
      retries++;
      const isRetryable = error.message?.includes('503') ||
        error.message?.includes('429') ||
        error.status === 503 ||
        error.status === 429;

      if (isRetryable && retries < maxRetries) {
        const delay = Math.pow(2, retries) * 1000 + Math.random() * 1000;
        console.warn(`[CHUNKED:${phaseName}] Retrying (${retries}/${maxRetries}) in ${Math.round(delay)}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      console.error(`[CHUNKED:${phaseName}] Failed after ${retries} attempts:`, error.message);
      throw new Error(`Survey generation failed at ${phaseName}: ${error.message}`);
    }
  }

  throw new Error(`Phase ${phaseName}: Max retries exceeded.`);
}
