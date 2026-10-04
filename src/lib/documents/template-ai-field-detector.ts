/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Authoritative In-Editor AI Field Detection & OCR Geometry Engine (P5.1).
 *    Intelligently identifies form fields, table inputs, student/parent details,
 *    and execution/signature blocks from document text and visual bounding boxes.
 * 2. Invariants Maintained:
 *    - Normalized Percentage Coordinates (FM-P5-05): Strictly bounds all coordinates
 *      (leftPct, topPct, widthPct, heightPct) within [0, 100]. Prevents DPI and canvas drift.
 *      In addition, guarantees leftPct + widthPct <= 100 and topPct + heightPct <= 100.
 *    - Multi-Signer Differentiation: Maps detected signature blocks to recipient roles
 *      ('signer', 'countersigner').
 *    - Multi-Field Line Support: Correctly extracts multiple fields on the same row/line
 *      (e.g. "STUDENT NAME: _______ GRADE: ______") as distinct fields with horizontal offsets.
 *    - Non-Destructive Invariant: Suggestions are returned as candidate overlays for user confirmation.
 *      No template or document instance is mutated autonomously.
 *    - Zero-Tolerance Typing (Rule 4): Strictly 0 `any` or `any[]` throughout.
 */

import {
  AiFieldSuggestionSchema,
  type AiFieldSuggestion,
  type AiFieldType,
  type RecipientRole,
} from '@/lib/types/document-signing';
import type {
  ExtractedPageData,
  ExtractedTextItem,
} from './client-pdf-text-extractor';

export interface DetectTemplateFieldsOptions {
  minConfidence?: number;
  defaultRole?: RecipientRole;
  pagesData?: ExtractedPageData[];
}

interface DetectedBlock {
  partyIndex: number;
  partyLabel: string;
  role: RecipientRole;
  leftPct: number;
  widthPct: number;
  baseTopPct: number;
  lines: Array<{ lineText: string; lineIndex: number }>;
}

/**
 * Normalizes and capitalizes field labels into clean UI English (e.g. "Student Name", "Grade").
 */
