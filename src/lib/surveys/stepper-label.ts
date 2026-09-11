/**
 * @fileOverview Resolves the short label shown for one survey step.
 *
 * WHY THIS EXISTS / WHAT CHANGED:
 * Three call sites resolved this label inline with the same expression
 * (`section?.stepperTitle || section?.title || 'Step N'`) — the stepper's `full` variant,
 * its `linear` variant, and the analytics funnel. All three rendered the result into a
 * *text* sink while the underlying `title` is rich-text HTML, so a title pasted from
 * Word printed `<SPAN STYLE="COLOR: RGB(15, 23, 42)">` at respondents on live surveys.
 *
 * Centralising it means the markup fix cannot be applied to two of the three and missed
 * on the third, which is exactly how the funnel label drifted from the stepper before.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * The output is plain text by design. Do not "restore" rich text here — this value also
 * becomes a button's `aria-label`, and markup inside an accessible name is read aloud by
 * screen readers. If a step ever needs styling, style the element, not the string.
 *
 * @testability src/lib/surveys/__tests__/stepper-label.test.ts
 */
import { toDisplayText } from '@/lib/utils/display-text';

/**
 * The only two fields of a section this resolver reads.
 *
 * Deliberately structural rather than `SurveyLayoutBlock`, so the analytics utility can
 * pass its own narrowed shape without importing the full element union.
 */
export interface StepperSectionLike {
  stepperTitle?: string;
  title?: string;
}

export interface ResolveStepperLabelOptions {
  /**
   * Whether the section is currently visible under survey logic. When `false`, the
   * numbered fallback is returned so a hidden section's title never leaks into the
   * progress bar. Omitted means visible.
   */
  isSectionVisible?: boolean;
}

/**
 * Returns the display label for a step: the author's stepper title, else the section
 * title, else `Step N` — always stripped to clean single-line plain text.
 *
 * @param section    The section element that opens the step, if any.
 * @param stepNumber 1-based step number used for the fallback label.
 */
export function resolveStepperLabel(
  section: StepperSectionLike | undefined | null,
  stepNumber: number,
  options?: ResolveStepperLabelOptions,
): string {
  const fallback = `Step ${stepNumber}`;

  // Hidden sections contribute no label — checked before reading any title so a hidden
  // section's copy is never even formatted.
  if (options?.isSectionVisible === false) return fallback;
  if (!section) return fallback;

  // `toDisplayText` returns '' for markup-only input, so a title of `<span></span>`
  // correctly falls through to the next candidate instead of rendering as blank.
  const stepperTitle = toDisplayText(section.stepperTitle);
  if (stepperTitle) return stepperTitle;

  const title = toDisplayText(section.title);
  if (title) return title;

  return fallback;
}
