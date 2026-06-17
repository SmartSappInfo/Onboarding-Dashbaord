'use server';
/**
 * @fileOverview An AI flow to extract structured school data from unstructured text.
 * Upgraded to support deep discovery of all stakeholders and secondary contact points.
 */

import { ai, getModel } from '@/ai/genkit';
import { adminDb } from '@/lib/firebase-admin';
import { z } from 'genkit';
import { getBaseUrl } from '@/lib/utils/url-helpers';

const ExtractSchoolDataInputSchema = z.object({
  text: z.string().describe('The raw text containing school information.'),
  organizationId: z.string().optional(),
  provider: z.string().optional().default('anthropic'),
  modelId: z.string().optional().default('claude-sonnet-4-6'),
});
export type ExtractSchoolDataInput = z.infer<typeof ExtractSchoolDataInputSchema>;

const ExtractSchoolDataOutputSchema = z.object({
  name: z.string().describe('Official name of the school.'),
  initials: z.string().optional().describe('Acronym or short name.'),
  slogan: z.string().optional().describe('School motto or slogan.'),
  location: z.string().optional().describe('Physical address or general area.'),
  nominalRoll: z.number().optional().describe('Estimated total student population.'),
  contacts: z.array(z.object({
    name: z.string().describe('Full name of the contact or office department.'),
    email: z.string().email().describe('Professional email address.'),
    phone: z.string().describe('Contact number.'),
    role: z.enum(['Champion', 'Accountant', 'Administrator', 'Principal', 'School Owner']).describe('Organizational role.')
  })).optional().describe('All stakeholders and office contact points identified in the text.'),
  suggestedModuleNames: z.array(z.string()).optional().describe('Names of SmartSapp modules mentioned or implied (e.g. Billing, Attendance, Security).'),
  explanation: z.string().describe('Brief summary of what was extracted and why.'),
});
export type ExtractSchoolDataOutput = z.infer<typeof ExtractSchoolDataOutputSchema>;

const PROMPT_TEMPLATE = `You are an expert institutional analyst for SmartSapp. Your task is to analyze the provided text and extract structured data for a new school onboarding.

### ANALYSIS RULES:
1. **Precision**: Extract the official name, initials (e.g. GIS for Ghana International School), and slogan exactly as they appear.
2. **Deep Contact Discovery**: Thoroughly scan the text for *every* individual and contact point mentioned. 
   - Capture every person and their specific role.
   - If a generic phone number is provided (e.g. "Main Office: 024..."), create a focal person entry with Name: "Main Office" and Role: "Administrator".
   - Map roles strictly to: 'Champion', 'Accountant', 'Administrator', 'Principal', or 'School Owner'.
3. **Logistics**: Find the student population (Nominal Roll) and physical location.
4. **Module Detection**: Identify which SmartSapp features the school needs. Common ones include 'Child Security', 'Student Billing', 'Attendance', and 'Reports'.
5. **Formatting**: Ensure all phone numbers are preserved and emails are valid.

Source Material:
"""
{{{text}}}
"""
`;

const extractSchoolDataFlow = ai.defineFlow(
  {
    name: 'extractSchoolDataFlow',
    inputSchema: ExtractSchoolDataInputSchema,
    outputSchema: ExtractSchoolDataOutputSchema,
  },
  async (input) => {
    const promptText = PROMPT_TEMPLATE.replace('{{{text}}}', input.text);

    // Bypass genkitx-openai-compatible entirely for OpenRouter due to slash mutation bug
    if (input.provider === 'openrouter') {
      let apiKey: string | undefined;
      let aiKeyMode: 'platform' | 'custom' = 'platform';

      if (input.organizationId) {
        const orgDoc = await adminDb.collection('organizations').doc(input.organizationId).get();
        aiKeyMode = orgDoc.data()?.aiKeyMode || 'platform';
        
        if (aiKeyMode === 'custom') {
          apiKey = orgDoc.data()?.openRouterApiKey;
          if (!apiKey) throw new Error("Organization is configured to use custom AI APIs, but OpenRouter API key is missing. Please add it to your organization settings.");
        }
      }

      if (aiKeyMode === 'platform') {
        apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) throw new Error("Platform AI API keys are not configured. Please contact the administrator or switch to custom API keys in your organization settings.");
      }

      const fullPrompt = `${promptText}\n\nYou MUST return raw, strictly well-formed JSON matching the exact schema requirements defined. Do not use markdown wrappers.`;
      
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': getBaseUrl(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: input.modelId || 'gemini-3-flash-preview',
          response_format: { type: "json_object" },
          messages: [
            { role: 'system', content: 'You are an AI generating exactly formatted JSON mapping back to strict schema constraints.' },
            { role: 'user', content: fullPrompt }
          ]
        })
      });

      if (!response.ok) throw new Error(`OpenRouter API refused generation: ${response.statusText}`);
      const data = await response.json();
      const contentString = data.choices?.[0]?.message?.content;
      if (!contentString) throw new Error("OpenRouter returned an empty payload.");

      try {
        let parsedJSON = JSON.parse(contentString.replace(/```json/g, '').replace(/```/g, '').trim());
        return ExtractSchoolDataOutputSchema.parse(parsedJSON);
      } catch (e: any) {
        console.error("Failed to parse OpenRouter structured output:", e);
        throw new Error("OpenRouter returned an invalid JSON schema payload. Generation aborted.");
      }
    }

    // --- Native Genkit Path for Gemini and OpenAI ---
    const resolvedModel = await getModel({
      organizationId: input.organizationId,
      provider: input.provider || 'anthropic',
      modelId: input.modelId || 'claude-sonnet-4-6',
    });

    const generatorAi = resolvedModel.customAi || ai;

    const { output } = await generatorAi.generate({
      model: resolvedModel.modelString,
      prompt: promptText,
      output: { schema: ExtractSchoolDataOutputSchema }
    });

    if (!output) throw new Error("The AI model failed to generate structured data.");
    return output;
  }
);

export async function extractSchoolData(input: ExtractSchoolDataInput): Promise<ExtractSchoolDataOutput> {
  return extractSchoolDataFlow(input);
}
