import { ai, getModel } from '../genkit';
import { z } from 'genkit';

export const prospectEnrichmentOutputSchema = z.object({
  websiteScan: z.object({
    sslValid: z.boolean().describe('Whether the website has a valid SSL certificate'),
    loadTimeMs: z.number().describe('Estimated website load time in milliseconds'),
    metaTitle: z.string().describe('Extract or generate meta title'),
    metaDescription: z.string().describe('Extract or generate meta description'),
    hasFacebook: z.boolean().describe('Whether a Facebook link was detected'),
    hasInstagram: z.boolean().describe('Whether an Instagram link was detected'),
    hasLinkedIn: z.boolean().describe('Whether a LinkedIn link was detected'),
    hasTwitter: z.boolean().describe('Whether a Twitter/X link was detected'),
    brokenLinks: z.array(z.string()).describe('List of broken links detected or estimated'),
  }),
  contacts: z.array(
    z.object({
      name: z.string().describe('Full name of the contact'),
      email: z.string().describe('Professional email address'),
      phone: z.string().optional().describe('Phone number if found'),
      role: z.string().describe('Job title or role (e.g. Principal, IT Administrator, Owner)'),
      confidence: z.number().describe('Confidence score from 0 to 100'),
      verificationStatus: z.enum(['verified', 'unverified', 'unknown']),
    })
  ).describe('Found professional contacts and decision makers'),
  scoring: z.object({
    overallScore: z.number().describe('Overall score out of 100 representing readiness to buy'),
    needScore: z.number().describe('Calculated need score out of 25'),
    digitalMaturity: z.number().describe('Calculated digital maturity out of 15 (lower means more opportunity to sell software)'),
    buyingIntent: z.number().describe('Calculated buying intent out of 20'),
    budgetProbability: z.number().describe('Calculated budget probability out of 15'),
    decisionMakerFound: z.number().describe('Calculated decision maker found score out of 10'),
    engagement: z.number().describe('Engagement score out of 15'),
  }),
  aiInsights: z.object({
    summary: z.string().describe('A paragraph summarizing the lead, online presence, and digital opportunities'),
    problemsFound: z.array(z.string()).describe('Specific issues found (e.g. load time high, missing parent portal, inactive social media)'),
    opportunities: z.array(z.string()).describe('Specific opportunities for transformation'),
    suggestedProducts: z.array(z.string()).describe('Recommended SmartSapp products to pitch (e.g. SmartSapp Pay, Parent App, Admissions, Automation)'),
    estimatedRevenueOpportunity: z.number().describe('Estimated annual contract value/revenue opportunity in USD'),
    recommendedPitch: z.string().describe('Personalized elevator pitch / sales hook tailored to this lead'),
    objectionsAnswered: z.array(
      z.object({
        objection: z.string().describe('Anticipated objection from this specific prospect'),
        counter: z.string().describe('Strategic counter-argument emphasizing SmartSapp value'),
      })
    ),
  }),
});

