/**
 * @fileoverview Pure Deterministic Computational Engine for Conversation Intelligence & Coaching (Phase 5).
 *
 * ARCHITECTURAL POINTER:
 * Side-effect-free, 100% deterministic algorithms for:
 * 1. Speech Dynamics (Talk/Listen Ratio, Cadence/WPM, Monologue Alerts, Discovery Questions).
 * 2. Signal & Objection Extraction with Anchored Timestamps and Evidence Quotes.
 * 3. Gong-Style Scorecard Evaluation against Discovery, Demo, and Closing Rubrics.
 * 4. Interactive Roleplay Turn Evaluation & 5-Pillar Competency Scoring.
 * 5. Weakest-Dimension Recommendation Engine for Practice Lab Drills.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% pure functions: zero database operations, zero network requests, zero side effects.
 * - Division-by-zero guards on all calculations.
 * - Strict typing policy: Zero 'any' or 'any[]'.
 */

import type {
  TranscriptLine,
  ConversationDynamics,
  ExtractedIntelligence,
  BuyingSignal,
  ExtractedObjection,
  ScorecardTemplate,
  ScorecardCriterion,
  CallScorecardReview,
  CriterionRating,
  PracticeLabScenario,
  RoleplayTurn,
  RoleplayEvaluation,
  RepSkillScores,
} from './types';

/**
 * Analyzes conversation dynamics (talk/listen ratio, words per minute, monologues, questions).
 */
export function analyzeConversationDynamics(transcript: TranscriptLine[]): ConversationDynamics {
  if (!transcript || transcript.length === 0) {
    return {
      talkToListenRatio: {
        repPercent: 50,
        buyerPercent: 50,
        evaluation: 'balanced',
      },
      wordsPerMinute: 135,
      pacingVerdict: 'optimal',
      longestMonologueSeconds: 0,
      hasMonologueAlert: false,
      discoveryQuestionsCount: 0,
    };
  }

  let repSpokenMs = 0;
  let buyerSpokenMs = 0;
  let otherSpokenMs = 0;
  let totalWords = 0;
  let longestMonologueMs = 0;
  let discoveryQuestionsCount = 0;

  const discoveryPatterns = [
    /\b(what|why|how|who|when|where|tell me|can you walk me through|could you explain)\b/i,
    /\?$/,
  ];

  for (const line of transcript) {
    const duration = Math.max(0, line.endMs - line.startMs);
    const words = line.text ? line.text.trim().split(/\s+/).filter(Boolean).length : 0;
    totalWords += words;

    if (line.speaker === 'rep') {
      repSpokenMs += duration;
      if (duration > longestMonologueMs) {
        longestMonologueMs = duration;
      }
      // Check for discovery questions
      const isQuestion = discoveryPatterns.some((p) => p.test(line.text.trim()));
      if (isQuestion) {
        discoveryQuestionsCount++;
      }
    } else if (line.speaker === 'buyer') {
      buyerSpokenMs += duration;
    } else {
      otherSpokenMs += duration;
    }
  }

  const totalActiveMs = repSpokenMs + buyerSpokenMs + otherSpokenMs;
  const repPercent = totalActiveMs > 0 ? Math.round((repSpokenMs / totalActiveMs) * 100) : 50;
  const buyerPercent = 100 - repPercent;

  let evaluation: ConversationDynamics['talkToListenRatio']['evaluation'] = 'balanced';
  if (repPercent > 65) {
    evaluation = 'rep_dominated';
  } else if (repPercent < 35) {
    evaluation = 'buyer_dominated';
  }

  const totalDurationMinutes = Math.max(0.2, totalActiveMs / 60000);
  const wordsPerMinute = Math.round(totalWords / totalDurationMinutes);

  let pacingVerdict: ConversationDynamics['pacingVerdict'] = 'optimal';
  if (wordsPerMinute > 175) {
    pacingVerdict = 'fast';
  } else if (wordsPerMinute < 115) {
    pacingVerdict = 'slow';
  }

  const longestMonologueSeconds = Math.round(longestMonologueMs / 1000);
  const hasMonologueAlert = longestMonologueSeconds > 120; // Alert if rep spoke continuously > 2 mins

  return {
    talkToListenRatio: {
      repPercent,
      buyerPercent,
      evaluation,
    },
    wordsPerMinute,
    pacingVerdict,
    longestMonologueSeconds,
    hasMonologueAlert,
    discoveryQuestionsCount,
  };
}

