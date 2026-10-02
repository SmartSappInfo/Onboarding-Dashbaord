/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — AI Synthetic Persona & Pre-Flight Friction Cockpit Engine
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Simulates realistic respondent behavior across 5 cognitive personas:
 *    - Speeder: Rapid skimmer, skips optional open text, drops off on text walls.
 *    - Thorough: Deep reader, comprehensive answers, very low drop-off.
 *    - Fatigued: Accumulates cognitive fatigue, drops off on long surveys (>8-10 questions).
 *    - Skeptic: Critical detractor, privacy-sensitive, drops off on personal requests, low NPS.
 *    - Promoter: Enthusiastic advocate, resilient completer, high NPS/CSAT.
 * 2. Pre-flight friction cockpit calculates drop-off rates, dwell times, composite friction scores,
 *    and produces contextual, actionable recommendations before publishing.
 * 3. STRICT ZERO-`any` / ZERO-`any[]` Invariant: All types must be explicit, strongly typed TypeScript.
 * 4. Division-by-zero resilience for empty surveys and edge cases.
 */

import type { Survey, SurveyElement, SurveyQuestion } from '@/lib/types';

// ─── TYPES & INTERFACES ─────────────────────────────────────────────────────

export type SyntheticPersonaType = 'speeder' | 'thorough' | 'fatigued' | 'skeptic' | 'promoter';

export interface SyntheticPersonaConfig {
  id: SyntheticPersonaType;
  name: string;
  description: string;
  avatar: string;
  behaviorTraits: string[];
  dropOffPropensity: number;
  speedMultiplier: number;
}

export interface SyntheticRunResult {
  persona: SyntheticPersonaType;
  completed: boolean;
  durationSeconds: number;
  questionsAnswered: number;
  totalQuestions: number;
  dropOffQuestionId?: string;
  dropOffStepIndex?: number;
  dropOffReason?: string;
  answers: Record<string, unknown>;
  simulatedNps?: number;
  simulatedCsat?: number;
  sentiment: 'positive' | 'neutral' | 'negative';
}

export type FrictionRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface QuestionFrictionMetric {
  questionId: string;
  questionTitle: string;
  questionType: string;
  dropOffCount: number;
  dropOffRate: number;
  avgDwellTimeSeconds: number;
  frictionScore: number;
  riskLevel: FrictionRiskLevel;
  actionableRecommendation: string;
}

export interface PersonaBreakdownMetric {
  simulated: number;
  completed: number;
  completionRate: number;
  avgDurationSeconds: number;
  avgDropOffStep?: number;
}

export interface AudienceCohortSimulationResult {
  totalSimulated: number;
  completedCount: number;
  completionRate: number;
  averageDurationSeconds: number;
  medianDurationSeconds: number;
  personaBreakdown: Record<SyntheticPersonaType, PersonaBreakdownMetric>;
  questionFrictionAnalysis: QuestionFrictionMetric[];
  frictionPointsCount: number;
  predictedNps?: number;
  predictedCsat?: number;
  overallHealthScore: number;
  criticalAlerts: string[];
}

export type SurveyInputLike = Survey | { elements?: SurveyElement[]; title?: string };

// ─── PERSONA REGISTRY ───────────────────────────────────────────────────────

