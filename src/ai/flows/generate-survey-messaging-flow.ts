// NOTE: Intentionally NOT 'use server' — internal Genkit flow invoked via SurveyAiMessagingActions on server.

/**
 * @fileOverview AI Flow to generate tailored multi-channel (Email, SMS, WhatsApp) messaging templates
 * for survey respondents, internal teams, and external stakeholders.
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Single Source of Truth for Variables:
 *    - Uses exact {{variable_name}} tokens from FieldsVariablesService registry.
 * 2. Meta WhatsApp Compliance:
 *    - WhatsApp templates enforce positional {{1}}..{{n}} placeholders and sample bodyParams.
 * 3. Multi-Tenant Scoping:
 *    - Resolves AI models using tenant organization credentials via getModel().
 * 4. Testability:
 *    - Validated in src/ai/__tests__/generate-survey-messaging-flow.test.ts.
 */

import { ai, getModel } from '@/ai/genkit';
import {
  SurveyMessagingContextInputSchema,
  type SurveyMessagingContextInput,
  GenerateSurveyMessagingOutputSchema,
  type GenerateSurveyMessagingOutput,
} from '@/ai/schemas/survey-messaging-schemas';

function buildSurveyMessagingPrompt(input: SurveyMessagingContextInput): string {
  const {
    surveyTitle,
    surveyDescription,
    target,
    channels,
    outcomeRule,
    keyQuestions,
    scoringEnabled,
    maxScore,
    terminology,
    availableVariables,
    userPromptInstructions,
  } = input;

  const termSingular = terminology?.singular?.trim() || 'Campus';
  const termPlural = terminology?.plural?.trim() || `${termSingular}s`;
  const isCustomTerm = termSingular.toLowerCase() !== 'entity';
  const requestedChannels = channels && channels.length > 0 ? channels.join(', ') : 'email, sms, whatsapp';

  let targetInstructions = '';
  if (target === 'respondent_outcome') {
    targetInstructions = `
### TARGET AUDIENCE: SURVEY RESPONDENT (Confirmation & Outcome)
- **Goal**: Congratulate or inform the respondent about their survey submission and specific assessment outcome.
- **Rule Context**: ${outcomeRule?.label ? `Outcome Label: "${outcomeRule.label}"` : 'General Completion'}
- **Score Range**: ${outcomeRule?.minScore !== undefined ? `${outcomeRule.minScore} - ${outcomeRule.maxScore ?? 100} points` : 'N/A'}
- **Outcome Page Context**: ${outcomeRule?.pageTitle ? `Page Title: "${outcomeRule.pageTitle}"` : ''} ${outcomeRule?.pageContentSummary ? `Summary: "${outcomeRule.pageContentSummary}"` : ''}
- **Tone**: Warm, encouraging, clear, and actionable. Provide next steps and instructions.
- **Recommended Variables**: {{contact_name}}, {{survey_score}}, {{outcome_label}}, {{result_url}}, {{entity_name}}.
`;
  } else if (target === 'internal_team_alert') {
    targetInstructions = `
### TARGET AUDIENCE: INTERNAL TEAM / ASSIGNED STAFF (Lead & Score Alert)
- **Goal**: Immediately notify internal staff, sales reps, or onboarding managers that a survey was completed.
- **Tone**: Professional, urgent, concise, and informative.
- **Content**: Highlight the respondent's contact details, score, key qualified answers, and call-to-action to review in CRM console.
- **Recommended Variables**: {{entity_name}}, {{contact_name}}, {{contact_email}}, {{contact_phone}}, {{survey_score}}, {{outcome_label}}, {{entity_console_link}}.
`;
  } else if (target === 'external_stakeholder_alert') {
    targetInstructions = `
### TARGET AUDIENCE: EXTERNAL STAKEHOLDER / ${termSingular.toUpperCase()} LEADERSHIP (Digest & Status Alert)
- **Goal**: Provide ${termSingular.toLowerCase()} leadership or designated external contacts with an executive summary of survey submission.
- **Tone**: Formal, respectful, executive, and structured.
- **Content**: Outline key status, compliance / assessment standing, and next milestone.
- **Recommended Variables**: {{entity_name}}, {{contact_name}}, {{survey_score}}, {{outcome_label}}, {{submission_date}}.
`;
  } else {
    targetInstructions = `
### TARGET AUDIENCE: MULTI-AUDIENCE (Comprehensive Suite)
- **Goal**: Generate versatile templates suitable for respondents, team members, and stakeholders.
`;
  }

  let questionsContext = '';
  if (keyQuestions && keyQuestions.length > 0) {
    questionsContext = `
### KEY SURVEY QUESTIONS:
${keyQuestions.slice(0, 15).map((q, idx) => `${idx + 1}. [${q.type}] ${q.title}`).join('\n')}
`;
  }

  const sanitizedVars = (availableVariables || [])
    .filter((v) => v !== 'school_name' && v !== 'school_logo');
  if (!sanitizedVars.includes('entity_name')) {
    sanitizedVars.unshift('entity_name');
  }

  const varList = sanitizedVars.length > 0
    ? sanitizedVars.map(v => `- {{${v}}}`).join('\n')
    : `- {{contact_name}}\n- {{entity_name}}\n- {{survey_score}}\n- {{outcome_label}}\n- {{result_url}}\n- {{contact_email}}\n- {{contact_phone}}`;

  return `You are an expert Copywriter, Email Design Architect, and Messaging Strategist for SmartSapp.

### MISSION:
Generate high-converting, context-aware message templates for the following channels: [${requestedChannels}].

### SURVEY CONTEXT:
- **Survey Title**: "${surveyTitle}"
- **Survey Description**: "${surveyDescription || 'No description provided'}"
- **Scoring Enabled**: ${scoringEnabled ? `Yes (Max score: ${maxScore ?? 100})` : 'No'}
- **Workspace Terminology**: ${termSingular} (Plural: ${termPlural})
${questionsContext}
${targetInstructions}

### ARCHITECTURAL RULES PER CHANNEL:

1. **EMAIL CHANNEL** (Rich Message Block Builder matching Template Workshop):
   - You MUST provide structured 'blocks' array using canonical MessageBlock components:
     - 'logo' at top (default url: "{{org_logo_url}}")
     - 'heading' (variant 'h1' or 'h2') for prominent headline
     - 'text' for formatted paragraphs (supports markdown bold **text** and newlines)
     - 'score-card' if scoring is enabled (title: "Assessment Score", scoreValue: "{{survey_score}}")
     - 'button' for primary call-to-action (title e.g. "View Full Assessment Results", url: "{{result_url}}") OR 'dual-button' for primary + secondary actions (title, url, secondaryTitle, secondaryLink)
     - 'list' for bulleted key highlights (items array, listStyle: 'ordered' or 'unordered')
     - 'quote' for notable quotes or testimonials
     - 'divider' for visual section separation
     - 'footer' at the bottom (content e.g. "You received this automated notification from SmartSapp.", footerStyle: "organization")
   - Provide a compelling 'subject' line.
   - Provide a 'body' plain-text fallback.

2. **SMS CHANNEL**:
   - Keep concise (under 160 characters strongly recommended).
   - Inject relevant dynamic tokens (e.g. "Hi {{contact_name}}, your {{survey_name}} score is {{survey_score}}%. View details: {{result_url}}").

3. **WHATSAPP CHANNEL** (Meta-Compliant Format):
   - In 'body', use ONLY positional placeholders {{1}}, {{2}}, {{3}} (numbered in order from 1). Do NOT use named variables in WhatsApp body.
   - Body MUST be under 1024 characters. No HTML, no raw markdown links in body.
   - You MUST provide 'bodyParams': a realistic sample value for EACH placeholder in order (e.g. for "Hi {{1}}, your score is {{2}}%" provide ["Ama", "85"]).
   - Set 'whatsappCategory' to UTILITY (for transactional/outcome updates) or MARKETING.
   - Optionally provide a short 'header' and/or 'footer' (<= 60 chars each).

4. **VARIABLE SYNTAX & DEPRECATION RULES**:
   - For Email and SMS: Use exact syntax {{variable_name}}.
   - CRITICAL REQUIREMENT: "school_name" and "school_logo" are DEPRECATED and STRICTLY FORBIDDEN.
   - Always use {{entity_name}} to refer to the institution, campus, school, or client company.
   - Always use {{org_logo_url}} for the organization brand logo.
   - Available Variables:
${varList}

5. **STRICT NO-HTML-TAGS RULE (ZERO RAW HTML LEAKAGE)**:
   - You MUST NEVER output raw HTML tags (e.g. <strong>, <b>, <br>, <p>, <span>, <div>, <ul>, <li>, <h1>, etc.) inside block titles, block content, email body, SMS body, or WhatsApp body.
   - For line breaks: use standard newlines (\\n).
   - For bold or emphasized text: use Markdown bold syntax (**bold text** or *italic text*).
   - For bullet highlights: use dedicated 'list' blocks or clean bullets (• Item).
   - All email content is compiled into responsive HTML automatically by the template renderer. Writing raw HTML tags inside text fields is strictly forbidden.

6. **STRICT TERMINOLOGY RULE (NO "Entity" IN VISIBLE COPY)**:
   ${isCustomTerm ? `- This organization uses "${termSingular}" (plural: "${termPlural}") as its official terminology instead of "Entity".
   - CRITICAL REQUIREMENT: You MUST NEVER use the word "Entity" or "entity" in any headings, visible copy, labels, bullet points, or descriptions!
   - Examples of REQUIRED syntax:
     - Write "**${termSingular}:** {{entity_name}}" (or "${termSingular}: {{entity_name}}") — NEVER "Entity: {{entity_name}}".
     - Write "Review the ${termSingular.toLowerCase()} in your console" — NEVER "Review the entity in your console".
   - The ONLY place the word "entity" is allowed to appear is inside the literal variable token {{entity_name}} or {{entity_console_link}}!` : '- Terminology is Entity.'}

${userPromptInstructions ? `### ADDITIONAL USER CORRECTIONS & INSTRUCTIONS:\n${userPromptInstructions}\n` : ''}
`;
}

export const generateSurveyMessagingFlow = ai.defineFlow(
  {
    name: 'generateSurveyMessagingFlow',
    inputSchema: SurveyMessagingContextInputSchema,
    outputSchema: GenerateSurveyMessagingOutputSchema,
  },
  async (input) => {
    const {
      workspaceId,
      organizationId,
      provider,
      modelId,
    } = input;

    // ARCHITECTURAL POINTER (Rule 10 & Multi-Tenancy):
    // Dynamically resolve provider & model with strict tenant isolation:
    // 1. Workspace preferred provider & model (WorkspaceAiService)
    // 2. Organization custom API keys (Firestore organizations doc, e.g. Gemini key)
    // 3. Backoffice System Defaults (system_settings/ai_config)
    // 4. Platform flagship balanced model (Google Gemini 3 Flash)
    // Avoid hardcoding 'anthropic', which causes failures for tenants without Anthropic API keys.
    const resolvedModel = await getModel({
      workspaceId,
      organizationId,
      provider: (provider === 'googleai' || provider === 'anthropic' || provider === 'openrouter') ? provider : undefined,
      modelId,
      tier: 'default',
    });

    const generatorAi = resolvedModel.customAi || ai;
    const promptText = buildSurveyMessagingPrompt(input);

    const { output } = await generatorAi.generate({
      model: resolvedModel.modelString,
      prompt: promptText,
      output: { schema: GenerateSurveyMessagingOutputSchema },
    });

    if (!output) {
      throw new Error('Failed to generate survey messaging templates from AI model.');
    }

    return output;
  }
);

export async function generateSurveyMessaging(
  input: SurveyMessagingContextInput
): Promise<GenerateSurveyMessagingOutput> {
  return generateSurveyMessagingFlow(input);
}