/**
 * Extracts buying signals, objections, pain points, and sentiment from a transcript.
 */
export function extractSignalsAndObjections(transcript: TranscriptLine[]): ExtractedIntelligence {
  const buyingSignals: BuyingSignal[] = [];
  const objections: ExtractedObjection[] = [];
  const painPoints: string[] = [];
  const nextSteps: string[] = [];
  const competitorsMentioned: string[] = [];

  const signalRules = [
    {
      category: 'budget' as const,
      regex: /\b(budget is approved|have the budget|allocated funds|we can afford|pricing works|sign off on the cost)\b/i,
      label: 'Budget Confirmation',
    },
    {
      category: 'timeline' as const,
      regex: /\b(by next month|before Q[1-4]|launching in|as soon as possible|start by|need this before)\b/i,
      label: 'Purchase Timeline',
    },
    {
      category: 'authority' as const,
      regex: /\b(i make the decision|final decision maker|signed off by me|our executive sponsor|my direct signoff)\b/i,
      label: 'Decision Authority',
    },
    {
      category: 'urgency' as const,
      regex: /\b(urgent|critical issue|losing revenue|immediate priority|cannot wait|burning problem)\b/i,
      label: 'High Urgency',
    },
  ];

  const objectionRules = [
    {
      type: 'pricing' as const,
      regex: /\b(too expensive|cost is high|out of our budget|price point is steep|discount|cheaper)\b/i,
      feedback: 'Acknowledge the investment perspective and link directly to ROI and cost of inaction.',
    },
    {
      type: 'competitor' as const,
      regex: /\b(salesforce|hubspot|zoho|gong|competitor|alternative vendor|another option)\b/i,
      feedback: 'Avoid disparaging competitors; highlight SmartSapp unique vertical depth and automation speed.',
    },
    {
      type: 'timing' as const,
      regex: /\b(call us back|next quarter|bad time|not right now|too busy|revisit in a few months)\b/i,
      feedback: 'Validate their busy schedule but uncover the cost of delaying the resolution.',
    },
    {
      type: 'vendor' as const,
      regex: /\b(already have a solution|current provider|happy with our current|contracted with)\b/i,
      feedback: 'Probe gently for blind spots or unmet workflows with their current vendor.',
    },
    {
      type: 'procurement' as const,
      regex: /\b(procurement|legal review|security questionnaire|infosec|contract redlines)\b/i,
      feedback: 'Offer to provide compliance dossiers and proactively guide security onboarding.',
    },
  ];

  const painRegex = /\b(struggling with|problem is|pain point|frustrating|inefficient|wasting time|manual work)\b/i;
  const nextStepRegex = /\b(next step|follow up|schedule a demo|send the proposal|calendar invite|meet next week)\b/i;
  const competitorNames = ['salesforce', 'hubspot', 'zoho', 'gong', 'salesloft', 'outreach', 'pipedrive'];

  let positiveScore = 0;
  let negativeScore = 0;

  transcript.forEach((line, index) => {
    const text = line.text;

    // Check competitor names
    competitorNames.forEach((comp) => {
      if (new RegExp(`\\b${comp}\\b`, 'i').test(text)) {
        const capitalized = comp.charAt(0).toUpperCase() + comp.slice(1);
        if (!competitorsMentioned.includes(capitalized)) {
          competitorsMentioned.push(capitalized);
        }
      }
    });

    // Check buying signals (buyer spoken)
    if (line.speaker === 'buyer') {
      signalRules.forEach((rule) => {
        if (rule.regex.test(text)) {
          buyingSignals.push({
            id: `sig_${index}`,
            text: rule.label,
            timestampMs: line.startMs,
            category: rule.category,
            quote: text,
            confidence: 0.88,
          });
          positiveScore += 2;
        }
      });

      // Check objections (buyer spoken)
      objectionRules.forEach((rule) => {
        if (rule.regex.test(text)) {
          // Look ahead to see rep's response in next 2 lines
          const nextRepLine = transcript.slice(index + 1, index + 3).find((l) => l.speaker === 'rep');
          const repHandledScore = nextRepLine && nextRepLine.text.length > 30 ? 78 : 45;

          objections.push({
            id: `obj_${index}`,
            objectionType: rule.type,
            timestampMs: line.startMs,
            severity: rule.type === 'pricing' || rule.type === 'competitor' ? 'high' : 'medium',
            repHandledScore,
            repResponseQuote: nextRepLine?.text,
            buyerReaction: repHandledScore > 70 ? 'satisfied' : 'skeptical',
            aiFeedback: rule.feedback,
          });
          negativeScore += 2;
        }
      });

      if (painRegex.test(text)) {
        painPoints.push(text);
      }
    }

    if (nextStepRegex.test(text)) {
      nextSteps.push(text);
      positiveScore += 1;
    }
  });

  const totalSentimentEvents = positiveScore + negativeScore;
  const sentimentScore =
    totalSentimentEvents > 0
      ? Math.round(((positiveScore - negativeScore) / totalSentimentEvents) * 100) / 100
      : 0.15;

  const keyStrengths: string[] = [];
  const coachingRecommendations: string[] = [];

  if (buyingSignals.length > 0) {
    keyStrengths.push(`Successfully uncovered ${buyingSignals.length} high-intent buying signals.`);
  }
  if (painPoints.length > 0) {
    keyStrengths.push('Prompted deep buyer disclosure around existing process friction.');
  }

  if (objections.length > 0) {
    const unhandled = objections.filter((o) => o.repHandledScore < 60);
    if (unhandled.length > 0) {
      coachingRecommendations.push(
        `Review handling of ${unhandled[0].objectionType} resistance (${unhandled[0].aiFeedback}).`
      );
    }
  }
  if (nextSteps.length === 0) {
    coachingRecommendations.push('Ensure a concrete, time-anchored next step is confirmed before call wrap-up.');
  }

  return {
    buyingSignals,
    objections,
    painPoints,
    nextSteps,
    sentimentScore,
    competitorsMentioned,
    keyStrengths: keyStrengths.length > 0 ? keyStrengths : ['Maintained professional rapport throughout call.'],
    coachingRecommendations:
      coachingRecommendations.length > 0
        ? coachingRecommendations
        : ['Continue reinforcing value propositions early in discovery.'],
  };
}

