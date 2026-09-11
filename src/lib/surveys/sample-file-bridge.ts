/**
 * @fileOverview Carries a template file across a `file-upload` ⇄ `document` type switch.
 *
 * WHY THIS EXISTS:
 * The block inspector's `convertBlockType` preserves fields by spreading the old element,
 * which silently strands data whenever two block types store the same concept under
 * different names. A `document` block and a `file-upload` question both hold "a
 * downloadable template plus its copy", but under `url`/`title`/`description`/`buttonText`
 * and `sampleFileUrl`/`sampleFileTitle`/… respectively. Without this bridge, converting
 * between them looks like the author's template just vanished.
 *
 * DESIGN RULE — never clobber:
 * A field is only written when the target is empty. If both sides hold a value, the one
 * the author can already see on the target block wins. Losing visible data on a type
 * switch is far worse than leaving a hidden field unmapped.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * This returns a PATCH to merge over the converted element, not the element itself. Keys
 * set to `undefined` are intentional erasures — the caller must apply them (a plain
 * spread does this correctly).
 *
 * @testability src/lib/surveys/__tests__/sample-file-bridge.test.ts
 */
import type { SurveyElement } from '@/lib/types';

/** The union of both shapes' template-carrying fields, all optional. */
export interface SampleFileBridgeSource {
  // `document` layout block
  url?: string;
  title?: string;
  description?: string;
  buttonText?: string;
  fileName?: string;
  // `file-upload` question
  sampleFileEnabled?: boolean;
  sampleFileUrl?: string;
  sampleFileName?: string;
  sampleFileTitle?: string;
  sampleFileDescription?: string;
  sampleFileButtonText?: string;
}

/** Patch to merge over the converted element. `undefined` means "erase this field". */
export type SampleFileBridgePatch = Partial<SampleFileBridgeSource>;

/** True when the value carries nothing worth preserving. */
function isBlank(value: string | undefined): boolean {
  return !value || !value.trim();
}

/**
 * Returns the field patch for a block type conversion.
 *
 * Returns an empty object for every conversion that does not involve a template, so
 * unrelated type switches keep their existing behaviour byte-for-byte.
 */
export function bridgeSampleFileFields(
  oldType: SurveyElement['type'],
  newType: SurveyElement['type'],
  element: SampleFileBridgeSource,
): SampleFileBridgePatch {
  if (oldType === newType) return {};

  // Question sample -> standalone document block.
  if (oldType === 'file-upload' && newType === 'document') {
    const patch: SampleFileBridgePatch = {
      // Always clear the source fields: once converted they are unreachable in the UI,
      // so leaving them behind would bloat the document and confuse a later conversion.
      sampleFileEnabled: undefined,
      sampleFileUrl: undefined,
      sampleFileName: undefined,
      sampleFileTitle: undefined,
      sampleFileDescription: undefined,
      sampleFileButtonText: undefined,
    };

    if (isBlank(element.url) && !isBlank(element.sampleFileUrl)) {
      patch.url = element.sampleFileUrl;
    }
    if (isBlank(element.fileName) && !isBlank(element.sampleFileName)) {
      patch.fileName = element.sampleFileName;
    }
    if (isBlank(element.description) && !isBlank(element.sampleFileDescription)) {
      patch.description = element.sampleFileDescription;
    }
    if (isBlank(element.buttonText) && !isBlank(element.sampleFileButtonText)) {
      patch.buttonText = element.sampleFileButtonText;
    }

    return patch;
  }

  // Standalone document block -> question sample.
  if (oldType === 'document' && newType === 'file-upload') {
    // Nothing to attach: leave the sample switched off rather than enabling an empty card.
    if (isBlank(element.url)) return {};

    const patch: SampleFileBridgePatch = {
      sampleFileEnabled: true,
      sampleFileUrl: element.url,
    };

    if (!isBlank(element.fileName)) patch.sampleFileName = element.fileName;
    if (!isBlank(element.description)) patch.sampleFileDescription = element.description;
    if (!isBlank(element.buttonText)) patch.sampleFileButtonText = element.buttonText;

    // `title` is deliberately NOT copied. The caller's base spread already promotes it to
    // the question's own title, and the sample card falls back to the file name — copying
    // it here would print the same string twice on the card.

    return patch;
  }

  return {};
}
