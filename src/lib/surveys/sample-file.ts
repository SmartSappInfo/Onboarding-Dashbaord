/**
 * @fileOverview Resolves the downloadable "sample file" an author can attach to a
 * file-upload question, so a respondent can download a template, fill it in offline and
 * re-upload it through the same question.
 *
 * WHY THIS EXISTS:
 * Three surfaces render this card — the public form, the builder canvas and the response
 * viewer. Each previously grew its own copy of the file-upload hint string and they
 * drifted. Every surface now derives its view-model here, so there is exactly one place
 * where fallbacks, markup stripping and URL safety are decided.
 *
 * @trustBoundary A published survey document is world-readable (see `firestore.rules`
 * → `match /surveys/{surveyId}`), so `sampleFileUrl` is handed to every anonymous
 * respondent. It is therefore validated against a host allowlist BOTH when the author
 * saves it and again here at render time. Never render a sample URL that has not been
 * through `isSafeSampleFileUrl`.
 *
 * @testability src/lib/surveys/__tests__/sample-file.test.ts
 */
import { isSafeRedirectUrl } from '@/lib/survey-redirect-safety';
import { extractFileNameFromStorageUrl } from '@/lib/survey-response-utils';
import { toDisplayText } from '@/lib/utils/display-text';

/**
 * Hosts a sample file may be served from.
 *
 * Deliberately narrow: these are the buckets this app writes to. `MediaSelect` stores
 * under `media/**`, which Storage rules expose with `allow read: if true` — the only
 * posture that lets a signed-out respondent download the template.
 *
 * CAUTION: widening this list widens what a compromised author account can hand to
 * respondents. Prefer adding a host in backoffice configuration over editing this array.
 */
export const SAMPLE_FILE_ALLOWED_HOSTS: readonly string[] = [
  'firebasestorage.googleapis.com',
  'firebasestorage.app',
  'storage.googleapis.com',
];

/** Shown when the author has not written their own button label. */
export const SAMPLE_FILE_DEFAULT_BUTTON_TEXT = 'Download sample';

/** Last-resort file name when the URL carries nothing usable. */
const SAMPLE_FILE_FALLBACK_NAME = 'Sample file';

/**
 * The author-configured fields this module reads.
 *
 * Structural rather than `SurveyQuestion` so the builder previews can pass their own
 * narrowed element shapes without importing the full element union.
 */
export interface SampleFileSource {
  sampleFileEnabled?: boolean;
  sampleFileUrl?: string;
  sampleFileName?: string;
  sampleFileTitle?: string;
  sampleFileDescription?: string;
  sampleFileButtonText?: string;
}

/** Fully resolved, render-ready sample file. Every string is safe for a text sink. */
export interface SurveySampleFile {
  /** Validated download URL. */
  url: string;
  /** Human-readable file name, never empty. */
  fileName: string;
  /** Heading for the card, never empty — falls back to `fileName`. */
  title: string;
  /** Optional instructions. Empty string when the author wrote none. */
  description: string;
  /** Download button label, never empty. */
  buttonText: string;
  /** Lower-cased extension including the dot (e.g. `.xlsx`), or `''` when unknown. */
  extension: string;
}

/**
 * Whether a sample file URL is safe to publish to anonymous respondents.
 *
 * Delegates scheme and protocol-relative checks to `isSafeRedirectUrl` (the same guard
 * used for survey completion redirects, audit F5) and adds the host allowlist. Relative
 * paths are allowed because they stay on this origin.
 */
export function isSafeSampleFileUrl(
  url: string | null | undefined,
  allowedHosts: readonly string[] = SAMPLE_FILE_ALLOWED_HOSTS,
): boolean {
  if (!url || !url.trim()) return false;
  return isSafeRedirectUrl(url.trim(), allowedHosts);
}

/** Lower-cased extension including the dot, or '' when the name carries none. */
function extractExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === fileName.length - 1) return '';
  return fileName.slice(dotIndex).toLowerCase();
}

/**
 * Builds the render-ready sample file, or `null` when there is nothing to show.
 *
 * Returning `null` (rather than a partially-populated object) is what lets all three
 * render surfaces early-return with a single falsy check, so a question without a sample
 * renders exactly as it did before this feature existed.
 */
export function resolveSampleFile(question: SampleFileSource): SurveySampleFile | null {
  // Early exits first — a question without a sample does no formatting work at all.
  if (!question.sampleFileEnabled) return null;

  const url = question.sampleFileUrl?.trim();
  if (!url) return null;

  // Render-time re-validation. Save-time validation can be bypassed by a document
  // written before the guard existed, or directly through the Admin SDK.
  if (!isSafeSampleFileUrl(url)) return null;

  const storedName = question.sampleFileName?.trim();
  const fileName = storedName || extractFileNameFromStorageUrl(url) || SAMPLE_FILE_FALLBACK_NAME;

  // Author copy comes from plain-text inputs, but authors paste from Word and Docs.
  // `toDisplayText` returns '' for markup-only input, so these fall back correctly.
  const title = toDisplayText(question.sampleFileTitle) || fileName;
  const description = toDisplayText(question.sampleFileDescription);
  const buttonText = toDisplayText(question.sampleFileButtonText) || SAMPLE_FILE_DEFAULT_BUTTON_TEXT;

  return {
    url,
    fileName,
    title,
    description,
    buttonText,
    extension: extractExtension(fileName),
  };
}