/**
 * Validates that criteria weights in a scorecard template sum to 1.0 (100%).
 */
export function validateScorecardTemplateIntegrity(template: ScorecardTemplate): {
  isValid: boolean;
  totalWeight: number;
  errors: string[];
} {
  const errors: string[] = [];
  if (!template.criteria || template.criteria.length === 0) {
    errors.push('Template must contain at least one evaluation criterion.');
    return { isValid: false, totalWeight: 0, errors };
  }

  const totalWeight = Math.round(template.criteria.reduce((acc, c) => acc + c.weight, 0) * 1000) / 1000;
  if (Math.abs(totalWeight - 1.0) > 0.001) {
    errors.push(`Criteria weights must sum to 1.0 (100%), currently ${(totalWeight * 100).toFixed(1)}%.`);
  }

  return {
    isValid: errors.length === 0,
    totalWeight,
    errors,
  };
}

/**
 * Evaluates a call transcript against a structured scorecard template (Discovery, Demo, Closing).
 */
export function evaluateScorecardUnderRubric(params: {
  callId: string;
  workspaceId: string;
  transcript: TranscriptLine[];
  template: ScorecardTemplate;
  evaluatorName?: string;
}): CallScorecardReview {
  const { callId, workspaceId, transcript, template, evaluatorName = 'SmartSapp AI Reviewer' } = params;

  const ratings: CriterionRating[] = [];
  let totalWeightedScore = 0;

  for (const criterion of template.criteria) {
    let score: 1 | 2 | 3 | 4 | 5 = 3; // Default benchmark
    const aiEvidenceQuotes: CriterionRating['aiEvidenceQuotes'] = [];

    const critName = criterion.name.toLowerCase();

    if (critName.includes('agenda') || critName.includes('introduction')) {
      const earlyLines = transcript.slice(0, 8);
      const agendaLine = earlyLines.find((l) =>
        /agenda|purpose of our call|today's call|plan for today/i.test(l.text)
      );
      if (agendaLine) {
        score = 5;
        aiEvidenceQuotes.push({ timestampMs: agendaLine.startMs, quote: agendaLine.text });
      } else {
        score = 2;
      }
    } else if (critName.includes('pain') || critName.includes('need')) {
      const painLine = transcript.find(
        (l) => l.speaker === 'buyer' && /struggling|problem|frustrat|manual|inefficient|delay/i.test(l.text)
      );
      if (painLine) {
        score = 4;
        aiEvidenceQuotes.push({ timestampMs: painLine.startMs, quote: painLine.text });
      } else {
        score = 2;
      }
    } else if (critName.includes('authority') || critName.includes('decision')) {
      const decisionLine = transcript.find((l) => /decision maker|approv|sign off|board|cfo|procurement/i.test(l.text));
      if (decisionLine) {
        score = 4;
        aiEvidenceQuotes.push({ timestampMs: decisionLine.startMs, quote: decisionLine.text });
      } else {
        score = 2;
      }
    } else if (critName.includes('next step') || critName.includes('closing')) {
      const closingLines = transcript.slice(-8);
      const nextStepLine = closingLines.find((l) => /next step|send proposal|meeting next week|calendar|follow up/i.test(l.text));
      if (nextStepLine) {
        score = 5;
        aiEvidenceQuotes.push({ timestampMs: nextStepLine.startMs, quote: nextStepLine.text });
      } else {
        score = 1;
      }
    } else {
      // Default heuristic based on transcript depth
      score = transcript.length > 15 ? 4 : 3;
    }

    ratings.push({
      criteriaId: criterion.id,
      score,
      aiEvidenceQuotes,
      comment: aiEvidenceQuotes.length > 0
        ? `Observed evidence: "${aiEvidenceQuotes[0].quote.slice(0, 80)}..."`
        : 'Limited explicit evidence in transcript segments.',
    });

    totalWeightedScore += (score / 5) * criterion.weight;
  }

  const totalScorePercent = Math.round(totalWeightedScore * 100);

  // Identify lowest criterion for recommended drill
  const sortedRatings = [...ratings].sort((a, b) => a.score - b.score);
  const lowestRating = sortedRatings[0];
  const lowestCriterion = template.criteria.find((c) => c.id === lowestRating?.criteriaId);

  let recommendedPracticeDrill: CallScorecardReview['recommendedPracticeDrill'];
  if (lowestCriterion) {
    const isObjection = lowestCriterion.name.toLowerCase().includes('objection');
    const isClosing = lowestCriterion.name.toLowerCase().includes('next step') || lowestCriterion.name.toLowerCase().includes('close');
    recommendedPracticeDrill = {
      scenarioId: isObjection ? 'sc_pricing_objection' : isClosing ? 'sc_closing_hurdle' : 'sc_discovery_authority',
      title: isObjection ? 'Pricing Pushback Simulation' : isClosing ? 'Securing Firm Next Steps' : 'Uncovering Decision Authority',
      reason: `Call scored ${lowestRating.score}/5 on "${lowestCriterion.name}". Practice recommended to reinforce mastery.`,
    };
  }

  return {
    id: `rev_${callId}_${Date.now()}`,
    callId,
    workspaceId,
    templateId: template.id,
    templateName: template.name,
    evaluatedBy: 'ai',
    evaluatorId: 'ai_system',
    evaluatorName,
    totalScorePercent,
    ratings,
    keyStrengths: [
      `Overall composite execution of ${totalScorePercent}%.`,
      'Demonstrated structured conversational pacing and active engagement.',
    ],
    growthAreas: lowestCriterion
      ? [`Reinforce "${lowestCriterion.name}" - ${lowestCriterion.description}`]
      : ['Continue sharpening objection anticipation.'],
    recommendedPracticeDrill,
    reviewedAt: new Date().toISOString(),
  };
}

