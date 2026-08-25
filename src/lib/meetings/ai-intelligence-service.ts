/**
 * @fileoverview Pure AI Meeting Intelligence Service.
 * Constructs Gemini structured prompts and validates LLM extraction schemas for
 * executive summaries, action items, buying signals, objections, and sentiment analysis.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% pure parsing logic with defensive JSON validation.
 * - Handles markdown-wrapped JSON code blocks (```json ... ```) gracefully.
 */

import type {
  MeetingIntelligence,
  MeetingActionItem,
  BuyingSignal,
  CustomerObjection,
  SentimentAnalysis,
} from './types/intelligence';

/**
 * Builds the structured prompt for extracting meeting intelligence from a transcript.
 */
export function buildIntelligenceExtractionPrompt(
  meetingTitle: string,
  transcriptText: string,
  attendees: string[] = []
): string {
  return `You are an executive AI meeting intelligence analyst.
Analyze the following meeting transcript and extract structured insights in strict JSON format.

Meeting Title: "${meetingTitle}"
Attendees: ${attendees.join(', ') || 'Unknown'}

Transcript:
"""
${transcriptText}
"""

Return ONLY a JSON object matching this exact TypeScript schema:
{
  "executiveSummary": "A concise 2-3 paragraph executive summary of what was discussed, key themes, and main outcomes.",
  "keyTopics": ["Topic 1", "Topic 2", "Topic 3"],
  "keyDecisions": ["Decision 1 agreed upon by the team", "Decision 2"],
  "actionItems": [
    {
      "text": "Specific task to execute",
      "assigneeName": "Name of person responsible (or null if unassigned)",
      "priority": "high | medium | low"
    }
  ],
  "buyingSignals": [
    {
      "topic": "Interest area",
      "quote": "Direct quote demonstrating intent or purchase readiness",
      "strength": "strong | moderate | weak"
    }
  ],
  "objections": [
    {
      "category": "pricing | timing | feature | competitor | authority | other",
      "statement": "The prospect objection or hesitation raised",
      "severity": "high | medium | low",
      "suggestedResponse": "Recommended talking point or follow-up response"
    }
  ],
  "dealRisks": ["Risk factor 1", "Risk factor 2"],
  "sentiment": {
    "category": "positive | neutral | negative | mixed",
    "score": 0.85, // Float between -1.0 (very negative) and 1.0 (very positive)
    "explanation": "Brief explanation of tone and sentiment throughout the call"
  },
  "recommendedFollowUp": "Recommended immediate next step email or communication"
}`;
}

/**
 * Parses and validates raw LLM text into a typed MeetingIntelligence object.
 */
export function parseIntelligenceStructuredOutput(
  rawText: string,
  meetingId: string,
  workspaceId: string
): MeetingIntelligence {
  const now = new Date().toISOString();
  let cleanJson = rawText.trim();

  // Strip markdown code fence if present
  if (cleanJson.startsWith('```')) {
    cleanJson = cleanJson.replace(/^```(json)?\n?/, '').replace(/\n?```$/, '').trim();
  }

  try {
    const parsed = JSON.parse(cleanJson);

    const actionItems: MeetingActionItem[] = Array.isArray(parsed.actionItems)
      ? parsed.actionItems.map((item: Record<string, unknown>, idx: number) => ({
          id: `ai_task_${Date.now()}_${idx}`,
          text: String(item.text || 'Action item'),
          assigneeName: item.assigneeName ? String(item.assigneeName) : undefined,
          priority: ['high', 'medium', 'low'].includes(String(item.priority))
            ? (String(item.priority) as MeetingActionItem['priority'])
            : 'medium',
          status: 'open',
        }))
      : [];

    const buyingSignals: BuyingSignal[] = Array.isArray(parsed.buyingSignals)
      ? parsed.buyingSignals.map((b: Record<string, unknown>) => ({
          topic: String(b.topic || 'General Interest'),
          quote: String(b.quote || ''),
          strength: ['strong', 'moderate', 'weak'].includes(String(b.strength))
            ? (String(b.strength) as BuyingSignal['strength'])
            : 'moderate',
        }))
      : [];

    const objections: CustomerObjection[] = Array.isArray(parsed.objections)
      ? parsed.objections.map((o: Record<string, unknown>) => ({
          category: ['pricing', 'timing', 'feature', 'competitor', 'authority', 'other'].includes(
            String(o.category)
          )
            ? (String(o.category) as CustomerObjection['category'])
            : 'other',
          statement: String(o.statement || ''),
          severity: ['high', 'medium', 'low'].includes(String(o.severity))
            ? (String(o.severity) as CustomerObjection['severity'])
            : 'medium',
          suggestedResponse: o.suggestedResponse ? String(o.suggestedResponse) : undefined,
        }))
      : [];

    const sentiment: SentimentAnalysis = parsed.sentiment && typeof parsed.sentiment === 'object'
      ? {
          category: ['positive', 'neutral', 'negative', 'mixed'].includes(
            String(parsed.sentiment.category)
          )
            ? (String(parsed.sentiment.category) as SentimentAnalysis['category'])
            : 'neutral',
          score: typeof parsed.sentiment.score === 'number' ? parsed.sentiment.score : 0,
          explanation: String(parsed.sentiment.explanation || 'Sentiment analyzed from discussion flow.'),
        }
      : {
          category: 'neutral',
          score: 0,
          explanation: 'Standard professional discussion.',
        };

    return {
      id: `intel_${meetingId}`,
      workspaceId,
      meetingId,
      executiveSummary: String(parsed.executiveSummary || 'Meeting completed successfully.'),
      keyTopics: Array.isArray(parsed.keyTopics) ? parsed.keyTopics.map(String) : [],
      keyDecisions: Array.isArray(parsed.keyDecisions) ? parsed.keyDecisions.map(String) : [],
      actionItems,
      buyingSignals,
      objections,
      dealRisks: Array.isArray(parsed.dealRisks) ? parsed.dealRisks.map(String) : [],
      sentiment,
      recommendedFollowUp: String(parsed.recommendedFollowUp || 'Send summary email to attendees.'),
      status: 'completed',
      generatedAt: now,
      updatedAt: now,
    };
  } catch (parseErr) {
    console.warn('[parseIntelligenceStructuredOutput] Failed to parse AI JSON:', parseErr);

    return {
      id: `intel_${meetingId}`,
      workspaceId,
      meetingId,
      executiveSummary: rawText.slice(0, 500),
      keyTopics: [],
      keyDecisions: [],
      actionItems: [],
      buyingSignals: [],
      objections: [],
      dealRisks: [],
      sentiment: { category: 'neutral', score: 0, explanation: 'Unable to parse detailed sentiment.' },
      recommendedFollowUp: 'Follow up with meeting notes.',
      status: 'completed',
      generatedAt: now,
      updatedAt: now,
    };
  }
}
