import { ai } from '../genkit';
import { z } from 'genkit';

/**
 * Ask SmartSapp Knowledge RAG Orchestration Flow (Company Brain Phase 4).
 *
 * Grounded synthesis flow that ingests retrieved knowledge chunks and answers
 * natural language queries across notes, CRM records, calls, and tasks with
 * explicit evidence citations and confidence scoring.
 */

export const ragChunkInputSchema = z.object({
  chunkId: z.string().describe('Unique identifier for this knowledge chunk'),
  objectId: z.string().describe('Source note/entity object ID'),
  sourceType: z
    .enum(['quick_note', 'entity_note', 'task_note', 'call_note', 'activity'])
    .describe('Origin source type'),
  title: z.string().describe('Title of the source record'),
  text: z.string().describe('Extracted text chunk content'),
  authorName: z.string().optional().describe('Author or creator name'),
  timestamp: z.string().optional().describe('Creation or event timestamp'),
  originHref: z.string().nullable().optional().describe('Direct link to source record'),
  relevanceScore: z.number().describe('Retrieval relevance score (0.0 to 1.0)'),
});

export const ragCitationOutputSchema = z.object({
  citationId: z.string().describe('Citation identifier referencing chunkId or objectId'),
  objectId: z.string().describe('Source object identifier'),
  sourceType: z
    .enum(['quick_note', 'entity_note', 'task_note', 'call_note', 'activity'])
    .describe('Source type of cited evidence'),
  title: z.string().describe('Title of the cited note or record'),
  authorName: z.string().optional().describe('Author name if available'),
  timestamp: z.string().optional().describe('Date or timestamp of the source'),
  excerpt: z.string().describe('Direct quote or supportive excerpt from the source text'),
  relevanceScore: z.number().describe('Relevance score between 0.0 and 1.0'),
  originHref: z.string().nullable().optional().describe('Deep link to the source document'),
});

export const ragActionSuggestionOutputSchema = z.object({
  title: z.string().describe('Concrete actionable task or next step'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).describe('Suggested priority'),
  rationale: z.string().optional().describe('Why this action is recommended based on evidence'),
  assigneeSuggestion: z.string().optional().describe('Recommended owner or role'),
});

export const askKnowledgeOutputSchema = z.object({
  answer: z.string().describe('Comprehensive, evidence-grounded answer to the user query'),
  confidence: z.enum(['high', 'medium', 'low']).describe('Overall confidence tier'),
  confidenceScore: z.number().min(0).max(100).describe('Confidence score between 0 and 100%'),
  state: z
    .enum(['answered', 'partial_evidence', 'no_evidence', 'restricted_evidence'])
    .describe('Result state based on available evidence'),
  keyFindings: z.array(z.string()).describe('Top takeaway bullet points'),
  citations: z.array(ragCitationOutputSchema).describe('Direct evidence citations used to formulate the answer'),
  recommendedActions: z
    .array(ragActionSuggestionOutputSchema)
    .describe('Actionable tasks extracted or inferred from the synthesis'),
  unresolvedQuestions: z
    .array(z.string())
    .describe('Questions or gaps identified where workspace knowledge is missing or ambiguous'),
});

export type AskKnowledgeOutput = z.infer<typeof askKnowledgeOutputSchema>;