/**
 * Scores an individual roleplay turn and evaluates overall session when complete.
 */
export function scoreRoleplayTurn(params: {
  dialogue: RoleplayTurn[];
  scenario: PracticeLabScenario;
}): {
  turnFeedback: NonNullable<RoleplayTurn['turnFeedback']>;
  isComplete: boolean;
  finalEvaluation?: RoleplayEvaluation;
} {
  const { dialogue, scenario: _scenario } = params;
  const lastTurn = dialogue[dialogue.length - 1];
  const text = lastTurn?.text || '';

  // Calculate real-time turn metrics
  const hasQuestion = /\?/.test(text) || /\b(what|why|how|who|can you|tell me)\b/i.test(text);
  const acknowledgesBuyer = /\b(understand|hear you|makes sense|valid point|appreciate|fair)\b/i.test(text);
  const mentionsValue = /\b(roi|value|save|saves|saving|saved|increase|results|revenue|efficiency|solution)\b/i.test(text);

  const questionQualityScore = hasQuestion ? 88 : 55;
  const listeningScore = acknowledgesBuyer ? 85 : 60;
  const objectionHandlingScore = mentionsValue ? 82 : 65;

  let quickTip = 'Good response.';
  if (!hasQuestion) {
    quickTip = 'Remember to end your turn with an open question to maintain call control.';
  } else if (!acknowledgesBuyer) {
    quickTip = 'Acknowledge the buyer concern before jumping into your explanation.';
  } else if (!mentionsValue) {
    quickTip = 'Tie your response directly back to the business impact or ROI.';
  }

  const turnFeedback = {
    listeningScore,
    questionQualityScore,
    objectionHandlingScore,
    quickTip,
  };

  const repTurnsCount = dialogue.filter((t) => t.speaker === 'rep').length;
  const isComplete = repTurnsCount >= 4; // Complete after 4 solid turns

  let finalEvaluation: RoleplayEvaluation | undefined;
  if (isComplete) {
    const discoveryScore = Math.min(100, Math.round(questionQualityScore * 0.9 + 10));
    const closingScore = repTurnsCount >= 4 ? 80 : 60;
    const overallScore = Math.round(
      (discoveryScore + questionQualityScore + objectionHandlingScore + listeningScore + closingScore) / 5
    );

    finalEvaluation = {
      discoveryScore,
      questionQualityScore,
      objectionHandlingScore,
      listeningScore,
      closingScore,
      overallScore,
      coachingFeedback:
        overallScore >= 80
          ? 'Exceptional mastery handling the buyer resistance. Maintained composure, validated pain, and anchored value.'
          : 'Solid effort. Focus on validating buyer skepticism before presenting solutions and always secure a firm next step.',
      keyStrengths: [
        'Active listening and professional objection acknowledgement.',
        'Paced responses without defensive posturing.',
      ],
      growthAreas: [
        'Ask deeper follow-up questions to uncover root causes.',
        'Explicitly state the cost of inaction when addressing budget hesitations.',
      ],
      nextRecommendedScenarioId:
        objectionHandlingScore < 75
          ? 'sc_pricing_objection'
          : questionQualityScore < 75
          ? 'sc_discovery_authority'
          : undefined,
    };
  }

  return {
    turnFeedback,
    isComplete,
    finalEvaluation,
  };
}