export const SYNTHETIC_PERSONAS: Record<SyntheticPersonaType, SyntheticPersonaConfig> = {
  speeder: {
    id: 'speeder',
    name: 'Rushed Speeder',
    description: 'Skims through questions at high velocity, skips optional open text, highly intolerant of walls of text.',
    avatar: '⚡',
    behaviorTraits: [
      'Rapid ~0.35x dwell time',
      'Skips optional open-text fields',
      'Abandons on required long-text or dense tables',
      'Neutral or impatient sentiment',
    ],
    dropOffPropensity: 0.35,
    speedMultiplier: 0.35,
  },
  thorough: {
    id: 'thorough',
    name: 'Thorough Analyst',
    description: 'Methodical and attentive, writes elaborate open feedback, rarely abandons unless survey is excessively long.',
    avatar: '🧐',
    behaviorTraits: [
      'Deliberate ~1.8x dwell time',
      'Completes optional open-text with rich detail',
      'Resilient to complex question formats',
      'Balanced, constructive sentiment',
    ],
    dropOffPropensity: 0.04,
    speedMultiplier: 1.8,
  },
  fatigued: {
    id: 'fatigued',
    name: 'Fatigued Mobile User',
    description: 'Begins cooperatively, but cognitive reserves rapidly drain after 8+ questions or complex matrices, triggering abandonment.',
    avatar: '🥱',
    behaviorTraits: [
      'Cumulative cognitive load sensitivity',
      'Drops off when survey exceeds 8-10 questions',
      'Intolerant of matrix grids & rankings',
      'Declining answer quality prior to drop-off',
    ],
    dropOffPropensity: 0.55,
    speedMultiplier: 0.9,
  },
  skeptic: {
    id: 'skeptic',
    name: 'Critical Detractor',
    description: 'Guarded and privacy-conscious, resistant to personal identification, biased towards critical ratings and low NPS.',
    avatar: '🤨',
    behaviorTraits: [
      'Detractor NPS (0-4) and low CSAT (1-2)',
      'Abandons on unexpected phone/email or file uploads',
      'Critical and skeptical comments',
      'Negative overall sentiment',
    ],
    dropOffPropensity: 0.40,
    speedMultiplier: 1.0,
  },
  promoter: {
    id: 'promoter',
    name: 'Brand Advocate',
    description: 'Enthusiastic and forgiving, awards top-box NPS (9-10) and high CSAT, perseveres through friction with positive feedback.',
    avatar: '🌟',
    behaviorTraits: [
      'Promoter NPS (9-10) and top CSAT (4-5)',
      'High completion resilience (~95%+)',
      'Positive praise in open fields',
      'Supportive engagement disposition',
    ],
    dropOffPropensity: 0.05,
    speedMultiplier: 1.1,
  },
};

// ─── HELPER ALGORITHMS ──────────────────────────────────────────────────────

const NON_QUESTION_TYPES = new Set([
  'section',
  'heading',
  'description',
  'divider',
  'image',
  'video',
  'logic',
  'html',
]);

/**
 * Extracts question elements from a survey element array safely.
 */
export function extractSurveyQuestions(elements?: SurveyElement[]): SurveyQuestion[] {
  if (!elements || !Array.isArray(elements)) return [];
  return elements.filter((el): el is SurveyQuestion => {
    return Boolean(el && el.id && el.type && !NON_QUESTION_TYPES.has(el.type));
  });
}

/**
 * Baseline dwell times (in seconds) by question type.
 */
export function getBaseDwellTimeSeconds(type: string, isRequired: boolean): number {
  switch (type) {
    case 'yes-no':
      return 4;
    case 'rating':
    case 'ces':
    case 'nps':
      return 5;
    case 'multiple-choice':
      return 6;
    case 'dropdown':
    case 'slider':
      return 7;
    case 'checkboxes':
      return 9;
    case 'text':
    case 'email':
    case 'phone':
    case 'number':
    case 'date':
    case 'time':
    case 'link':
      return isRequired ? 12 : 7;
    case 'long-text':
      return isRequired ? 26 : 14;
    case 'matrix':
      return 24;
    case 'ranking':
      return 20;
    case 'file-upload':
      return 22;
    case 'signature':
      return 15;
    case 'consent':
      return 5;
    default:
      return 8;
  }
}

/**
 * Evaluates cognitive burden and privacy friction weights.
 */