export const leadEnrichmentFlow = ai.defineFlow(
  {
    name: 'leadEnrichmentFlow',
    inputSchema: z.object({
      name: z.string(),
      domain: z.string(),
      industry: z.string().optional(),
      rating: z.number().optional(),
      reviewsCount: z.number().optional(),
      technologies: z.array(z.string()).optional(),
      scrapedText: z.string().optional(),
      organizationId: z.string().optional(),
      provider: z.string().optional(),
      modelId: z.string().optional(),
    }),
    outputSchema: prospectEnrichmentOutputSchema,
  },
  async (input) => {
    const { 
      name, 
      domain, 
      industry, 
      rating, 
      reviewsCount, 
      technologies = [], 
      scrapedText = '',
      organizationId,
      provider = 'googleai',
      modelId = 'gemini-3-flash-preview'
    } = input;

    const resolvedModel = await getModel({
      organizationId,
      provider,
      modelId
    });

    const activeAi = resolvedModel.customAi || ai;

    const systemPrompt = `
      You are an elite Lead Intelligence and Growth Analyst for SmartSapp.
      SmartSapp is a comprehensive CRM, messaging, automation, and billing SaaS platform. Key modules include:
      - SmartSapp Pay (Fee collection, invoicing, payment portal)
      - SmartSapp Parent App / Portal (Academics, school tracker, notifications)
      - Admissions Engine (Online applications, student onboarding)
      - Automation Engine (Follow-ups, triggers, alerts)
      - Messaging & Call Centre (WhatsApp campaigns, SMS, bulk email, script builder)

      Analyze the following prospect:
      - Business Name: ${name}
      - Website / Domain: ${domain}
      - Industry: ${industry || 'Local Business'}
      - Google Rating: ${rating ?? 'N/A'}
      - Google Reviews Count: ${reviewsCount ?? 'N/A'}
      - Technologies detected: ${technologies.join(', ') || 'None verified'}
      - Scraped Website Text Snapshot: ${scrapedText.substring(0, 1500) || 'None provided'}

      Your goal is to perform a digital maturity and opportunity audit.
      Based on the profile:
      - Assess digital weaknesses (e.g., if Google reviews complain about lack of communication, or if the website lacks online booking, admissions, or portals).
      - Calculate a realistic, structured lead score (overall ready-to-buy indicator).
      - Detect professional contacts that likely exist at this domain (e.g. Owner, Principal, IT Admin).
      - Produce a customized opportunity analysis report, SmartSapp product matches, annual revenue estimate, elevator pitch, and detailed objections handler.
    `;

    let retries = 0;
    let currentModel = resolvedModel.modelString;
    let activeAiInstance = activeAi;
    while (retries < 3) {
      try {
        console.log(`[AI] Lead enrichment execution on model: ${currentModel}`);
        
        let result: z.infer<typeof prospectEnrichmentOutputSchema>;

        if (currentModel.includes('anthropic')) {
          // Anthropic prompt-guided fallback with manual parsing
          const schemaInstructions = `
          The output MUST be a valid JSON object matching this TypeScript structure:
          interface Output {
            websiteScan: {
              sslValid: boolean; // Whether the website has a valid SSL certificate
              loadTimeMs: number; // Estimated website load time in milliseconds
              metaTitle: string; // Extract or generate meta title
              metaDescription: string; // Extract or generate meta description
              hasFacebook: boolean;
              hasInstagram: boolean;
              hasLinkedIn: boolean;
              hasTwitter: boolean;
              brokenLinks: string[]; // List of broken links detected or estimated
            };
            contacts: Array<{
              name: string; // Full name of the contact
              email: string; // Professional email address
              phone?: string; // Phone number if found
              role: string; // Job title or role (e.g. Principal, IT Administrator, Owner)
              confidence: number; // Confidence score from 0 to 100
              verificationStatus: 'verified' | 'unverified' | 'unknown';
            }>;
            scoring: {
              overallScore: number; // Overall score out of 100 representing readiness to buy
              needScore: number; // Calculated need score out of 25
              digitalMaturity: number; // Calculated digital maturity out of 15 (lower means more opportunity to sell software)
              buyingIntent: number; // Calculated buying intent out of 20
              budgetProbability: number; // Calculated budget probability out of 15
              decisionMakerFound: number; // Calculated decision maker found score out of 10
              engagement: number; // Engagement score out of 15
            };
            aiInsights: {
              summary: string; // A paragraph summarizing the lead, online presence, and digital opportunities
              problemsFound: string[]; // Specific issues found (e.g. load time high, missing parent portal, inactive social media)
              opportunities: string[]; // Specific opportunities for transformation
              suggestedProducts: string[]; // Recommended SmartSapp products to pitch (e.g. SmartSapp Pay, Parent App, Admissions, Automation)
              estimatedRevenueOpportunity: number; // Estimated annual contract value/revenue opportunity in USD
              recommendedPitch: string; // Personalized elevator pitch / sales hook tailored to this lead
              objectionsAnswered: Array<{
                objection: string; // Anticipated objection from this specific prospect
                counter: string; // Strategic counter-argument emphasizing SmartSapp value
              }>;
            };
          }
          `;

          const jsonPrompt = `${systemPrompt}\n\nIMPORTANT: Return ONLY a valid, raw JSON object matching the requested schema. Do not output any preamble, explanation, or markdown formatting (do not wrap in \`\`\`json). Just the raw JSON string.\n\nJSON Output Schema Reference:\n${schemaInstructions}`;
          
          const response = await activeAiInstance.generate({
            model: currentModel,
            prompt: jsonPrompt,
          });

          const responseText = response.text || '';
          const cleanedText = responseText.replace(/```json|```/g, '').trim();
          try {
            result = JSON.parse(cleanedText) as z.infer<typeof prospectEnrichmentOutputSchema>;
          } catch (e: unknown) {
            console.error(`[AI] Failed to parse Claude JSON response on attempt ${retries + 1}:`, cleanedText);
            throw new Error(`Invalid JSON format generated by fallback model: ${e instanceof Error ? e.message : String(e)}`);
          }
        } else {
          // Native JSON schema extraction on Gemini/GoogleAI
          const { output } = await activeAiInstance.generate({
            model: currentModel,
            prompt: systemPrompt,
            output: { schema: prospectEnrichmentOutputSchema },
          });
          if (!output) {
            throw new Error('Genkit failed to generate lead intelligence insights');
          }
          result = output;
        }

        return result;
      } catch (error: unknown) {
        retries++;
        console.warn(`[AI] Lead enrichment attempt ${retries} failed:`, error);
        
        if (retries === 3) {
          throw error;
        }

        const errorMsg = error instanceof Error ? error.message : String(error);
        const isQuotaExhausted = errorMsg.includes('429') || 
                                 errorMsg.includes('RESOURCE_EXHAUSTED') || 
                                 errorMsg.includes('quota');
        const isUnavailable = errorMsg.includes('503') || 
                              errorMsg.includes('UNAVAILABLE') || 
                              errorMsg.includes('overloaded') || 
                              errorMsg.includes('high demand');

        if (isQuotaExhausted) {
          // Fall back directly to Anthropic Claude system defaults
          console.log('[AI] Google AI Quota/Rate limit exhausted. Escalating failover to Anthropic Claude...');
          const fallbackModelDetails = await getModel({
            organizationId,
            provider: 'anthropic',
            modelId: 'claude-3-5-sonnet'
          });
          currentModel = fallbackModelDetails.modelString;
          activeAiInstance = fallbackModelDetails.customAi || ai;
        } else if (isUnavailable) {
          if (currentModel.includes('gemini-3.5-flash')) {
            currentModel = currentModel.replace('gemini-3.5-flash', 'gemini-2.5-flash');
            console.log(`[AI] Model unavailable. Downgrading to model: ${currentModel}`);
          } else {
            console.log('[AI] All Google AI models overloaded. Escalating failover to Anthropic Claude...');
            const fallbackModelDetails = await getModel({
              organizationId,
              provider: 'anthropic',
              modelId: 'claude-3-5-sonnet'
            });
            currentModel = fallbackModelDetails.modelString;
            activeAiInstance = fallbackModelDetails.customAi || ai;
          }
        }

        // Exponential backoff: 2s, 4s
        await new Promise(resolve => setTimeout(resolve, 2000 * retries));
      }
    }

    throw new Error('Genkit failed to generate lead intelligence insights due to model timeout');
  }
);