function formatFieldTitle(keyword: string, rowPrefix?: string): string {
  const normalized = keyword
    .replace(/[:_#]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

  let title = normalized
    .split(' ')
    .map((w) =>
      w
        .split('/')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('/')
    )
    .join(' ');

  // Handle specific acronyms or phrases
  title = title
    .replace(/\bDob\b/g, 'Date of Birth')
    .replace(/\bId\b/g, 'ID')
    .replace(/\bNo\b/g, 'Number')
    .replace(/\bGhana Card\b/g, 'Ghana Card Number')
    .replace(/\bNumber Number\b/g, 'Number')
    .replace(/\bSign\b/g, 'Signature')
    .trim();

  if (rowPrefix) {
    const cleanPrefix = rowPrefix.replace(/[^0-9]/g, '');
    if (cleanPrefix) {
      return `${title} ${cleanPrefix}`;
    }
  }

  return title;
}

export const FIELD_KEYWORD_REGEX =
  /(?:(?:^|\s+)(\b\d+[\.\)]\s*)?)(student(?:'s)?\s*name|pupil\s*name|child\s*name|parent(?:\s*[\/\&]\s*guardian)?(?:\s*name)?|guardian(?:\s*name)?|applicant\s*name|full\s*name|printed?\s*name|name|grade(?:\s*level)?|class(?:\s*[\/\&]\s*grade)?|(?:grade|class)\s*[\/\&]\s*form|(?:academic|school|grade)\s*year|contact(?:\s*(?:no|number))?|phone(?:\s*(?:no|number))?|telephone|mobile|cell|ghana\s*card(?:\s*(?:no|number|#))?|id\s*card|national\s*id|email(?:\s*address)?|home\s*address|residential\s*address|street|address|date\s*of\s*birth|dob|admission\s*(?:no|number)|student\s*id|id\s*(?:no|number|#)?|authorized\s*sign(?:ature)?|parent\s*sign(?:ature)?|student\s*sign(?:ature)?|sign(?:ature)?(?:\s*(?:of|here|below)[^:]*)?|sign\b|by|date(?:\s*signed)?|signed\s*on|date|title|position|designation|initials?|amount|fee|payment\s*method)\s*[:_#]/gi;

interface ProcessableLine {
  text: string;
  topPct: number;
  heightPct: number;
  minLeftPct: number;
  maxRightPct: number;
  items: ExtractedTextItem[];
  lineIndex: number;
}

/**
 * Scans page text streams and layout geometry, extracting candidate form, text,
 * date, and signature fields with normalized percentage coordinates for visual template editing.
 */
export function detectTemplateFieldsFromPages(
  pageTexts: string[],
  options?: DetectTemplateFieldsOptions
): AiFieldSuggestion[] {
  const minConfidence = options?.minConfidence ?? 0.7;
  const defaultRole = options?.defaultRole ?? 'signer';
  const pagesData = options?.pagesData;
  const suggestions: AiFieldSuggestion[] = [];

  pageTexts.forEach((pageText, pageIdx) => {
    if (!pageText || pageText.trim().length === 0) return;

    const pageNumber = pageIdx + 1;
    const pageData = pagesData?.[pageIdx];
    const pageLines = pageData?.lines;
    const pageItems = pageData?.items;

    const rawLinesText = pageText.split('\n').map((l) => l.trim()).filter(Boolean);
    const totalLines = rawLinesText.length;

    let linesToProcess: ProcessableLine[];

    if (pageLines && pageLines.length > 0) {
      linesToProcess = pageLines.map((pl, idx) => ({
        text: pl.text,
        topPct: pl.topPct,
        heightPct: pl.heightPct,
        minLeftPct: pl.minLeftPct,
        maxRightPct: pl.maxRightPct,
        items: pl.items,
        lineIndex: idx,
      }));
    } else {
      linesToProcess = rawLinesText.map((txt, idx) => {
        const estTop = Math.min(
          92.0,
          Math.max(6.0, 8.0 + (idx / Math.max(totalLines, 1)) * 82.0)
        );
        return {
          text: txt,
          topPct: estTop,
          heightPct: 2.5,
          minLeftPct: 10.0,
          maxRightPct: 88.0,
          items: pageItems
            ? pageItems.filter((it) => Math.abs(it.topPct - estTop) <= 2.5)
            : [],
          lineIndex: idx,
        };
      });
    }

    const pageRightBound = Math.min(
      88.0,
      Math.max(82.0, ...linesToProcess.map((l) => l.maxRightPct))
    );

    const partyBlocks: DetectedBlock[] = [];
    let currentPartyIdx = 0;
    let blockLines: Array<{ lineText: string; lineIndex: number; lineTopPct: number; lineItems: ExtractedTextItem[] }> = [];
    let currentLabel = '';

    linesToProcess.forEach((pLine) => {
      const lineLower = pLine.text.toLowerCase();
      const isPartyHeader =
        lineLower.includes('client / customer') ||
        lineLower.includes('client:') ||
        lineLower.includes('customer:') ||
        lineLower.includes('party a') ||
        lineLower.includes('service provider') ||
        lineLower.includes('contractor:') ||
        lineLower.includes('party b') ||
        lineLower.includes('vendor:');

      if (isPartyHeader) {
        if (blockLines.length > 0 && currentLabel) {
          partyBlocks.push({
            partyIndex: currentPartyIdx,
            partyLabel: currentLabel,
            role: currentPartyIdx === 0 ? 'signer' : 'countersigner',
            leftPct: currentPartyIdx === 0 ? 10.0 : 52.0,
            widthPct: 38.0,
            baseTopPct: blockLines[0].lineTopPct,
            lines: blockLines.map((b) => ({ lineText: b.lineText, lineIndex: b.lineIndex })),
          });
          currentPartyIdx++;
        }
        currentLabel = pLine.text.replace(/[:]/g, '').trim();
        blockLines = [];
      } else if (currentLabel) {
        blockLines.push({
          lineText: pLine.text,
          lineIndex: pLine.lineIndex,
          lineTopPct: pLine.topPct,
          lineItems: pLine.items,
        });
      }
    });

    if (blockLines.length > 0 && currentLabel) {
      partyBlocks.push({
        partyIndex: currentPartyIdx,
        partyLabel: currentLabel,
        role: currentPartyIdx === 0 ? 'signer' : 'countersigner',
        leftPct: currentPartyIdx === 0 ? 10.0 : 52.0,
        widthPct: 38.0,
        baseTopPct: blockLines[0].lineTopPct,
        lines: blockLines.map((b) => ({ lineText: b.lineText, lineIndex: b.lineIndex })),
      });
    }

    let fieldCounter = 1;
    const consumedLineIndices = new Set<number>();

    // Branch A: Multi-party execution blocks found (e.g. standard contract closing)
    if (partyBlocks.length > 0) {
      partyBlocks.forEach((block) => {
        let relativeOffset = 0;

        block.lines.forEach(({ lineText, lineIndex }) => {
          const lineLower = lineText.toLowerCase();

          let detectedType: AiFieldType | null = null;
          let label = '';
          let confidence = 0.85;
          let heightPct = 3.8;

          if (
            lineLower.startsWith('by:') ||
            lineLower.includes('signature:') ||
            lineLower.includes('sign:') ||
            /\bsign(?:ature)?\s*[:_]/.test(lineLower)
          ) {
            detectedType = 'signature';
            label = `${block.partyLabel} Signature`;
            confidence = 0.96;
            heightPct = 5.0;
          } else if (lineLower.startsWith('name:') || lineLower.includes('printed name:')) {
            detectedType = 'signer_name';
            label = `${block.partyLabel} Name`;
            confidence = 0.92;
            heightPct = 2.6;
          } else if (lineLower.startsWith('date:') || lineLower.includes('signed on:')) {
            detectedType = 'date';
            label = `${block.partyLabel} Date`;
            confidence = 0.94;
            heightPct = 2.6;
          } else if (lineLower.startsWith('title:')) {
            detectedType = 'text';
            label = `${block.partyLabel} Title`;
            confidence = 0.88;
            heightPct = 2.6;
          } else if (lineLower.includes('initials:')) {
            detectedType = 'initials';
            label = `${block.partyLabel} Initials`;
            confidence = 0.91;
            heightPct = 4.0;
          }

          if (detectedType && confidence >= minConfidence) {
            consumedLineIndices.add(lineIndex);

            const matchedLine = linesToProcess.find((l) => l.lineIndex === lineIndex);
            const lineTop = matchedLine ? matchedLine.topPct - 0.4 : block.baseTopPct + relativeOffset;

            const fieldId = `ai_field_${pageNumber}_${fieldCounter++}_${detectedType}`;

            const leftPct = block.leftPct;
            const topPct = Number(lineTop.toFixed(1));
            const widthPct = Math.min(block.widthPct, 100 - leftPct);
            const boundedHeightPct = Math.min(heightPct, 100 - topPct);

            // Extract the document prompt label (e.g. "By:" or "Date:")
            const promptColonIdx = lineText.indexOf(':');
            const docLabel = promptColonIdx !== -1 ? lineText.slice(0, promptColonIdx + 1).trim() : lineText.trim();

            const candidate = AiFieldSuggestionSchema.parse({
              id: fieldId,
              pageNumber,
              fieldType: detectedType,
              label,
              recipientRole: block.role,
              confidence,
              leftPct,
              topPct,
              widthPct,
              heightPct: boundedHeightPct,
              sourceExcerpt: docLabel,
              accepted: false,
            });

            suggestions.push(candidate);
            relativeOffset += 3.5;
          }
        });
      });
    }

    // Branch B: Form fields, table inputs, student/parent details, and signature lines
    linesToProcess.forEach((pLine) => {
      // Skip lines already consumed by explicit party execution blocks
      if (consumedLineIndices.has(pLine.lineIndex)) return;

      const matches: Array<{
        rawKeyword: string;
        documentLabel: string;
        cleanLabel: string;
        fieldType: AiFieldType;
        confidence: number;
        start: number;
        end: number;
        rowPrefix?: string;
      }> = [];

      let lineRowPrefix: string | undefined;

      // Reset regex index for each line
      FIELD_KEYWORD_REGEX.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = FIELD_KEYWORD_REGEX.exec(pLine.text)) !== null) {
        const fullMatched = match[0];
        const leadingSpace = fullMatched.match(/^\s*/)?.[0]?.length || 0;
        const matchStart = match.index + leadingSpace;
        const matchEnd = match.index + fullMatched.length;
        const rowPrefix = match[1]?.trim();
        const keyword = match[2] || fullMatched;
        const kwLower = keyword.toLowerCase().trim();

        if (rowPrefix) {
          lineRowPrefix = rowPrefix;
        }

        let fieldType: AiFieldType = 'text';
        let confidence = 0.88;

        if (
          /\bsign(?:ature)?\b/i.test(kwLower) ||
          (kwLower === 'by' && (pLine.text.trim().toLowerCase().startsWith('by') || pLine.text.includes('___'))) ||
          kwLower.includes('authorized signature')
        ) {
          fieldType = 'signature';
          confidence = 0.96;
        } else if (kwLower.includes('initial')) {
          fieldType = 'initials';
          confidence = 0.92;
        } else if (kwLower.includes('date') || kwLower === 'dob') {
          fieldType = 'date';
          confidence = 0.94;
        } else if (
          kwLower === 'name' ||
          kwLower === 'printed name' ||
          kwLower === 'print name' ||
          kwLower === 'full name'
        ) {
          fieldType = 'signer_name';
          confidence = 0.92;
        } else if (kwLower.includes('student') || kwLower.includes('grade')) {
          fieldType = 'text';
          confidence = 0.93;
        } else if (
          kwLower.includes('parent') ||
          kwLower.includes('contact') ||
          kwLower.includes('phone') ||
          kwLower.includes('email') ||
          kwLower.includes('ghana card') ||
          kwLower.includes('id card') ||
          kwLower.includes('national id')
        ) {
          fieldType = 'text';
          confidence = 0.91;
        }

        matches.push({
          rawKeyword: keyword,
          documentLabel: fullMatched.trim(),
          cleanLabel: '',
          fieldType,
          confidence,
          start: matchStart,
          end: matchEnd,
          rowPrefix,
        });
      }

      if (matches.length === 0) return;

      // Assign labels, propagating line row prefix to companion fields on the same line
      matches.forEach((m) => {
        const effectivePrefix = m.rowPrefix || lineRowPrefix;
        m.cleanLabel = formatFieldTitle(m.rawKeyword, effectivePrefix);
      });

      // Build character spans for precise visual item mapping by locating each item in pLine.text
      let searchOffset = 0;
      const itemSpans = pLine.items.map((it) => {
        const itemStr = it.str.trim();
        let foundIdx = itemStr ? pLine.text.indexOf(itemStr, searchOffset) : -1;
        if (foundIdx === -1) {
          foundIdx = searchOffset;
        }
        const startChar = foundIdx;
        const endChar = foundIdx + it.str.length;
        searchOffset = Math.max(searchOffset, endChar);
        return { item: it, startChar, endChar };
      });

      matches.forEach((m, mIdx) => {
        if (m.confidence < minConfidence) return;

        let leftPct: number;
        let widthPct: number;
        const isSignature = m.fieldType === 'signature' || m.fieldType === 'initials';

        if (itemSpans.length > 0) {
          // Find item covering prompt start
          const startSpan =
            itemSpans.find((s) => m.start >= s.startChar && m.start < s.endChar) || itemSpans[0];
          // Find item covering prompt end
          const endSpan =
            itemSpans.find((s) => m.end > s.startChar && m.end <= s.endChar) ||
            itemSpans.find((s) => s.endChar >= m.end) ||
            startSpan;

          const promptEndPct = endSpan.item.leftPct + endSpan.item.widthPct;
          leftPct = Number((promptEndPct + 0.8).toFixed(1));

          // Determine field right edge
          let fieldRight = pageRightBound;
          const nextMatch = matches[mIdx + 1];
          if (nextMatch) {
            const nextStartSpan =
              itemSpans.find((s) => nextMatch.start >= s.startChar && nextMatch.start < s.endChar) ||
              itemSpans.find((s) => s.startChar >= nextMatch.start);
            if (nextStartSpan) {
              fieldRight = nextStartSpan.item.leftPct - 1.0;
            }
          } else {
            const defaultW =
              m.fieldType === 'signature'
                ? 28.0
                : m.fieldType === 'date'
                ? 16.0
                : m.fieldType === 'initials'
                ? 12.0
                : 24.0;
            fieldRight = Math.min(pageRightBound, leftPct + defaultW);
          }

          widthPct = Number(Math.max(6.0, fieldRight - leftPct).toFixed(1));
        } else {
          // Pure text fallback when item geometry is not available
          const lineLength = Math.max(pLine.text.length, 1);
          const totalWidth = 72.0;
          const startFraction = m.start / lineLength;
          const nextMatch = matches[mIdx + 1];
          const endFraction = nextMatch ? nextMatch.start / lineLength : 1.0;

          const colLeft = 14.0 + startFraction * totalWidth;
          const colWidth = (endFraction - startFraction) * totalWidth;
          const promptCharFraction = (m.end - m.start) / Math.max(1, lineLength * (endFraction - startFraction));
          const promptEndOffset = colWidth * Math.min(0.45, Math.max(0.15, promptCharFraction));

          leftPct = Number((colLeft + promptEndOffset).toFixed(1));
          widthPct = Number(Math.max(8.0, colLeft + colWidth - leftPct - 1.0).toFixed(1));
        }

        // Align field vertically with text line
        const heightPct = isSignature
          ? Math.max(3.8, Math.min(5.2, Number((pLine.heightPct * 2.2).toFixed(1))))
          : Math.max(2.4, Math.min(2.8, Number((pLine.heightPct * 1.3).toFixed(1))));

        const topPct = Number((pLine.topPct - (isSignature ? 0.5 : 0.4)).toFixed(1));

        // Strictly bound within [0, 100]%
        const boundedLeft = Math.max(0, Math.min(94, leftPct));
        const boundedTop = Math.max(0, Math.min(94, topPct));
        const boundedWidth = Math.max(4, Math.min(100 - boundedLeft, widthPct));
        const boundedHeight = Math.max(2.0, Math.min(100 - boundedTop, heightPct));

        const fieldId = `ai_field_${pageNumber}_${fieldCounter++}_${m.fieldType}`;

        const role: RecipientRole =
          m.cleanLabel.toLowerCase().includes('counter') ||
          m.cleanLabel.toLowerCase().includes('provider')
            ? 'countersigner'
            : defaultRole;

        const candidate = AiFieldSuggestionSchema.parse({
          id: fieldId,
          pageNumber,
          fieldType: m.fieldType,
          label: m.cleanLabel,
          recipientRole: role,
          confidence: m.confidence,
          leftPct: boundedLeft,
          topPct: boundedTop,
          widthPct: boundedWidth,
          heightPct: boundedHeight,
          sourceExcerpt: m.documentLabel || pLine.text.trim(),
          accepted: false,
        });

        suggestions.push(candidate);
      });
    });
  });

  return suggestions;
}

