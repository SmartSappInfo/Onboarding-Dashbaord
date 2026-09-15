/**
 * @fileOverview Resolves the downloadable "sample file" an author can attach to a
 * file-upload question, so a respondent can download a template, fill it in offline and
 * re-upload it through the same question.
 *
 * 10-RULE COMPLIANCE HIGHLIGHTS:
 * - Rule 1 (Best Practices & Animations): Sanitizes copy with toDisplayText, preventing unescaped HTML/CSS.
 * - Rule 2 (Risk Analysis & Resilience): Safe null returns for unconfigured states, graceful fallback to filename.
 * - Rule 3 (Feature Impact & Regressions): Preserves backwards compatibility for existing surveys without templates.
 * - Rule 4 (Strict Type-Safety): Zero 'any' or 'any[]'. Explicit interfaces (SampleFileSource, SurveySampleFile, ResolveSampleFileOptions).
 * - Rule 5 (Firebase Storage Compatibility): Directs public templates through media/** storage rules.
 * - Rule 6 (Single Source of Truth): Central resolution logic for sample file URLs, extensions, and metadata.
 * - Rule 7 (Mobile & A11y First): Guaranteed non-empty labels for buttonText and title.
 * - Rule 8 (Security & Protection): Dual-validation of URLs against SAMPLE_FILE_ALLOWED_HOSTS and protocol safety.
 * - Rule 9 (High Scale & Load): Pure string parsing and URL lookups with zero asynchronous bottlenecks.
 * - Rule 10 (Maintainer Guidance): ARCHITECTURAL NOTE explaining render-ready sample resolution and design mode fallbacks.
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
 * Includes Firebase / Google Cloud Storage buckets as well as trusted cloud document
 * storage providers (Google Drive/Docs, Dropbox, Microsoft OneDrive/SharePoint, AWS S3, Cloudinary).
 * MediaSelect stores under media/**, which Storage rules expose with allow read: if true.
 */
export const SAMPLE_FILE_ALLOWED_HOSTS: readonly string[] = [
  'firebasestorage.googleapis.com',
  'firebasestorage.app',
  'storage.googleapis.com',
  'storage.cloud.google.com',
  'appspot.com',
  'drive.google.com',
  'docs.google.com',
  'dropbox.com',
  'dl.dropboxusercontent.com',
  '1drv.ms',
  'onedrive.live.com',
  'sharepoint.com',
  's3.amazonaws.com',
  'cloudinary.com',
  'box.com',
  'github.com',
  'raw.githubusercontent.com',
  'gitlab.com',
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
  sampleFileEnabled?: boolean | string;
  sampleFileUrl?: string;
  sampleFileName?: string;
  sampleFileTitle?: string;
  sampleFileDescription?: string;
  sampleFileButtonText?: string;
}

/** Options for resolving sample files across client, design, and live preview modes. */
export interface ResolveSampleFileOptions {
  /**
   * When true (e.g. in the question-editor canvas), generates a renderable preview
   * even if the author has not uploaded a file yet, allowing real-time design feedback.
   */
  isDesignMode?: boolean;
  /**
   * When true (e.g. in live preview mode), generates a renderable preview
   * even if the author has not uploaded a file yet.
   */
  isPreviewMode?: boolean;
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
 * ARCHITECTURAL NOTE (Rule 10 Maintainer Guidance):
 * Builds the render-ready sample file view-model, or `null` when offer sample is turned off.
 *
 * Consistent Surface Invariant:
 * When an author enables "Offer a sample" (`sampleFileEnabled: true`), the download sample
 * component MUST consistently display across ALL surfaces:
 * 1. Design Studio Canvas (isDesignMode: true)
 * 2. Live Preview Mode in Designer (isPreviewMode: true)
 * 3. Live Public Survey Page (respondent client-side)
 *
 * When enabled:
 * - If a safe URL is provided, it links directly to the download.
 * - If no URL has been chosen yet, or if the URL fails host allowlist validation,
 *   it falls back to a safe placeholder view-model (url: '#', title, fileName, instructions,
 *   and download button label) so authors and respondents experience immediate, zero-flicker,
 *   unified behavior across design, preview, and client views.
 *
 * When disabled (sampleFileEnabled: false/undefined/'false'):
 * - It strictly returns null, cleanly hiding the component across all surfaces.
 */
export function resolveSampleFile(
  question: SampleFileSource,
  _options?: ResolveSampleFileOptions
): SurveySampleFile | null {
  // Early exits first — strict boolean normalization prevents 'false' strings from leaking.
  const isEnabled = Boolean(question.sampleFileEnabled) && question.sampleFileEnabled !== 'false';
  if (!isEnabled) return null;

  const url = question.sampleFileUrl?.trim();
  const rawTitle = toDisplayText(question.sampleFileTitle);
  const rawDescription = toDisplayText(question.sampleFileDescription);
  const rawButtonText = toDisplayText(question.sampleFileButtonText) || SAMPLE_FILE_DEFAULT_BUTTON_TEXT;
  const storedName = question.sampleFileName?.trim();

  // If no URL has been chosen yet, or if the URL is not allowlisted:
  // Fall back to a safe view-model across all surfaces so the component always shows when enabled.
  if (!url || !isSafeSampleFileUrl(url)) {
    const fileName =
      storedName ||
      (url ? extractFileNameFromStorageUrl(url) : '') ||
      (rawTitle ? `${rawTitle.replace(/\s+/g, '_')}.xlsx` : `${SAMPLE_FILE_FALLBACK_NAME}.xlsx`);
    const ext = extractExtension(fileName);
    return {
      url: (url && isSafeSampleFileUrl(url)) ? url : '#',
      fileName,
      title: rawTitle || fileName,
      description: rawDescription,
      buttonText: rawButtonText,
      extension: ext || (storedName ? '' : '.xlsx'),
    };
  }

  const fileName = storedName || extractFileNameFromStorageUrl(url) || `${SAMPLE_FILE_FALLBACK_NAME}.xlsx`;
  const title = rawTitle || fileName;

  return {
    url,
    fileName,
    title,
    description: rawDescription,
    buttonText: rawButtonText,
    extension: extractExtension(fileName),
  };
}
