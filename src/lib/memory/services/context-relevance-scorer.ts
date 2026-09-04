/**
 * @fileOverview CompanyBrain 2.0 Phase 5: Multi-Dimensional Context Relevance Scorer
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Multi-Attribute Grounded Ranking:
 *    - Synthesizes semantic cosine proximity, direct entity matching, knowledge graph
 *      hop distance, temporal freshness decay, importance, and confidence.
 * 2. Deterministic & Normalized:
 *    - All composite outputs are strictly bounded in `[0.0, 1.0]`.
 * 3. Human & Agent Explainability:
 *    - Generates a concise `whyRelevant` attribution string for inspection in the UI
 *      and agent evidence trails.
 * 4. Zero-`any` Standard:
 *    - Strict typing across all inputs and weights.
 *
 * @testability Covered in `src/lib/memory/__tests__/context-builder.test.ts`.
 */

export interface RelevanceScoreInputs {
  semanticScore: number; // 0.0 to 1.0 from vector search
  isDirectSubjectMatch: boolean; // Direct match on target entity/deal
  graphHops?: number; // 1 = immediate, 2 = 2 hops, 3 = 3 hops
  freshnessScore: number; // 0.0 to 1.0 from FreshnessEngine
  importance: number; // 0.0 to 1.0
  confidence: number; // 0.0 to 1.0
}

export interface RelevanceWeights {
  semantic: number;
  entity: number;
  relationship: number;
  freshness: number;
  importance: number;
  confidence: number;
}

export const DEFAULT_RELEVANCE_WEIGHTS: RelevanceWeights = {
  semantic: 0.30,
  entity: 0.20,
  relationship: 0.15,
  freshness: 0.15,
  importance: 0.10,
  confidence: 0.10,
};

export interface ScoredRelevanceResult {
  score: number;
  breakdown: {
    semanticPart: number;
    entityPart: number;
    relationshipPart: number;
    freshnessPart: number;
    importancePart: number;
    confidencePart: number;
  };
  whyRelevant: string;
}

export class ContextRelevanceScorer {
  /**
   * Calculates the unified multi-attribute relevance score for a context candidate.
   */
  public static calculateRelevance(
    inputs: RelevanceScoreInputs,
    customWeights?: Partial<RelevanceWeights>
  ): ScoredRelevanceResult {
    const weights: RelevanceWeights = {
      ...DEFAULT_RELEVANCE_WEIGHTS,
      ...(customWeights || {}),
    };

    // Normalize weights so sum equals 1.0
    const totalWeight =
      weights.semantic +
      weights.entity +
      weights.relationship +
      weights.freshness +
      weights.importance +
      weights.confidence;

    const normalizedWeights: RelevanceWeights = totalWeight > 0
      ? {
          semantic: weights.semantic / totalWeight,
          entity: weights.entity / totalWeight,
          relationship: weights.relationship / totalWeight,
          freshness: weights.freshness / totalWeight,
          importance: weights.importance / totalWeight,
          confidence: weights.confidence / totalWeight,
        }
      : DEFAULT_RELEVANCE_WEIGHTS;

    const boundedSemantic = Math.max(0, Math.min(1, inputs.semanticScore));
    const entityMatchScore = inputs.isDirectSubjectMatch ? 1.0 : 0.0;

    // Graph proximity decay: 1 hop = 1.0, 2 hops = 0.65, 3 hops = 0.35, >3 or undefined = 0.0
    let graphScore = 0.0;
    if (inputs.graphHops === 1) graphScore = 1.0;
    else if (inputs.graphHops === 2) graphScore = 0.65;
    else if (inputs.graphHops === 3) graphScore = 0.35;
    else if (inputs.graphHops && inputs.graphHops > 3) graphScore = 0.10;

    const boundedFreshness = Math.max(0, Math.min(1, inputs.freshnessScore));
    const boundedImportance = Math.max(0, Math.min(1, inputs.importance));
    const boundedConfidence = Math.max(0, Math.min(1, inputs.confidence));

    const semanticPart = boundedSemantic * normalizedWeights.semantic;
    const entityPart = entityMatchScore * normalizedWeights.entity;
    const relationshipPart = graphScore * normalizedWeights.relationship;
    const freshnessPart = boundedFreshness * normalizedWeights.freshness;
    const importancePart = boundedImportance * normalizedWeights.importance;
    const confidencePart = boundedConfidence * normalizedWeights.confidence;

    const rawScore =
      semanticPart +
      entityPart +
      relationshipPart +
      freshnessPart +
      importancePart +
      confidencePart;

    const finalScore = Math.round(Math.max(0, Math.min(1, rawScore)) * 1000) / 1000;

    // Generate concise attribution
    const reasons: string[] = [];
    if (inputs.isDirectSubjectMatch) reasons.push('Direct entity subject');
    if (boundedSemantic >= 0.75) reasons.push(`High semantic alignment (${Math.round(boundedSemantic * 100)}%)`);
    else if (boundedSemantic >= 0.5) reasons.push(`Moderate semantic alignment (${Math.round(boundedSemantic * 100)}%)`);
    if (inputs.graphHops && inputs.graphHops <= 2) reasons.push(`${inputs.graphHops}-hop relationship`);
    if (boundedFreshness >= 0.8) reasons.push('Verified fresh');
    else if (boundedFreshness < 0.4) reasons.push('Temporal decay warning');

    const whyRelevant = reasons.length > 0 ? reasons.join(' • ') : 'General relevance';

    return {
      score: finalScore,
      breakdown: {
        semanticPart,
        entityPart,
        relationshipPart,
        freshnessPart,
        importancePart,
        confidencePart,
      },
      whyRelevant,
    };
  }
}
