'use server';

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

  const entityTerm = terminology?.singular || 'School/Entity';
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
- **Recommended Variables**: {{contact_name}}, {{survey_score}}, {{outcome_label}}, {{result_url}}, {{school_name}}.
`;
  } else if (target === 'internal_team_alert') {
    targetInstructions = `
### TARGET AUDIENCE: INTERNAL TEAM / ASSIGNED STAFF (Lead & Score Alert)
- **Goal**: Immediately notify internal staff, sales reps, or onboarding managers that a survey was completed.
- **Tone**: Professional, urgent, concise, and informative.
- **Content**: Highlight the respondent's contact details, score, key qualified answers, and call-to-action to review in CRM console.
- **Recommended Variables**: {{school_name}}, {{contact_name}}, {{contact_email}}, {{contact_phone}}, {{survey_score}}, {{outcome_label}}, {{entity_console_url}}.
`;
  } else if (target === 'external_stakeholder_alert') {
    targetInstructions = `
### TARGET AUDIENCE: EXTERNAL STAKEHOLDER / CAMPUS LEADERSHIP (Digest & Status Alert)
- **Goal**: Provide campus leadership or designated external contacts with an executive summary of survey submission.
- **Tone**: Formal, respectful, executive, and structured.
- **Content**: Outline key status, compliance / assessment standing, and next milestone.
- **Recommended Variables**: {{school_name}}, {{contact_name}}, {{survey_score}}, {{outcome_label}}, {{submission_date}}.
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

  const varList = availableVariables && availableVariables.length > 0
    ? availableVariables.map(v => `- {{${v}}}`).join('\n')
    : `- {{contact_name}}\n- {{school_name}}\n- {{survey_score}}\n- {{outcome_label}}\n- {{result_url}}\n- {{contact_email}}\n- {{contact_phone}}`;

  return `You are an expert Copywriter, Email Design Architect, and Messaging Strategist for SmartSapp.

### MISSION:
Generate high-converting, context-aware message templates for the following channels: [${requestedChannels}].

### SURVEY CONTEXT:
- **Survey Title**: "${surveyTitle}"
- **Survey Description**: "${surveyDescription || 'No description provided'}"
- **Scoring Enabled**: ${scoringEnabled ? `Yes (Max score: ${maxScore ?? 100})` : 'No'}
- **Entity Terminology**: ${entityTerm}
${questionsContext}
${targetInstructions}

### ARCHITECTURAL RULES PER CHANNEL:

1. **EMAIL CHANNEL** (Rich Block Builder):
   - You MUST provide structured 'blocks' array:
     - 'logo' at top (default url: "{{school_logo}}" or fallback)
     - 'heading' (h1 or h2) for prominent headline
     - 'text' for formatted paragraphs
     - 'button' for primary call-to-action (e.g. "View Full Assessment Results" linking to "{{result_url}}" or CRM link)
     - 'score-card' block if scoring is enabled
     - 'footer' at the bottom
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

4. **VARIABLE SYNTAX**:
   - For Email and SMS: Use exact syntax {{variable_name}}.
   - Available Variables:
${varList}

${userPromptInstructions ? `### ADDITIONAL USER INSTRUCTIONS:\n${userPromptInstructions}\n` : ''}
`;
}

export const generateSurveyMessagingFlow = ai.defineFlow(
  {
    name: 'generateSurveyMessagingFlow',
    inputSchema: SurveyMessagingContextInputSchema,
    outputSchema: GenerateSurveyMessagingOutputSchema,
  },
  async (input) => {
    const { organizationId, provider = 'anthropic', modelId = 'claude-3-5-sonnet' } = input;

    const resolvedModel = await getModel({
      organizationId,
      provider,
      modelId,
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
