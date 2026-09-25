/**
 * @fileOverview Pure utility function to sanitize and deduplicate survey elements
 * generated during Phase 2 (Questions) of AI survey generation.
 *
 * This file intentionally does NOT have 'use server' — it exports pure synchronous
 * functions that can be executed server-side or client-side without Next.js Server Action
 * restrictions.
 */

import { QUESTION_TYPES } from '@/ai/schemas/survey-schemas';

export interface RawSurveyElement {
  id: string;
  type: string;
  title?: string;
  text?: string;
  options?: string[];
  isRequired?: boolean;
  rules?: unknown[];
  [key: string]: unknown;
}

export interface BlueprintSectionRef {
  id: string;
  title: string;
  stepperTitle: string;
  description?: string;
  estimatedQuestions?: number;
}

export interface BlueprintRef {
  sections?: BlueprintSectionRef[];
  [key: string]: unknown;
}

/**
 * Sanitizes and deduplicates elements generated in Phase 2:
 * 1. Discards headless question elements (missing title or empty title).
 * 2. Discards pure logic blocks (which belong exclusively to Phase 3).
 * 3. Strips leaked `rules` or scoring properties from questions.
 * 4. Deduplicates questions with identical or near-identical titles within each section.
 * 5. Ensures choice questions (multiple-choice, checkboxes, dropdown) have valid options.
 * 6. Guarantees unique IDs across all elements.
 */
export function sanitizeAndDeduplicateQuestions(
  rawElements: RawSurveyElement[],
  blueprint?: BlueprintRef
): RawSurveyElement[] {
  const sanitized: RawSurveyElement[] = [];
  const seenIds = new Set<string>();
  const seenQuestionTitles = new Set<string>();

  for (const raw of rawElements) {
    if (!raw || typeof raw !== 'object') continue;

    // 1. Strip logic blocks (handled exclusively in Phase 3)
    if (raw.type === 'logic') continue;

    const el = { ...raw };

    // 2. Strip any accidental rules array
    if ('rules' in el) {
      delete el.rules;
    }
    // Strip any accidental scoring fields (Phase 3 handles scoring)
    if ('enableScoring' in el) delete el.enableScoring;
    if ('optionScores' in el) delete el.optionScores;

    const isQuestion = (QUESTION_TYPES as readonly string[]).includes(el.type);

    // 3. Question validation: must have non-empty title
    if (isQuestion) {
      const title = (typeof el.title === 'string' ? el.title : '').trim();
      if (!title || title.length < 3) {
        // Discard headless or empty stub question
        continue;
      }
      el.title = title;

      // Deduplication: normalize title to detect attention loops (like q_difficult_steps_v1...v30)
      const normalizedTitle = title
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 80);

      const hasRealOptions = Array.isArray(el.options) && el.options.filter((o) => typeof o === 'string' && o.trim().length > 0).length >= 2;

      // If we've already seen this exact question title:
      // Prefer the one that has valid options if this is a choice question
      if (seenQuestionTitles.has(normalizedTitle)) {
        const existingIdx = sanitized.findIndex((s) => {
          const sTitle = (typeof s.title === 'string' ? s.title : '').trim().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 80);
          return sTitle === normalizedTitle;
        });

        if (existingIdx !== -1) {
          const existing = sanitized[existingIdx];
          const existingHasRealOptions = Array.isArray(existing.options) && existing.options.filter((o) => typeof o === 'string' && o.trim().length > 0).length >= 2;

          if (!existingHasRealOptions && hasRealOptions) {
            // Replace earlier option-less stub with this complete question!
            sanitized[existingIdx] = el;
          }
        }
        // Skip duplicate
        continue;
      }
      seenQuestionTitles.add(normalizedTitle);

      if (el.isRequired === undefined) {
        el.isRequired = false;
      }
    }

    // 4. Ensure ID uniqueness
    let finalId = (typeof el.id === 'string' && el.id.trim()) ? el.id.trim() : (isQuestion ? 'q_item' : 'el_item');
    let counter = 1;
    while (seenIds.has(finalId)) {
      counter++;
      finalId = `${el.id || (isQuestion ? 'q_item' : 'el_item')}_${counter}`;
    }
    el.id = finalId;
    seenIds.add(finalId);

    sanitized.push(el);
  }

  // 5. Ensure choice questions have valid options
  for (const item of sanitized) {
    if (['multiple-choice', 'checkboxes', 'dropdown'].includes(item.type)) {
      const validOptions = Array.isArray(item.options) ? item.options.filter((o) => typeof o === 'string' && o.trim().length > 0) : [];
      if (validOptions.length >= 2) {
        item.options = validOptions;
      } else {
        item.options = ['Yes / Agree', 'No / Disagree', 'Other / Not Applicable'];
        item.allowOther = true;
      }
    }
  }

  // 6. Ensure blueprint sections are present
  if (blueprint?.sections && blueprint.sections.length > 0) {
    const existingSectionIds = new Set(sanitized.filter((e) => e.type === 'section').map((e) => e.id));
    if (existingSectionIds.size === 0) {
      const sectionElements: RawSurveyElement[] = blueprint.sections.map((s) => ({
        id: s.id,
        type: 'section',
        title: s.title,
        stepperTitle: s.stepperTitle,
        renderAsPage: true,
        validateBeforeNext: true,
      }));
      sanitized.unshift(...sectionElements);
    }
  }

  return sanitized;
}
