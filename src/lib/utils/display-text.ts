/**
 * @fileOverview `toDisplayText` — the one helper every UI *text* sink uses before it
 * prints author-authored copy.
 *
 * WHY THIS EXISTS:
 * Section titles, question titles and sample-file copy are authored in rich-text
 * editors, so the stored value is HTML. Rendering that value into a text sink (plain
 * `{value}` inside a `<p>`, an `aria-label`, a `title` attribute) makes React escape the
 * markup, and the page prints `<SPAN STYLE="COLOR: RGB(15, 23, 42)">` at the user. That
 * shipped in the survey stepper. Workspace rule "No Raw HTML/CSS Leakage" forbids it.
 *
 * WHAT IT ADDS OVER `stripHtml`:
 * 1. A second sweep. `stripHtml` decodes entities as its last step, so a double-encoded
 *    paste (`&lt;span&gt;`) comes back out as a *literal* `<span>` and still prints. This
 *    re-sweeps until no tag survives.
 * 2. Full whitespace flattening. Text sinks here are single-line labels; `stripHtml`
 *    preserves newlines, which break a clamped label's line budget.
 * 3. A bounded memo. The stepper calls this once per section on every render, and the
 *    survey form re-renders on each keystroke.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * This is for TEXT sinks only. It is NOT a sanitiser and must never be used to make a
 * string safe for `dangerouslySetInnerHTML` — use `DOMPurify.sanitize` for HTML sinks
 * (see `survey-variable-utils.sanitizeHtml`). Stripping and sanitising are different jobs.
 *
 * @testability src/lib/utils/__tests__/display-text.test.ts
 */
import { stripHtml } from '@/lib/utils';

/**
 * Maximum number of distinct inputs held in the memo.
 *
 * Sized for the realistic worst case — a long survey re-rendering its stepper labels —
 * while staying small enough that the cache can never become a leak. Exported so the
 * test can prove that eviction does not corrupt results.
 */
export const DISPLAY_TEXT_CACHE_LIMIT = 200;

/**
 * Inputs longer than this are computed every time instead of being cached. Display
 * labels are short; caching a long body would trade a real memory cost for a hit rate
 * that never materialises.
 */
const MAX_CACHEABLE_INPUT_LENGTH = 2048;

/** Matches any residual tag. Used with `.test()`, so it deliberately carries no `/g` flag. */
const RESIDUAL_TAG_PATTERN = /<[^>]+>/;

/** Any run of whitespace, including newlines and non-breaking spaces. */
const WHITESPACE_RUN_PATTERN = /\s+/g;

/**
 * Upper bound on strip passes. Two covers the realistic case (raw, then double-encoded);
 * the third is headroom. A fixed ceiling keeps a hostile input from spinning here.
 */
const MAX_STRIP_PASSES = 3;

/**
 * Insertion-ordered memo. `Map` preserves insertion order, so the first key returned by
 * `keys()` is the oldest — giving FIFO eviction without a second data structure.
 */
const cache = new Map<string, string>();

function compute(value: string): string {
  let out = value;

  for (let pass = 0; pass < MAX_STRIP_PASSES; pass += 1) {
    out = stripHtml(out);
    if (!RESIDUAL_TAG_PATTERN.test(out)) break;
  }

  // Final guard: if markup somehow survived every pass, drop the brackets rather than
  // printing them. Losing a stray character beats showing the user markup.
  if (RESIDUAL_TAG_PATTERN.test(out)) {
    out = out.replace(/<[^>]*>/g, '');
  }

  return out.replace(WHITESPACE_RUN_PATTERN, ' ').trim();
}

/**
 * Converts author-authored copy into clean, single-line plain text safe for a text sink.
 *
 * Returns `''` for empty input and for input that is markup only, so callers can use a
 * simple falsy check to fall back to a default label.
 *
 * @param value Raw authored value, typically rich-text HTML from Firestore.
 */
export function toDisplayText(value: string | null | undefined): string {
  if (!value) return '';

  const cacheable = value.length <= MAX_CACHEABLE_INPUT_LENGTH;
  if (cacheable) {
    const hit = cache.get(value);
    if (hit !== undefined) return hit;
  }

  const result = compute(value);

  if (cacheable) {
    if (cache.size >= DISPLAY_TEXT_CACHE_LIMIT) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey !== undefined) cache.delete(oldestKey);
    }
    cache.set(value, result);
  }

  return result;
}
