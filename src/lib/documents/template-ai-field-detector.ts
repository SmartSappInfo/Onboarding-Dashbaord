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
import type { ExtractedPageData, ExtractedTextItem } from './client-pdf-text-extractor';

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

interface MatchedFieldPrompt {
  rawKeyword: string;
  cleanLabel: string;
  fieldType: AiFieldType;
  confidence: number;
  startIndex: number;
  endIndex: number;
  rowPrefix?: string;
}

/**
 * Normalizes and capitalizes field labels into clean UI English (e.g. "Student Name", "Grade").
 */
function formatFieldTitle(keyword: string, rowPrefix?: string): string {
  const normalized = keyword
    .replace(/[:_]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

  let title = normalized
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  // Handle specific acronyms or phrases
  title = title
    .replace(/\bDob\b/g, 'Date of Birth')
    .replace(/\bId\b/g, 'ID')
    .replace(/\bNo\b/g, 'Number');

  if (rowPrefix) {
    const cleanPrefix = rowPrefix.replace(/[^0-9]/g, '');
    if (cleanPrefix) {
      return `${title} ${cleanPrefix}`;
    }
  }

  return title;
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
    const pageItems = pagesData?.[pageIdx]?.items;

    // First check if the page contains explicit party/execution blocks (e.g., Client / Service Provider)
    const rawLines = pageText.split('\n').map((l) => l.trim()).filter(Boolean);
    const totalLines = rawLines.length;

    const partyBlocks: DetectedBlock[] = [];
    let currentPartyIdx = 0;
    let blockLines: Array<{ lineText: string; lineIndex: number }> = [];
    let currentLabel = '';

    rawLines.forEach((line, lineIdx) => {
      const lineLower = line.toLowerCase();
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
            baseTopPct: 60.0 + currentPartyIdx * 15.0,
            lines: [...blockLines],
          });
          currentPartyIdx++;
        }
        currentLabel = line.replace(/[:]/g, '').trim();
        blockLines = [];
      } else if (currentLabel) {
        blockLines.push({ lineText: line, lineIndex: lineIdx });
      }
    });

    if (blockLines.length > 0 && currentLabel) {
      partyBlocks.push({
        partyIndex: currentPartyIdx,
        partyLabel: currentLabel,
        role: currentPartyIdx === 0 ? 'signer' : 'countersigner',
        leftPct: currentPartyIdx === 0 ? 10.0 : 52.0,
        widthPct: 38.0,
        baseTopPct: 60.0 + currentPartyIdx * 15.0,
        lines: [...blockLines],
      });
    }

    let fieldCounter = 1;

    // Branch A: Multi-party execution blocks found (e.g. standard contract closing)
    if (partyBlocks.length > 0) {
      partyBlocks.forEach((block) => {
        let relativeOffset = 0;

        block.lines.forEach(({ lineText, lineIndex }) => {
          const lineLower = lineText.toLowerCase();

          let detectedType: AiFieldType | null = null;
          let label = '';
          let confidence = 0.85;
          let heightPct = 4.0;

          if (lineLower.startsWith('by:') || lineLower.includes('signature:')) {
            detectedType = 'signature';
            label = `${block.partyLabel} Signature`;
            confidence = 0.96;
            heightPct = 6.0;
          } else if (lineLower.startsWith('name:') || lineLower.includes('printed name:')) {
            detectedType = 'signer_name';
            label = `${block.partyLabel} Name`;
            confidence = 0.92;
          } else if (lineLower.startsWith('date:') || lineLower.includes('signed on:')) {
            detectedType = 'date';
            label = `${block.partyLabel} Date`;
            confidence = 0.94;
          } else if (lineLower.startsWith('title:')) {
            detectedType = 'text';
            label = `${block.partyLabel} Title`;
            confidence = 0.88;
          } else if (lineLower.includes('initials:')) {
            detectedType = 'initials';
            label = `${block.partyLabel} Initials`;
            confidence = 0.91;
            heightPct = 5.0;
          }

          if (detectedType && confidence >= minConfidence) {
            const estimatedTopPct = Math.min(
              92.0,
              Math.max(10.0, 50.0 + (lineIndex / Math.max(totalLines, 1)) * 45.0 + relativeOffset)
            );

            const fieldId = `ai_field_${pageNumber}_${fieldCounter++}_${detectedType}`;

            const leftPct = block.leftPct;
            const topPct = Number(estimatedTopPct.toFixed(1));
            const widthPct = Math.min(block.widthPct, 100 - leftPct);
            const boundedHeightPct = Math.min(heightPct, 100 - topPct);

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
              sourceExcerpt: lineText,
              accepted: false,
            });

            suggestions.push(candidate);
            relativeOffset += 1.5;
          }
        });
      });
      return;
    }

    // Branch B: Form fields, table inputs, student/parent information, and signature lines
    rawLines.forEach((line, lineIdx) => {
      // Find all field prompt matches in this line
      const matches: MatchedFieldPrompt[] = [];

      // Regex matches prompts like:
      // "4. STUDENT NAME:", "GRADE:", "PARENT/GUARDIAN SIGNATURE:", "DATE:", "CONTACT NUMBER:"
      const regex =
        /(?:(?:^|\s+)(\b\d+[\.\)]\s*)?)(student(?:'s)?\s*name|pupil\s*name|child\s*name|parent(?:\s*[\/\&]\s*guardian)?(?:\s*name)?|guardian(?:\s*name)?|applicant\s*name|full\s*name|printed?\s*name|name|grade(?:\s*level)?|class(?:\s*[\/\&]\s*grade)?|form|year|contact(?:\s*number)?|phone(?:\s*number)?|telephone|mobile|cell|email(?:\s*address)?|home\s*address|residential\s*address|street|address|date\s*of\s*birth|dob|admission\s*(?:no|number)|student\s*id|id\s*number|authorized\s*signature|parent\s*signature|student\s*signature|signature(?:\s*of\s*[^:]+)?|by|date(?:\s*signed)?|signed\s*on|date|title|position|designation|initials?|amount|fee|payment\s*method)\s*[:_]/gi;

      let match: RegExpExecArray | null;
      while ((match = regex.exec(line)) !== null) {
        const fullMatched = match[0];
        const rowPrefix = match[1]?.trim();
        const keyword = match[2] || fullMatched;
        const kwLower = keyword.toLowerCase().trim();

        let fieldType: AiFieldType = 'text';
        let confidence = 0.88;

        if (
          kwLower.includes('signature') ||
          kwLower === 'by' ||
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
        } else if (kwLower.includes('parent') || kwLower.includes('contact') || kwLower.includes('phone') || kwLower.includes('email')) {
          fieldType = 'text';
          confidence = 0.91;
        }

        const cleanLabel = formatFieldTitle(keyword, rowPrefix);

        matches.push({
          rawKeyword: keyword,
          cleanLabel,
          fieldType,
          confidence,
          startIndex: match.index,
          endIndex: match.index + fullMatched.length,
          rowPrefix,
        });
      }

      if (matches.length === 0) return;

      const lineLength = Math.max(line.length, 1);
      const estimatedTopPct = Math.min(
        92.0,
        Math.max(6.0, 8.0 + (lineIdx / Math.max(totalLines, 1)) * 82.0)
      );

      matches.forEach((fieldMatch, mIdx) => {
        if (fieldMatch.confidence < minConfidence) return;

        // Determine horizontal span for this field
        const nextMatch = matches[mIdx + 1];
        const startFraction = fieldMatch.endIndex / lineLength;
        const endFraction = nextMatch ? nextMatch.startIndex / lineLength : 1.0;

        // Check if rich page items provide exact coordinates
        let leftPct: number;
        let widthPct: number;
        let topPct: number = Number(estimatedTopPct.toFixed(1));
        let heightPct = fieldMatch.fieldType === 'signature' ? 5.5 : 3.5;

        const matchedItem = pageItems?.find((it: ExtractedTextItem) => {
          const itemLower = it.str.toLowerCase();
          const targetLower = fieldMatch.rawKeyword.toLowerCase();
          return itemLower.includes(targetLower) && Math.abs(it.topPct - estimatedTopPct) < 5.0;
        });

        if (matchedItem) {
          leftPct = Number((matchedItem.leftPct + matchedItem.widthPct + 1.2).toFixed(1));
          topPct = Number((matchedItem.topPct - 0.2).toFixed(1));

          // Next item on same line or default width
          const nextItem = pageItems?.find(
            (it: ExtractedTextItem) =>
              it.leftPct > leftPct && Math.abs(it.topPct - matchedItem.topPct) < 2.0
          );

          if (nextItem) {
            const gap = nextItem.leftPct - leftPct - 1.5;
            widthPct = Number(Math.max(8, Math.min(gap, 45)).toFixed(1));
          } else {
            const maxAvailable = 96 - leftPct;
            const defaultW = fieldMatch.fieldType === 'signature' ? 32 : fieldMatch.fieldType === 'date' ? 18 : 26;
            widthPct = Number(Math.min(defaultW, maxAvailable).toFixed(1));
          }
        } else {
          // Geometry derived from text column layout
          const lineLeft = 10.0;
          const lineRight = 92.0;
          const totalWidth = lineRight - lineLeft;

          leftPct = Number((lineLeft + startFraction * totalWidth).toFixed(1));
          const calculatedWidth = (endFraction - startFraction) * totalWidth * 0.85;

          const defaultWidth =
            fieldMatch.fieldType === 'signature'
              ? 30.0
              : fieldMatch.fieldType === 'date'
              ? 18.0
              : fieldMatch.fieldType === 'initials'
              ? 12.0
              : 24.0;

          widthPct = Number(
            Math.max(8.0, Math.min(defaultWidth, calculatedWidth, 96 - leftPct)).toFixed(1)
          );
        }

        // Clamp boundaries strictly within [0, 100]%
        leftPct = Math.max(0, Math.min(94, leftPct));
        topPct = Math.max(0, Math.min(94, topPct));
        widthPct = Math.max(4, Math.min(100 - leftPct, widthPct));
        heightPct = Math.max(2.5, Math.min(100 - topPct, heightPct));

        const fieldId = `ai_field_${pageNumber}_${fieldCounter++}_${fieldMatch.fieldType}`;

        const role: RecipientRole =
          fieldMatch.cleanLabel.toLowerCase().includes('counter') ||
          fieldMatch.cleanLabel.toLowerCase().includes('provider')
            ? 'countersigner'
            : defaultRole;

        const candidate = AiFieldSuggestionSchema.parse({
          id: fieldId,
          pageNumber,
          fieldType: fieldMatch.fieldType,
          label: fieldMatch.cleanLabel,
          recipientRole: role,
          confidence: fieldMatch.confidence,
          leftPct,
          topPct,
          widthPct,
          heightPct,
          sourceExcerpt: line.trim(),
          accepted: false,
        });

        suggestions.push(candidate);
      });
    });
  });

  return suggestions;
}
