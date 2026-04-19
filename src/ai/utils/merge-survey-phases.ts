/**
 * @fileOverview Pure utility function to merge the three AI generation phases
 * into a single survey structure. This is NOT a server action — it runs on
 * the client side to assemble cached phase results.
 */

// Inline types to avoid circular import with generate-survey-chunked-flow.ts
interface BlueprintOutput {
  title: string;
  description: string;
  sections: { id: string; title: string; stepperTitle: string; description?: string; estimatedQuestions: number }[];
  scoringEnabled: boolean;
  thankYouTitle: string;
  thankYouDescription: string;
  bannerImageQuery: string;
}

interface QuestionsOutput {
  elements: any[];
}

interface LogicOutput {
  scoringPatches?: { questionId: string; enableScoring: true; optionScores?: number[]; yesScore?: number; noScore?: number }[];
  logicBlocks?: { id: string; type: 'logic'; rules: any[] }[];
  maxScore: number;
  resultRules?: { id: string; label: string; minScore: number; maxScore: number; priority: number; pageId: string }[];
  resultPages?: { id: string; name: string; isDefault: boolean; blocks: any[] }[];
}

export interface MergedSurveyOutput {
  title: string;
  description: string;
  elements: any[];
  scoringEnabled: boolean;
  maxScore: number;
  resultRules: any[];
  resultPages: any[];
  thankYouTitle: string;
  thankYouDescription: string;
  bannerImageQuery: string;
}

export function mergeSurveyPhases(
  blueprint: BlueprintOutput,
  questions: QuestionsOutput,
  logic: LogicOutput
): MergedSurveyOutput {
  // 1. Start with elements from Phase 2
  // Cast to any[] — we're dynamically patching scoring fields from Phase 3
  // onto a Zod union type, which doesn't support static narrowing for this use case.
  const elements: any[] = [...questions.elements];
  const elementIds = new Set(elements.map((el: any) => el.id));

  // 2. Apply scoring patches from Phase 3
  if (logic.scoringPatches) {
    for (const patch of logic.scoringPatches) {
      const target = elements.find((el: any) => el.id === patch.questionId);
      if (!target) {
        console.warn(`[MERGE] Scoring patch references unknown question ID: ${patch.questionId} — skipping`);
        continue;
      }

      target.enableScoring = true;

      if (patch.optionScores && target.options) {
        // Defensive: ensure optionScores length matches options length
        if (patch.optionScores.length !== target.options.length) {
          console.warn(`[MERGE] optionScores length (${patch.optionScores.length}) != options length (${target.options.length}) for ${patch.questionId} — padding/truncating`);
          const corrected = [...patch.optionScores];
          while (corrected.length < target.options.length) corrected.push(0);
          target.optionScores = corrected.slice(0, target.options.length);
        } else {
          target.optionScores = patch.optionScores;
        }
      }

      if (patch.yesScore !== undefined) target.yesScore = patch.yesScore;
      if (patch.noScore !== undefined) target.noScore = patch.noScore;
    }
  }

  // 3. Append validated logic blocks from Phase 3
  if (logic.logicBlocks) {
    for (const block of logic.logicBlocks) {
      // Validate all references exist
      const validRules = block.rules.filter((rule: any) => {
        if (!elementIds.has(rule.sourceQuestionId)) {
          console.warn(`[MERGE] Logic rule references unknown sourceQuestionId: ${rule.sourceQuestionId} — removing`);
          return false;
        }
        if (rule.action.targetElementId && !elementIds.has(rule.action.targetElementId)) {
          console.warn(`[MERGE] Logic rule references unknown targetElementId: ${rule.action.targetElementId} — removing`);
          return false;
        }
        return true;
      });

      if (validRules.length > 0) {
        elements.push({ ...block, rules: validRules });
      }
    }
  }

  // 4. Recompute maxScore from actual scoring data
  let computedMaxScore = 0;
  for (const el of elements) {
    if (!el.enableScoring) continue;

    if (el.type === 'yes-no') {
      computedMaxScore += Math.max(el.yesScore || 0, el.noScore || 0);
    } else if (['multiple-choice', 'dropdown'].includes(el.type) && el.optionScores) {
      computedMaxScore += Math.max(...el.optionScores, 0);
    } else if (el.type === 'checkboxes' && el.optionScores) {
      // Checkboxes are cumulative — max is sum of all positive scores
      computedMaxScore += el.optionScores.reduce((sum: number, s: number) => sum + Math.max(s, 0), 0);
    }
  }

  // 5. Validate resultRule pageIds
  const validPageIds = new Set((logic.resultPages || []).map((p: any) => p.id));
  const validRules = (logic.resultRules || []).filter((rule: any) => {
    if (!validPageIds.has(rule.pageId)) {
      console.warn(`[MERGE] resultRule "${rule.label}" references unknown pageId: ${rule.pageId} — removing`);
      return false;
    }
    return true;
  });

  return {
    title: blueprint.title,
    description: blueprint.description,
    elements,
    scoringEnabled: blueprint.scoringEnabled,
    maxScore: computedMaxScore || logic.maxScore || 0,
    resultRules: validRules,
    resultPages: logic.resultPages || [],
    thankYouTitle: blueprint.thankYouTitle,
    thankYouDescription: blueprint.thankYouDescription,
    bannerImageQuery: blueprint.bannerImageQuery || 'abstract background pattern',
  };
}