export function getQuestionFrictionWeights(question: SurveyQuestion): {
  cognitiveWeight: number;
  privacyWeight: number;
} {
  let cognitiveWeight = 1.0;
  let privacyWeight = 0.0;

  switch (question.type) {
    case 'matrix':
      cognitiveWeight = 3.6;
      break;
    case 'ranking':
      cognitiveWeight = 3.0;
      break;
    case 'long-text':
      cognitiveWeight = question.isRequired ? 3.4 : 1.8;
      break;
    case 'file-upload':
      cognitiveWeight = 2.8;
      privacyWeight = 2.2;
      break;
    case 'email':
    case 'phone':
      privacyWeight = question.isRequired ? 2.6 : 1.4;
      break;
    case 'signature':
      cognitiveWeight = 2.2;
      privacyWeight = 1.9;
      break;
    case 'checkboxes':
      cognitiveWeight = (question.options?.length ?? 4) > 6 ? 2.2 : 1.4;
      break;
    case 'multiple-choice':
      cognitiveWeight = (question.options?.length ?? 4) > 8 ? 2.0 : 1.1;
      break;
    default:
      cognitiveWeight = 1.0;
  }

  if (question.isRequired) {
    cognitiveWeight += 0.5;
  }

  return { cognitiveWeight, privacyWeight };
}

/**
 * Deterministic pseudo-random number generator for reproducible simulations.
 */