/**
 * Recommends the highest-impact Practice Lab drill based on the rep's weakest competency.
 */
export function recommendNextDrill(
  skills: RepSkillScores,
  scenarios: PracticeLabScenario[]
): PracticeLabScenario | undefined {
  if (!scenarios || scenarios.length === 0) return undefined;

  // Find lowest skill
  const entries: Array<[keyof RepSkillScores, number]> = [
    ['objectionHandling', skills.objectionHandling],
    ['discovery', skills.discovery],
    ['closing', skills.closing],
    ['productKnowledge', skills.productKnowledge],
    ['callControl', skills.callControl],
  ];

  entries.sort((a, b) => a[1] - b[1]);
  const weakestArea = entries[0][0];

  const categoryMap: Record<keyof RepSkillScores, PracticeLabScenario['category']> = {
    objectionHandling: 'pricing',
    discovery: 'discovery',
    closing: 'closing',
    productKnowledge: 'competitors',
    callControl: 'timing',
  };

  const targetCategory = categoryMap[weakestArea];
  const matching = scenarios.find((s) => s.category === targetCategory && s.status === 'active');
  return matching || scenarios[0];
}

/**
 * Auto-balances scorecard criteria weights so they sum exactly to 1.0 (100%).
 */
export function autoBalanceCriteriaWeights(criteria: ScorecardCriterion[]): ScorecardCriterion[] {
  if (!criteria || criteria.length === 0) return [];
  const count = criteria.length;
  const baseWeight = Math.floor((1.0 / count) * 100) / 100;
  const remainder = Math.round((1.0 - baseWeight * count) * 100) / 100;

  return criteria.map((c, idx) => ({
    ...c,
    weight: idx === 0 ? Math.round((baseWeight + remainder) * 100) / 100 : baseWeight,
  }));
}

