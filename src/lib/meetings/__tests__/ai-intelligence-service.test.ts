import { describe, it, expect } from 'vitest';
import {
  buildIntelligenceExtractionPrompt,
  parseIntelligenceStructuredOutput,
} from '../ai-intelligence-service';

describe('AI Meeting Intelligence Service', () => {
  it('constructs structured prompt containing attendees and transcript text', () => {
    const prompt = buildIntelligenceExtractionPrompt(
      'Quarterly Sales Review',
      'Alice: We exceeded target by 15%.\nBob: Great job team.',
      ['Alice Smith', 'Bob Jones']
    );

    expect(prompt).toContain('Quarterly Sales Review');
    expect(prompt).toContain('Alice Smith, Bob Jones');
    expect(prompt).toContain('We exceeded target by 15%');
    expect(prompt).toContain('executiveSummary');
    expect(prompt).toContain('actionItems');
  });

  it('parses valid AI JSON response into typed MeetingIntelligence domain model', () => {
    const rawAiResponse = JSON.stringify({
      executiveSummary: 'The team reviewed quarterly progress and agreed on product launch dates.',
      keyTopics: ['Q3 Revenue', 'Product Launch', 'Hiring'],
      keyDecisions: ['Launch date set for October 15'],
      actionItems: [
        {
          text: 'Draft press release',
          assigneeName: 'Alice',
          priority: 'high',
        },
      ],
      buyingSignals: [
        {
          topic: 'Enterprise Plan',
          quote: 'We want to onboard 500 users next month',
          strength: 'strong',
        },
      ],
      objections: [
        {
          category: 'pricing',
          statement: 'Implementation fee seems high',
          severity: 'medium',
          suggestedResponse: 'Offer tiered rollout option',
        },
      ],
      dealRisks: ['Budget approval pending CFO sign-off'],
      sentiment: {
        category: 'positive',
        score: 0.8,
        explanation: 'Client expressed high enthusiasm for feature set.',
      },
      recommendedFollowUp: 'Send formal contract proposal with implementation discount.',
    });

    const intel = parseIntelligenceStructuredOutput(rawAiResponse, 'meeting_123', 'ws_456');

    expect(intel.meetingId).toBe('meeting_123');
    expect(intel.workspaceId).toBe('ws_456');
    expect(intel.executiveSummary).toContain('quarterly progress');
    expect(intel.keyTopics).toEqual(['Q3 Revenue', 'Product Launch', 'Hiring']);
    expect(intel.keyDecisions).toEqual(['Launch date set for October 15']);
    expect(intel.actionItems).toHaveLength(1);
    expect(intel.actionItems[0].text).toBe('Draft press release');
    expect(intel.actionItems[0].assigneeName).toBe('Alice');
    expect(intel.actionItems[0].priority).toBe('high');
    expect(intel.buyingSignals).toHaveLength(1);
    expect(intel.buyingSignals[0].strength).toBe('strong');
    expect(intel.objections).toHaveLength(1);
    expect(intel.objections[0].category).toBe('pricing');
    expect(intel.sentiment.category).toBe('positive');
    expect(intel.sentiment.score).toBe(0.8);
  });

  it('handles markdown code fence wrapped AI JSON output safely', () => {
    const fencedOutput = `\`\`\`json
{
  "executiveSummary": "Summary inside markdown fence",
  "keyTopics": ["Demo"],
  "keyDecisions": [],
  "actionItems": [],
  "buyingSignals": [],
  "objections": [],
  "dealRisks": [],
  "sentiment": {
    "category": "neutral",
    "score": 0.0,
    "explanation": "Neutral tone"
  },
  "recommendedFollowUp": "Follow up tomorrow"
}
\`\`\``;

    const intel = parseIntelligenceStructuredOutput(fencedOutput, 'meeting_999', 'ws_999');
    expect(intel.executiveSummary).toBe('Summary inside markdown fence');
    expect(intel.keyTopics).toEqual(['Demo']);
  });
});