export const askKnowledgeRagFlow = ai.defineFlow(
  {
    name: 'askKnowledgeRagFlow',
    inputSchema: z.object({
      query: z.string().describe('The user query or question'),
      retrievedChunks: z.array(ragChunkInputSchema).describe('Retrieved knowledge evidence chunks'),
      workspaceName: z.string().optional().describe('Name of the active workspace'),
      userRole: z.string().optional().describe('Role of the requesting user'),
      entityContext: z.string().optional().describe('Optional CRM entity scope (e.g. contact or deal name)'),
      customDirectives: z.string().optional().describe('Custom workspace AI directives from settings'),
    }),
    outputSchema: askKnowledgeOutputSchema,
  },
  async (input) => {
    const rawQuery = input.query.trim();
    if (!rawQuery) {
      return {
        answer: 'Please provide a question or topic to search.',
        confidence: 'low',
        confidenceScore: 0,
        state: 'no_evidence',
        keyFindings: [],
        citations: [],
        recommendedActions: [],
        unresolvedQuestions: [],
      };
    }

    if (!input.retrievedChunks || input.retrievedChunks.length === 0) {
      return {
        answer:
          "I couldn't find any relevant authorized notes, CRM interactions, or records matching your question in this workspace.",
        confidence: 'low',
        confidenceScore: 10,
        state: 'no_evidence',
        keyFindings: ['No matching workspace knowledge was found.'],
        citations: [],
        recommendedActions: [],
        unresolvedQuestions: ['Would you like to capture a new note or expand the search terms?'],
      };
    }

    // Format retrieved evidence chunks into structured context block
    const formattedEvidence = input.retrievedChunks
      .map((chunk, idx) => {
        return `[EVIDENCE #${idx + 1}] (ChunkID: "${chunk.chunkId}", ObjectID: "${chunk.objectId}", Source: ${chunk.sourceType}, Title: "${chunk.title}", Date: ${chunk.timestamp || 'Unknown'}, Author: ${chunk.authorName || 'Unknown'}, Relevance: ${Math.round(chunk.relevanceScore * 100)}%):
"${chunk.text}"
---`;
      })
      .join('\n\n');

    const systemPrompt = `You are "SmartSapp Company Brain" — an authoritative, evidence-backed Knowledge Intelligence AI assistant.
Your goal is to answer the user's question with 100% factual accuracy strictly using the provided Evidence Chunks.

CORE GROUNDING RULES:
1. Grounding Integrity: Only state facts, observations, and conclusions supported by the provided evidence chunks. Never hallucinate or invent records.
2. Direct Citations: For every key factual claim in your answer, map it to a citation with the exact chunkId, objectId, title, and a direct excerpt.
3. State Determination:
   - If the evidence clearly answers the query: state = "answered", confidence = "high" (80-100%).
   - If the evidence is sparse or only touches on part of the query: state = "partial_evidence", confidence = "medium" (40-79%).
   - If the evidence is irrelevant to the query: state = "no_evidence", confidence = "low" (0-39%).
4. Tone & Style: Clear, professional, concise everyday business English. Avoid jargon.
5. Action Extraction: Identify concrete next steps or operational follow-ups supported by the notes.
6. Organization Directives: ${input.customDirectives || 'Standard organizational synthesis'}.
${input.entityContext ? `7. Scoped Context: Focus on entity "${input.entityContext}".` : ''}`;

    const prompt = `User Query: "${rawQuery}"

Workspace: ${input.workspaceName || 'SmartSapp Workspace'}
Requester: ${input.userRole || 'Team Member'}

AVAILABLE EVIDENCE CHUNKS:
${formattedEvidence}

Analyze the evidence carefully and generate the structured response adhering strictly to the output schema.`;

    const response = await ai.generate({
      system: systemPrompt,
      prompt,
      output: { schema: askKnowledgeOutputSchema },
      config: {
        temperature: 0.2, // Low temperature for high factual grounding
      },
    });

    const output = response.output;
    if (!output) {
      throw new Error('Company Brain RAG synthesis failed to produce an answer.');
    }

    // Enrich citations with originHref from input chunks if missing
    const chunkMap = new Map(input.retrievedChunks.map((c) => [c.chunkId, c]));
    const enrichedCitations = output.citations.map((c) => {
      const match = chunkMap.get(c.citationId) || input.retrievedChunks.find((chunk) => chunk.objectId === c.objectId);
      return {
        ...c,
        originHref: c.originHref || match?.originHref || null,
        sourceType: c.sourceType || match?.sourceType || 'quick_note',
        authorName: c.authorName || match?.authorName,
        timestamp: c.timestamp || match?.timestamp,
      };
    });

    return {
      ...output,
      citations: enrichedCitations,
    };
  }
);
