/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Authoritative In-Editor AI Field Detection & OCR Geometry Engine (P5.1).
 * 2. Invariants Maintained:
 *    - Normalized Percentage Coordinates (FM-P5-05): Strictly bounds all coordinates
 *      (leftPct, topPct, widthPct, heightPct) within [0, 100]. Prevents DPI and canvas drift.
 *    - Multi-Signer Differentiation: Maps detected signature blocks to recipient roles
 *      ('signer', 'countersigner').
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

export interface DetectTemplateFieldsOptions {
  minConfidence?: number;
  defaultRole?: RecipientRole;
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
 * Scans page text streams and extracts candidate signature, name, date, and text fields
 * with normalized percentage coordinates for visual template editing.
 */
export function detectTemplateFieldsFromPages(
  pageTexts: string[],
  options?: DetectTemplateFieldsOptions
): AiFieldSuggestion[] {
  const minConfidence = options?.minConfidence ?? 0.7;
  const suggestions: AiFieldSuggestion[] = [];

  pageTexts.forEach((pageText, pageIdx) => {
    if (!pageText || pageText.trim().length === 0) return;

    const pageNumber = pageIdx + 1;
    const lower = pageText.toLowerCase();

    // Check if page contains execution or signature markers
    const hasExecutionMarker =
      lower.includes('in witness whereof') ||
      lower.includes('signature') ||
      lower.includes('by:') ||
      lower.includes('authorized signature') ||
      lower.includes('signed by') ||
      lower.includes('client / customer') ||
      lower.includes('service provider');

    if (!hasExecutionMarker) {
      return;
    }

    const rawLines = pageText.split('\n').map((l) => l.trim()).filter(Boolean);
    const totalLines = rawLines.length;

    // Detect distinct signature blocks / parties
    const blocks: DetectedBlock[] = [];

    let currentPartyIdx = 0;
    let blockLines: Array<{ lineText: string; lineIndex: number }> = [];
    let currentLabel = '';

    rawLines.forEach((line, lineIdx) => {
      const lineLower = line.toLowerCase();

      const isPartyHeader =
        lineLower.includes('client') ||
        lineLower.includes('customer') ||
        lineLower.includes('party a') ||
        lineLower.includes('service provider') ||
        lineLower.includes('contractor') ||
        lineLower.includes('party b') ||
        lineLower.includes('vendor') ||
        lineLower.includes('company');

      if (isPartyHeader) {
        if (blockLines.length > 0 && currentLabel) {
          blocks.push({
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
      blocks.push({
        partyIndex: currentPartyIdx,
        partyLabel: currentLabel,
        role: currentPartyIdx === 0 ? 'signer' : 'countersigner',
        leftPct: currentPartyIdx === 0 ? 10.0 : 52.0,
        widthPct: 38.0,
        baseTopPct: 60.0 + currentPartyIdx * 15.0,
        lines: [...blockLines],
      });
    }

    // If no distinct multi-column blocks found, treat execution area as a single block
    if (blocks.length === 0) {
      blocks.push({
        partyIndex: 0,
        partyLabel: 'Primary Signer',
        role: 'signer',
        leftPct: 15.0,
        widthPct: 40.0,
        baseTopPct: 65.0,
        lines: rawLines.map((l, idx) => ({ lineText: l, lineIndex: idx })),
      });
    }

    // Now scan lines within each block for specific field anchors
    let fieldCounter = 1;

    blocks.forEach((block) => {
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
          // Calculate top percentage based on relative position or block anchor
          const estimatedTopPct = Math.min(
            92.0,
            Math.max(10.0, 50.0 + (lineIndex / totalLines) * 45.0 + relativeOffset)
          );

          const fieldId = `ai_field_${pageNumber}_${fieldCounter++}_${detectedType}`;

          const candidate = AiFieldSuggestionSchema.parse({
            id: fieldId,
            pageNumber,
            fieldType: detectedType,
            label,
            recipientRole: block.role,
            confidence,
            leftPct: block.leftPct,
            topPct: Number(estimatedTopPct.toFixed(1)),
            widthPct: block.widthPct,
            heightPct,
            sourceExcerpt: lineText,
            accepted: false,
          });

          suggestions.push(candidate);
          relativeOffset += 1.5;
        }
      });
    });
  });

  return suggestions;
}
