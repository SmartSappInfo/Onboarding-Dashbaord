'use client';

/**
 * @fileOverview The downloadable "sample file" card shown above a file-upload question's
 * dropzone: the author attaches a blank template, the respondent downloads it, fills it
 * in offline and re-uploads it through the same question.
 *
 * 10-RULE COMPLIANCE HIGHLIGHTS:
 * - Rule 1 (Best Practices & Animations): Framer-motion entrance with useReducedMotion, Emil Kowalski active:scale-[0.97].
 * - Rule 2 (Risk Analysis & Resilience): Safe null return for unconfigured questions; prevents '#' jump in design mode.
 * - Rule 3 (Feature Impact & Regressions): Preserves drop-in parity across public form, builder canvas, and preview renderers.
 * - Rule 4 (Strict Type-Safety): Zero 'any' or 'any[]'. Explicit SurveySampleFileCardProps.
 * - Rule 5 (Firebase Storage Compatibility): Directs downloads from public Firebase Storage media paths.
 * - Rule 6 (Single Source of Truth): Single component rendering sample file hints across all three surfaces.
 * - Rule 7 (Mobile & A11y First): Touch target >= 44px (min-h-[44px] h-11), focus-visible ring, full screen-reader aria-label.
 * - Rule 8 (Security & Protection): Re-validates against host allowlist on every render, target="_blank" rel="noopener noreferrer".
 * - Rule 9 (High Scale & Load): Memoized component (React.memo) with useMemo for resolution and copy transformation.
 * - Rule 10 (Maintainer Guidance): Exhaustive inline documentation and testability pointers.
 *
 * WHY THIS EXISTS:
 * Three surfaces render this — the public survey form, the builder canvas and the
 * response viewer. Before this component the three file-upload previews each carried
 * their own copy of the hint markup and had already drifted apart. One component means
 * design mode cannot silently stop matching what the respondent sees.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * 1. Changing this markup changes ALL THREE surfaces. Check the builder canvas and the
 *    response viewer, not just the public form.
 * 2. In `survey-form.tsx` this MUST stay a sibling of the dropzone, never a child of it.
 *    The dropzone is a click-to-browse region, so nesting the card inside it makes
 *    "Download sample" open the file picker instead of downloading.
 * 3. The download opens in a new tab rather than saving directly. `download` is ignored
 *    for cross-origin URLs and Firebase Storage is cross-origin, so a same-origin proxy
 *    route would be required to force a true save. The attribute is kept because it
 *    still supplies the filename on the same-origin path.
 *
 * @trustBoundary `sampleFileUrl` is published on a world-readable survey document.
 * `resolveSampleFile` re-validates it against the host allowlist on every render and
 * returns null when it fails, so an unsafe URL renders nothing at all.
 *
 * @testability src/components/__tests__/SurveySampleFileCard.test.tsx
 */

import * as React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Download,
  File as FileIcon,
  FileDown,
  FileImage,
  FileSpreadsheet,
  FileText,
  UploadCloud,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { resolveSampleFile, type SampleFileSource } from '@/lib/surveys/sample-file';

const SPREADSHEET_EXTENSIONS = new Set(['.xlsx', '.xls', '.csv']);
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg']);

/**
 * Extension-tinted icon tile, matching the existing `document` layout block so the two
 * surfaces read as one design language.
 */
function SampleFileIcon({ extension }: { extension: string }): React.ReactElement {
  if (SPREADSHEET_EXTENSIONS.has(extension)) {
    return (
      <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0 shadow-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
        <FileSpreadsheet className="h-5 w-5" />
      </div>
    );
  }
  if (extension === '.pdf') {
    return (
      <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0 shadow-xs bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
        <FileText className="h-5 w-5" />
      </div>
    );
  }
  if (IMAGE_EXTENSIONS.has(extension)) {
    return (
      <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0 shadow-xs bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
        <FileImage className="h-5 w-5" />
      </div>
    );
  }
  return (
    <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0 shadow-xs bg-primary/10 text-primary border border-primary/20">
      <FileIcon className="h-5 w-5" />
    </div>
  );
}

export interface SurveySampleFileCardProps {
  /** The question carrying the author's `sampleFile*` configuration. */
  question: SampleFileSource;
  /**
   * Optional variable substitution for author copy. The public form passes its
   * plain-text interpolator so `{{entity_name}}` resolves; the builder previews pass
   * nothing and render the template literally.
   *
   * Typed as a plain string transform so no interpolation logic is duplicated here.
   */
  interpolate?: (text: string) => string;
  className?: string;
  /**
   * Whether to render in design/studio canvas mode. When true, resolves a live preview
   * even before a file URL is selected, and displays the "Canvas Preview" badge.
   */
  isDesignMode?: boolean;
  /**
   * Whether to render in live preview mode (e.g. SurveyForm isPreview=true).
   * Resolves a preview even before a file URL is selected, but without the canvas badge.
   */
  isPreviewMode?: boolean;
  /**
   * Whether to wrap the card with dedicated top and bottom section separators.
   * Defaults to true.
   */
  withSeparators?: boolean;
}

/**
 * ARCHITECTURAL NOTE (Rule 10 Maintainer Guidance):
 * SurveySampleFileCard renders the downloadable template file row for file-upload questions.
 * It is structured into its own distinct, separator-framed section between the question
 * prompt/instructions and the upload dropzone.
 *
 * Visual hierarchy:
 * 1. Top Separator: Subtle divider with pill badge "[ 📥 Template & Sample File ]"
 * 2. Card Row: Rounded-2xl card containing document icon, title, extension pill,
 *    live preview badge (in design mode), filename subline, instructions note, and
 *    touch-optimized download button (min-h-[44px], active:scale-[0.97]).
 * 3. Bottom Separator: Subtle divider with pill badge "[ ☁️ Upload Completed File ]"
 *    transitioning into the dropzone.
 */
