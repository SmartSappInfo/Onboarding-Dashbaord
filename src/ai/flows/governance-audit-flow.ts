import { ai } from '../genkit';
import { z } from 'genkit';

/**
 * AI Governance & Policy Audit Flow (Company Brain Phase 7).
 *
 * Audits a note or document for:
 * 1. Personally Identifiable Information (PII) / Credentials / Sensitive Disclosures.
 * 2. Unsupported sweeping assertions or high-risk claims.
 * 3. Compliance score and actionable redaction recommendations.
 */

export const governanceAuditInputSchema = z.object({
  noteId: z.string(),
  title: z.string(),
  content: z.string(),
  checkPii: z.boolean().default(true),
  checkUnsupportedClaims: z.boolean().default(true),
});

export const governanceAuditOutputSchema = z.object({
  hasPiiRisk: z.boolean().describe('True if sensitive PII or credentials were found'),
  piiItemsFound: z.array(z.string()).describe('List of discovered sensitive tokens, passwords, or PII categories'),
  hasUnsupportedAssertions: z.boolean().describe('True if high-risk assertions lack evidence backing'),
  unsupportedStatements: z.array(z.string()).describe('List of sweeping statements that require empirical evidence'),
  complianceScore: z.number().min(0).max(100).describe('Overall governance compliance score (0 to 100)'),
  recommendations: z.array(z.string()).describe('Specific actionable recommendations to ensure compliance'),
  redactedContentSnippet: z
    .string()
    .optional()
    .describe('Preview of content with PII redacted (e.g. [REDACTED_PHONE])'),
});

export type GovernanceAuditInput = z.infer<typeof governanceAuditInputSchema>;
export type GovernanceAuditOutput = z.infer<typeof governanceAuditOutputSchema>;

export const governanceAuditFlow = ai.defineFlow(
  {
    name: 'governanceAuditFlow',
    inputSchema: governanceAuditInputSchema,
    outputSchema: governanceAuditOutputSchema,
  },
  async (input): Promise<GovernanceAuditOutput> => {
    const { title, content, checkPii, checkUnsupportedClaims } = input;

    if (!content || !content.trim()) {
      return {
        hasPiiRisk: false,
        piiItemsFound: [],
        hasUnsupportedAssertions: false,
        unsupportedStatements: [],
        complianceScore: 100,
        recommendations: ['Document is empty.'],
      };
    }

    const systemPrompt = `
You are the SmartSapp Governance, Compliance & Data Protection Agent.
Your objective is to review organizational notes for sensitive data risks and governance policy compliance.

Inspection Directives:
${checkPii ? '1. PII & SENSITIVE DATA: Identify unmasked credit card numbers, bank accounts, secret API keys, plain text passwords, or private medical details.' : ''}
${checkUnsupportedClaims ? '2. UNSUPPORTED CLAIMS: Identify absolute commercial promises (e.g. "guaranteed 100% ROI") or unsubstantiated accusations that could create legal exposure without evidence.' : ''}
3. COMPLIANCE SCORE: Rate document compliance from 0 (severe violation) to 100 (clean & compliant).
4. REDACTED PREVIEW: If PII is found, provide a clean snippet with placeholders like [REDACTED_KEY], [REDACTED_PHONE].

Document Title: ${title}
Content:
${content.substring(0, 3000)}
`;

    const response = await ai.generate({
      prompt: systemPrompt,
      output: { schema: governanceAuditOutputSchema },
      config: {
        temperature: 0.1,
      },
    });

    if (!response.output) {
      return {
        hasPiiRisk: false,
        piiItemsFound: [],
        hasUnsupportedAssertions: false,
        unsupportedStatements: [],
        complianceScore: 100,
        recommendations: [],
      };
    }

    return response.output;
  }
);
