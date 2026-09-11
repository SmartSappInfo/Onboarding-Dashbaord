'use client';

/**
 * @fileOverview The downloadable "sample file" card shown above a file-upload question's
 * dropzone: the author attaches a blank template, the respondent downloads it, fills it
 * in offline and re-uploads it through the same question.
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
  FileImage,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
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
      <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
        <FileSpreadsheet className="h-5 w-5" />
      </div>
    );
  }
  if (extension === '.pdf') {
    return (
      <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
        <FileText className="h-5 w-5" />
      </div>
    );
  }
  if (IMAGE_EXTENSIONS.has(extension)) {
    return (
      <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
        <FileImage className="h-5 w-5" />
      </div>
    );
  }
  return (
    <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm bg-primary/10 text-primary border border-primary/20">
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
}

function SurveySampleFileCardImpl({
  question,
  interpolate,
  className,
}: SurveySampleFileCardProps): React.ReactElement | null {
  const shouldReduceMotion = useReducedMotion();

  // Derived during render, never via useEffect+setState
  // (vercel-react-best-practices `rerender-derived-state-no-effect`).
  const sample = React.useMemo(() => resolveSampleFile(question), [question]);

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

  return (
    <motion.div
      // emilkowal-animations: transform+opacity only, ease-out, well under 300ms, and
      // fully gated behind the user's reduced-motion preference.
      initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
      animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'w-full max-w-2xl p-4 sm:p-5 rounded-2xl bg-card/70 backdrop-blur-md border border-border/60 shadow-sm space-y-3.5 text-left',
        className,
      )}
    >
      <div className="flex items-center gap-3.5">
        <SampleFileIcon extension={sample.extension} />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm sm:text-base font-bold tracking-tight text-foreground leading-snug break-words">
            {copy.title}
          </h4>
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

      {copy.description ? (
        <p className="text-sm text-muted-foreground font-medium leading-relaxed">
          {copy.description}
        </p>
      ) : null}

      <Button
        asChild
        variant="outline"
        className="min-h-[44px] h-11 px-5 rounded-xl border-2 font-bold shadow-sm transition-all active:scale-[0.97] text-sm tracking-tight w-full sm:w-auto"
      >
        <a
          href={sample.url}
          target="_blank"
          // noopener/noreferrer: the target is a storage bucket URL opened in a new tab.
          rel="noopener noreferrer"
          download={sample.fileName}
          // Screen-reader users navigating by link hear only the label otherwise, and
          // "Download sample" is meaningless out of context.
          aria-label={`${copy.buttonText}: ${sample.fileName}`}
        >
          <Download className="mr-2 h-4 w-4 text-primary" />
          <span className="truncate">{copy.buttonText}</span>
        </a>
      </Button>
    </motion.div>
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