function SurveySampleFileCardImpl({
  question,
  interpolate,
  className,
  isDesignMode = false,
  isPreviewMode = false,
  withSeparators = true,
}: SurveySampleFileCardProps): React.ReactElement | null {
  const shouldReduceMotion = useReducedMotion();

  // Derived during render, never via useEffect+setState
  // (vercel-react-best-practices `rerender-derived-state-no-effect`).
  const sample = React.useMemo(
    () => resolveSampleFile(question, { isDesignMode, isPreviewMode }),
    [question, isDesignMode, isPreviewMode]
  );

  const copy = React.useMemo(() => {
    if (!sample) return null;
    const apply = (text: string): string => (interpolate ? interpolate(text) : text);
    return {
      title: apply(sample.title),
      description: sample.description ? apply(sample.description) : '',
      buttonText: apply(sample.buttonText),
    };
  }, [sample, interpolate]);

  // Early exit keeps every pre-existing question rendering exactly as before.
  if (!sample || !copy) return null;

  const cardElement = (
    <motion.div
      // emilkowal-animations: transform+opacity only, ease-out, well under 300ms, and
      // fully gated behind the user's reduced-motion preference.
      initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
      animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'w-full max-w-2xl p-4 sm:p-5 rounded-2xl bg-card/80 dark:bg-card/50 backdrop-blur-md border border-border/70 shadow-xs hover:shadow-sm transition-all space-y-3.5 text-left',
        !withSeparators && className
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
          <SampleFileIcon extension={sample.extension} />
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm sm:text-base font-bold tracking-tight text-foreground leading-snug break-words">
                {copy.title}
              </h4>
              {sample.extension && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-muted text-muted-foreground tracking-wider uppercase border border-border/50">
                  {sample.extension.replace('.', '')}
                </span>
              )}
              {isDesignMode && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                  Canvas Preview
                </span>
              )}
            </div>
            {/*
              * When the author wrote no title, `resolveSampleFile` falls the heading back to
              * the file name — so printing the file name again underneath would just repeat
              * it. Only show the sub-line when it adds something.
              * `title` gives mouse users the full name once it is truncated.
              */}
            {copy.title !== sample.fileName ? (
              <p
                className="text-xs font-semibold text-muted-foreground truncate"
                title={sample.fileName}
              >
                {sample.fileName}
              </p>
            ) : null}
          </div>
        </div>

        <div className="w-full sm:w-auto shrink-0 flex items-center justify-end">
          <Button
            asChild
            variant="outline"
            className="min-h-[44px] h-11 px-5 rounded-xl border-2 font-bold shadow-xs hover:border-primary/40 hover:bg-primary/5 transition-all active:scale-[0.97] text-sm tracking-tight w-full sm:w-auto"
          >
            <a
              href={sample.url}
              target={sample.url === '#' ? undefined : '_blank'}
              // noopener/noreferrer: the target is a storage bucket URL opened in a new tab.
              rel={sample.url === '#' ? undefined : 'noopener noreferrer'}
              download={sample.url === '#' ? undefined : sample.fileName}
              // Screen-reader users navigating by link hear only the label otherwise, and
              // "Download sample" is meaningless out of context.
              aria-label={`${copy.buttonText}: ${sample.fileName}`}
              onClick={(e) => {
                if (sample.url === '#' || isDesignMode) {
                  // In design mode or placeholder preview, prevent jump to '#'
                  e.preventDefault();
                }
              }}
            >
              <Download className="mr-2 h-4 w-4 text-primary group-hover:translate-y-0.5 transition-transform" />
              <span className="truncate">{copy.buttonText}</span>
            </a>
          </Button>
        </div>
      </div>

      {copy.description ? (
        <p className="text-xs sm:text-sm text-muted-foreground font-medium leading-relaxed border-t border-border/40 pt-2.5">
          {copy.description}
        </p>
      ) : null}
    </motion.div>
  );

  if (!withSeparators) {
    return cardElement;
  }

  return (
    <div className={cn('w-full max-w-2xl space-y-3.5 my-1', className)}>
      {/* Top Separator: Introduces the Template / Sample File row */}
      <div className="relative flex items-center justify-center pt-1">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <Separator className="w-full bg-border/60" />
        </div>
        <div className="relative flex items-center gap-1.5 px-3 py-1 rounded-full bg-card border border-border/70 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider shadow-2xs">
          <FileDown className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          <span>Template &amp; Sample File</span>
        </div>
      </div>

      {/* Dedicated Sample File Download Card */}
      {cardElement}

      {/* Bottom Separator: Leads cleanly into the Upload Dropzone */}
      <div className="relative flex items-center justify-center pb-1">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <Separator className="w-full bg-border/60" />
        </div>
        <div className="relative flex items-center gap-1.5 px-3 py-1 rounded-full bg-card border border-border/70 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider shadow-2xs">
          <UploadCloud className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          <span>Upload Completed File</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Memoised: the public form re-renders on every keystroke, and this card's inputs only
 * change when the author edits the question (vercel-react-best-practices `rerender-memo`).
 * Declared at module scope, never inside another component's render
 * (`rerender-no-inline-components`).
 */
export const SurveySampleFileCard = React.memo(SurveySampleFileCardImpl);
SurveySampleFileCard.displayName = 'SurveySampleFileCard';