function createPrng(seed: number = 42): () => number {
  let s = seed >>> 0;
  return function next(): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── INDIVIDUAL PERSONA SIMULATION ──────────────────────────────────────────

/**
 * Simulates a single respondent run through a survey using a chosen cognitive persona.
 */
export function simulateSurveyRun(
  survey: SurveyInputLike,
  persona: SyntheticPersonaType,
  seed?: number
): SyntheticRunResult {
  const personaConfig = SYNTHETIC_PERSONAS[persona];
  const questions = extractSurveyQuestions(survey.elements);
  const totalQuestions = questions.length;
  const prng = createPrng(seed ?? (Math.floor(Math.random() * 100000) + 1));

  // Handle empty survey edge-case
  if (totalQuestions === 0) {
    return {
      persona,
      completed: true,
      durationSeconds: 0,
      questionsAnswered: 0,
      totalQuestions: 0,
      answers: {},
      simulatedNps: persona === 'promoter' ? 10 : persona === 'skeptic' ? 2 : 7,
      simulatedCsat: persona === 'promoter' ? 5 : persona === 'skeptic' ? 1 : 4,
      sentiment: persona === 'skeptic' ? 'negative' : persona === 'promoter' ? 'positive' : 'neutral',
    };
  }

  const answers: Record<string, unknown> = {};
  let durationSeconds = 0;
  let questionsAnswered = 0;
  let accumulatedFatigue = 0;
  let dropOffQuestionId: string | undefined;
  let dropOffStepIndex: number | undefined;
  let dropOffReason: string | undefined;

  for (let i = 0; i < totalQuestions; i++) {
    const q = questions[i];
    const { cognitiveWeight, privacyWeight } = getQuestionFrictionWeights(q);
    const baseDwell = getBaseDwellTimeSeconds(q.type, Boolean(q.isRequired));
    const stepDwell = Math.max(1, Math.round(baseDwell * personaConfig.speedMultiplier * (0.85 + prng() * 0.3)));
    durationSeconds += stepDwell;
    accumulatedFatigue += cognitiveWeight;

    // Check drop-off conditions by persona
    let shouldDropOff = false;
    let currentReason = '';

    if (persona === 'speeder') {
      // Speeder drops off if forced to write long text or solve complex matrix
      if (q.isRequired && (q.type === 'long-text' || q.type === 'matrix')) {
        const dropProb = 0.45;
        if (prng() < dropProb) {
          shouldDropOff = true;
          currentReason = `Speeder abandoned at step ${i + 1} ("${q.title || 'Untitled'}"): Intolerant of high cognitive effort on required ${q.type}.`;
        }
      }
    } else if (persona === 'fatigued') {
      // Fatigued persona drops off as question count or cognitive fatigue accumulates
      // If survey has > 10 questions, fatigued is designed to drop off
      const fatigueThreshold = totalQuestions > 10 ? 7.5 : 12.0;
      if (accumulatedFatigue >= fatigueThreshold || (totalQuestions > 10 && i >= 8)) {
        shouldDropOff = true;
        currentReason = `Survey fatigue threshold reached at step ${i + 1} ("${q.title || 'Untitled'}"): Question length and mental burden exceeded mobile tolerance.`;
      }
    } else if (persona === 'skeptic') {
      // Skeptic drops off on privacy-sensitive or required contact fields
      if (privacyWeight >= 1.8 && q.isRequired) {
        const dropProb = 0.65;
        if (prng() < dropProb) {
          shouldDropOff = true;
          currentReason = `Privacy friction at step ${i + 1} ("${q.title || 'Untitled'}"): Hesitant to share sensitive identification or attachments.`;
        }
      }
    } else if (persona === 'thorough') {
      // Thorough only drops off on abnormally massive surveys (> 25 questions)
      if (totalQuestions > 25 && i > 22 && prng() < 0.15) {
        shouldDropOff = true;
        currentReason = `Survey length reached extreme threshold (> 22 questions).`;
      }
    } else if (persona === 'promoter') {
      // Promoter is extremely resilient, rarely drops off
      if (totalQuestions > 30 && i > 28 && prng() < 0.05) {
        shouldDropOff = true;
        currentReason = `Excessive length exceeded patience limit.`;
      }
    }

    if (shouldDropOff) {
      dropOffQuestionId = q.id;
      dropOffStepIndex = i;
      dropOffReason = currentReason;
      break;
    }

    // Answer simulation
    questionsAnswered++;
    answers[q.id] = generateSimulatedAnswer(q, persona, prng);
  }

  const completed = dropOffQuestionId === undefined;

  // Resolve simulated NPS and CSAT
  let simulatedNps: number | undefined;
  let simulatedCsat: number | undefined;

  // Look for existing answered NPS or CSAT/Rating
  const npsQ = questions.find((q) => q.type === 'nps');
  if (npsQ && typeof answers[npsQ.id] === 'number') {
    simulatedNps = answers[npsQ.id] as number;
  } else {
    // Generate representative score based on persona disposition
    if (persona === 'skeptic') simulatedNps = Math.floor(prng() * 5); // 0-4 Detractor
    else if (persona === 'promoter') simulatedNps = 9 + (prng() > 0.4 ? 1 : 0); // 9-10 Promoter
    else if (persona === 'speeder') simulatedNps = 6 + Math.floor(prng() * 3); // 6-8 Passive
    else if (persona === 'thorough') simulatedNps = 8 + (prng() > 0.6 ? 1 : 0); // 8-9
    else simulatedNps = 4 + Math.floor(prng() * 3); // 4-6 Passive/Detractor
  }

  const csatQ = questions.find((q) => q.type === 'rating' || q.type === 'ces');
  if (csatQ && typeof answers[csatQ.id] === 'number') {
    simulatedCsat = answers[csatQ.id] as number;
  } else {
    if (persona === 'skeptic') simulatedCsat = 1 + (prng() > 0.6 ? 1 : 0); // 1-2
    else if (persona === 'promoter') simulatedCsat = 4 + (prng() > 0.3 ? 1 : 0); // 4-5
    else if (persona === 'speeder') simulatedCsat = 3;
    else if (persona === 'thorough') simulatedCsat = 4;
    else simulatedCsat = 2 + (prng() > 0.5 ? 1 : 0); // 2-3
  }

  // Sentiment determination
  let sentiment: 'positive' | 'neutral' | 'negative';
  if (persona === 'skeptic') {
    sentiment = 'negative';
  } else if (persona === 'promoter') {
    sentiment = 'positive';
  } else if (persona === 'thorough') {
    sentiment = 'positive';
  } else {
    sentiment = 'neutral';
  }

  return {
    persona,
    completed,
    durationSeconds,
    questionsAnswered,
    totalQuestions,
    dropOffQuestionId,
    dropOffStepIndex,
    dropOffReason,
    answers,
    simulatedNps,
    simulatedCsat,
    sentiment,
  };
}

/**
 * Generates synthetic value suited to question format and persona personality.
 */
function generateSimulatedAnswer(
  q: SurveyQuestion,
  persona: SyntheticPersonaType,
  prng: () => number
): unknown {
  switch (q.type) {
    case 'nps':
      if (persona === 'skeptic') return Math.floor(prng() * 5); // 0-4
      if (persona === 'promoter') return 9 + (prng() > 0.4 ? 1 : 0); // 9-10
      if (persona === 'speeder') return 7;
      if (persona === 'thorough') return 8;
      return 5;

    case 'rating':
    case 'ces':
      if (persona === 'skeptic') return 1 + (prng() > 0.6 ? 1 : 0);
      if (persona === 'promoter') return 4 + (prng() > 0.3 ? 1 : 0);
      return 3;

    case 'yes-no':
      if (persona === 'skeptic') return 'no';
      if (persona === 'promoter') return 'yes';
      return prng() > 0.5 ? 'yes' : 'no';

    case 'multiple-choice':
    case 'dropdown': {
      const opts = q.options && q.options.length > 0 ? q.options : ['Option 1', 'Option 2'];
      const index = Math.floor(prng() * opts.length);
      return opts[index];
    }

    case 'checkboxes': {
      const opts = q.options && q.options.length > 0 ? q.options : ['Option 1', 'Option 2'];
      if (persona === 'speeder') return [opts[0]];
      return opts.slice(0, Math.min(opts.length, Math.max(1, Math.floor(prng() * opts.length) + 1)));
    }

    case 'text':
      if (persona === 'speeder') return q.isRequired ? 'ok' : '';
      if (persona === 'skeptic') return 'Prefer not to disclose';
      if (persona === 'promoter') return 'Great experience so far!';
      return 'Standard feedback input.';

    case 'long-text':
      if (persona === 'speeder') return q.isRequired ? 'N/A' : '';
      if (persona === 'thorough') {
        return 'Detailed assessment: The clarity of the onboarding workflow was high, though reducing friction on mobile displays would provide significant improvements.';
      }
      if (persona === 'skeptic') {
        return 'The structure is somewhat ambiguous, and asking for personal information before value is delivered causes hesitation.';
      }
      if (persona === 'promoter') {
        return 'Fantastic experience overall! Intuitive layout, responsive design, and completely seamless.';
      }
      return 'Adequate experience with room for simplification.';

    case 'slider':
      return Math.round((q.points || 100) * (persona === 'promoter' ? 0.9 : persona === 'skeptic' ? 0.25 : 0.6));

    case 'email':
      return persona === 'skeptic' && !q.isRequired ? '' : 'test.respondent@example.com';

    case 'phone':
      return persona === 'skeptic' && !q.isRequired ? '' : '+15550192834';

    case 'consent':
      return true;

    default:
      return 'Completed';
  }
}

// ─── COHORT AUDIENCE SIMULATION & COCKPIT ENGINE ───────────────────────────

/**
 * Runs a multi-agent cohort simulation (default 50 agents) across all 5 personas,
 * generating comprehensive friction metrics, drop-off heatmaps, and actionable advice.
 */
export function simulateAudienceCohort(
  survey: SurveyInputLike,
  cohortSize: number = 50,
  personaWeights?: Partial<Record<SyntheticPersonaType, number>>
): AudienceCohortSimulationResult {
  const questions = extractSurveyQuestions(survey.elements);
  const totalQuestions = questions.length;
  const safeCohortSize = Math.max(1, cohortSize);

  // Normalize persona distribution weights
  const defaultWeights: Record<SyntheticPersonaType, number> = {
    speeder: 0.20,
    thorough: 0.20,
    fatigued: 0.20,
    skeptic: 0.20,
    promoter: 0.20,
  };

  const weights: Record<SyntheticPersonaType, number> = {
    speeder: personaWeights?.speeder ?? defaultWeights.speeder,
    thorough: personaWeights?.thorough ?? defaultWeights.thorough,
    fatigued: personaWeights?.fatigued ?? defaultWeights.fatigued,
    skeptic: personaWeights?.skeptic ?? defaultWeights.skeptic,
    promoter: personaWeights?.promoter ?? defaultWeights.promoter,
  };

  const totalWeight = Object.values(weights).reduce((acc, w) => acc + w, 0) || 1.0;
  const personaTypes: SyntheticPersonaType[] = ['speeder', 'thorough', 'fatigued', 'skeptic', 'promoter'];

  // Build persona assignment list for exact cohort size
  const assignedPersonas: SyntheticPersonaType[] = [];
  let remaining = safeCohortSize;

  for (let i = 0; i < personaTypes.length; i++) {
    const p = personaTypes[i];
    const isLast = i === personaTypes.length - 1;
    const count = isLast ? remaining : Math.max(1, Math.round((weights[p] / totalWeight) * safeCohortSize));
    const allocated = Math.min(remaining, count);
    for (let c = 0; c < allocated; c++) {
      assignedPersonas.push(p);
    }
    remaining -= allocated;
    if (remaining <= 0) break;
  }

  // Handle empty survey case
  if (totalQuestions === 0) {
    const emptyBreakdown = personaTypes.reduce((acc, p) => {
      acc[p] = {
        simulated: assignedPersonas.filter((item) => item === p).length,
        completed: assignedPersonas.filter((item) => item === p).length,
        completionRate: 100,
        avgDurationSeconds: 0,
      };
      return acc;
    }, {} as Record<SyntheticPersonaType, PersonaBreakdownMetric>);

    return {
      totalSimulated: assignedPersonas.length,
      completedCount: assignedPersonas.length,
      completionRate: 100,
      averageDurationSeconds: 0,
      medianDurationSeconds: 0,
      personaBreakdown: emptyBreakdown,
      questionFrictionAnalysis: [],
      frictionPointsCount: 0,
      predictedNps: 0,
      predictedCsat: 5.0,
      overallHealthScore: 100,
      criticalAlerts: ['Survey contains 0 questions. Add questions to enable friction evaluation.'],
    };
  }

  // Run simulation for each assigned agent
  const results: SyntheticRunResult[] = [];
  for (let i = 0; i < assignedPersonas.length; i++) {
    const persona = assignedPersonas[i];
    const seed = 1000 + i * 37;
    const runResult = simulateSurveyRun(survey, persona, seed);
    results.push(runResult);
  }

  const completedRuns = results.filter((r) => r.completed);
  const completedCount = completedRuns.length;
  const completionRate = Number(((completedCount / results.length) * 100).toFixed(1));

  // Durations
  const durations = results.map((r) => r.durationSeconds).sort((a, b) => a - b);
  const averageDurationSeconds = Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length);
  const medianDurationSeconds = durations[Math.floor(durations.length / 2)] || 0;

  // Persona Breakdown Metrics
  const personaBreakdown = personaTypes.reduce((acc, p) => {
    const pRuns = results.filter((r) => r.persona === p);
    const pCompleted = pRuns.filter((r) => r.completed);
    const pDurations = pRuns.map((r) => r.durationSeconds);
    const avgDuration = pDurations.length > 0 ? Math.round(pDurations.reduce((s, d) => s + d, 0) / pDurations.length) : 0;
    
    const pDropOffs = pRuns.filter((r) => !r.completed && r.dropOffStepIndex !== undefined);
    const avgDropOff = pDropOffs.length > 0
      ? Number((pDropOffs.reduce((s, r) => s + (r.dropOffStepIndex ?? 0), 0) / pDropOffs.length).toFixed(1))
      : undefined;

    acc[p] = {
      simulated: pRuns.length,
      completed: pCompleted.length,
      completionRate: pRuns.length > 0 ? Number(((pCompleted.length / pRuns.length) * 100).toFixed(1)) : 0,
      avgDurationSeconds: avgDuration,
      avgDropOffStep: avgDropOff,
    };
    return acc;
  }, {} as Record<SyntheticPersonaType, PersonaBreakdownMetric>);

  // Question Friction Analysis
  const questionFrictionAnalysis: QuestionFrictionMetric[] = questions.map((q, idx) => {
    const dropOffsAtQuestion = results.filter((r) => r.dropOffQuestionId === q.id).length;
    const dropOffRate = Number(((dropOffsAtQuestion / results.length) * 100).toFixed(1));

    // Base dwell calculation
    const baseDwell = getBaseDwellTimeSeconds(q.type, Boolean(q.isRequired));
    const { cognitiveWeight, privacyWeight } = getQuestionFrictionWeights(q);

    // Dwell time among respondents who reached this step
    const respondentsReached = results.filter(
      (r) => r.dropOffStepIndex === undefined || r.dropOffStepIndex >= idx
    );
    const avgDwell = respondentsReached.length > 0
      ? Math.round(
          respondentsReached.reduce((sum, r) => {
            const pSpeed = SYNTHETIC_PERSONAS[r.persona].speedMultiplier;
            return sum + Math.max(1, Math.round(baseDwell * pSpeed));
          }, 0) / respondentsReached.length
        )
      : baseDwell;

    // Friction score formula (0-100)
    // Combines direct dropOffRate (high weight), cognitive complexity, and privacy friction
    const dropOffFactor = dropOffRate * 2.6; // e.g. 15% drop-off = 39 pts
    const cognitiveFactor = cognitiveWeight * 6.0; // 1-4 => 6-24 pts
    const privacyFactor = privacyWeight * 6.5; // 0-2.6 => 0-17 pts
    const requiredPenalty = q.isRequired ? 8 : 0;

    const rawFriction = dropOffFactor + cognitiveFactor + privacyFactor + requiredPenalty;
    const frictionScore = Math.min(100, Math.max(0, Math.round(rawFriction)));

    let riskLevel: FrictionRiskLevel = 'low';
    if (frictionScore >= 70 || dropOffRate >= 20) {
      riskLevel = 'critical';
    } else if (frictionScore >= 45 || dropOffRate >= 10) {
      riskLevel = 'high';
    } else if (frictionScore >= 22) {
      riskLevel = 'medium';
    }

    // Contextual Actionable Recommendation
    let actionableRecommendation = 'Question flows smoothly with acceptable cognitive burden.';
    if (dropOffsAtQuestion > 0 && q.type === 'long-text' && q.isRequired) {
      actionableRecommendation = 'High abandonment on required open text. Convert to multi-choice with "Other", or make the field optional to preserve momentum.';
    } else if (dropOffsAtQuestion > 0 && q.type === 'matrix') {
      actionableRecommendation = 'Complex matrix table induces mobile friction. Split into individual single-select cards or simplified rating scales.';
    } else if (dropOffsAtQuestion > 0 && (q.type === 'email' || q.type === 'phone')) {
      actionableRecommendation = 'Direct identity collection triggers detractor abandonment. Move contact capture to the final step or clarify data privacy guarantee.';
    } else if (dropOffsAtQuestion > 0 && q.type === 'file-upload') {
      actionableRecommendation = 'File upload requirement causes participant drop-off. Add explicit format instructions, sample downloads, or make it optional.';
    } else if (dropOffsAtQuestion > 0 && (q.options?.length ?? 0) > 8) {
      actionableRecommendation = 'Large option set triggers choice paralysis. Group options into categories or convert to a searchable dropdown.';
    } else if (dropOffsAtQuestion > 0 && q.isRequired) {
      actionableRecommendation = 'Required status is causing friction at this step. Test making this question optional to lift overall completion rate.';
    } else if (riskLevel === 'high' || riskLevel === 'critical') {
      actionableRecommendation = 'Consider simplifying the wording and reducing cognitive load to improve cohort retention.';
    }

    return {
      questionId: q.id,
      questionTitle: q.title || `Question ${idx + 1}`,
      questionType: q.type,
      dropOffCount: dropOffsAtQuestion,
      dropOffRate,
      avgDwellTimeSeconds: avgDwell,
      frictionScore,
      riskLevel,
      actionableRecommendation,
    };
  });

  const frictionPointsCount = questionFrictionAnalysis.filter(
    (q) => q.riskLevel === 'high' || q.riskLevel === 'critical'
  ).length;

  // Predicted NPS calculation: % Promoters (9-10) - % Detractors (0-6)
  const npsScores = results.map((r) => r.simulatedNps).filter((s): s is number => typeof s === 'number');
  let predictedNps: number | undefined;
  if (npsScores.length > 0) {
    const promoters = npsScores.filter((s) => s >= 9).length;
    const detractors = npsScores.filter((s) => s <= 6).length;
    predictedNps = Math.round(((promoters - detractors) / npsScores.length) * 100);
  }

  // Predicted CSAT calculation: average out of 5
  const csatScores = results.map((r) => r.simulatedCsat).filter((s): s is number => typeof s === 'number');
  let predictedCsat: number | undefined;
  if (csatScores.length > 0) {
    predictedCsat = Number((csatScores.reduce((sum, s) => sum + s, 0) / csatScores.length).toFixed(1));
  }

  // Overall Health Score (0-100)
  // 50% Completion rate, 30% Inverted Average Friction, 20% Predicted NPS normalized
  const avgFriction = questionFrictionAnalysis.length > 0
    ? questionFrictionAnalysis.reduce((sum, q) => sum + q.frictionScore, 0) / questionFrictionAnalysis.length
    : 0;
  const npsFactor = predictedNps !== undefined ? (predictedNps + 100) / 2 : 50;
  const overallHealthScore = Math.min(
    100,
    Math.max(
      0,
      Math.round(completionRate * 0.50 + Math.max(0, 100 - avgFriction) * 0.30 + npsFactor * 0.20)
    )
  );

  // Critical Alerts Generation
  const criticalAlerts: string[] = [];
  if (completionRate < 60) {
    criticalAlerts.push(
      `Predicted completion rate is low (${completionRate}%). Over 40% of simulated respondents abandon before submission.`
    );
  }

  const criticalQuestions = questionFrictionAnalysis.filter((q) => q.riskLevel === 'critical');
  criticalQuestions.forEach((q) => {
    criticalAlerts.push(
      `Critical drop-off bottleneck at "${q.questionTitle}": ${q.dropOffRate}% of participants abandon here.`
    );
  });

  if (totalQuestions > 12) {
    criticalAlerts.push(
      `Survey length (${totalQuestions} questions) exceeds ideal cognitive threshold (10-12 questions), triggering cumulative fatigue.`
    );
  }

  const complexCount = questions.filter((q) => q.type === 'matrix' || (q.type === 'long-text' && q.isRequired)).length;
  if (complexCount >= 3) {
    criticalAlerts.push(
      `High density of cognitive friction points (${complexCount} complex matrix/required text blocks) detected.`
    );
  }

  return {
    totalSimulated: results.length,
    completedCount,
    completionRate,
    averageDurationSeconds,
    medianDurationSeconds,
    personaBreakdown,
    questionFrictionAnalysis,
    frictionPointsCount,
    predictedNps,
    predictedCsat,
    overallHealthScore,
    criticalAlerts,
  };
}
