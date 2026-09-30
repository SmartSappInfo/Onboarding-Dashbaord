/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Client-side PDF text and visual layout geometry extractor (P5.1).
 *    Extracts per-page text content, text lines, and item bounding boxes
 *    normalized to [0, 100]% percentage coordinates for Layout AI field placement.
 * 2. Invariants Maintained:
 *    - Normalized Percentage Coordinates: All item bounding boxes are strictly clamped
 *      within [0, 100]% to prevent canvas drift across zoom levels and DPIs.
 *    - Memory Management: Properly invokes page.cleanup() on extracted pages to prevent
 *      memory leaks during long-running editor sessions.
 *    - Isomorphic Safety: Safely dynamically imports pdfjs-dist only on the client.
 *    - Zero-Tolerance Typing (Rule 4): Strictly 0 `any` or `any[]` throughout.
 */

import type { PDFDocumentProxy } from 'pdfjs-dist';

export interface ExtractedTextItem {
  str: string;
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;
}

export interface ExtractedLineData {
  text: string;
  topPct: number;
  heightPct: number;
  minLeftPct: number;
  maxRightPct: number;
  items: ExtractedTextItem[];
}

export interface ExtractedPageData {
  pageNumber: number;
  text: string;
  lines?: ExtractedLineData[];
  items: ExtractedTextItem[];
}


interface RawPdfItem {
  str?: string;
  dir?: string;
  width?: number;
  height?: number;
  transform?: number[];
}

/**
 * Extracts text and bounding-box geometry from a PDFDocumentProxy or PDF URL.
 */
export async function extractPdfDocumentData(
  source: string | PDFDocumentProxy
): Promise<ExtractedPageData[]> {
  let doc: PDFDocumentProxy;
  const shouldDestroy = typeof source === 'string';

  if (typeof source === 'string') {
    const pdfjs = await import('pdfjs-dist');
    const pdfjsVersion = '4.4.168';
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;

    const loadingTask = pdfjs.getDocument({ url: source });
    doc = await loadingTask.promise;
  } else {
    doc = source;
  }

  try {
    const numPages = doc.numPages;
    const results: ExtractedPageData[] = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    try {
      const viewport = page.getViewport({ scale: 1.0, rotation: page.rotate });
      const pageWidth = viewport.width || 612;
      const pageHeight = viewport.height || 792;

      const textContent = await page.getTextContent();
      const rawItems = (textContent.items || []) as RawPdfItem[];

      const items: ExtractedTextItem[] = [];

      for (const item of rawItems) {
        if (!item.str || item.str.trim().length === 0) continue;

        let leftPct = 10;
        let topPct = 50;
        let widthPct = 20;
        let heightPct = 3;

        if (item.transform && item.transform.length >= 6) {
          const tx = item.transform[4];
          const ty = item.transform[5];

          let vx = tx;
          let vy = pageHeight - ty;

          if (typeof viewport.convertToViewportPoint === 'function') {
            try {
              const pt = viewport.convertToViewportPoint(tx, ty);
              vx = pt[0];
              vy = pt[1];
            } catch {
              vx = tx;
              vy = pageHeight - ty;
            }
          }

          const itemHeight = item.height && item.height > 0 ? item.height : 10;
          const itemWidth =
            item.width && item.width > 0 ? item.width : Math.max(10, item.str.length * 6);

          const top = vy - itemHeight;

          leftPct = Math.max(0, Math.min(100, (vx / pageWidth) * 100));
          topPct = Math.max(0, Math.min(100, (top / pageHeight) * 100));
          widthPct = Math.max(0.5, Math.min(100 - leftPct, (itemWidth / pageWidth) * 100));
          heightPct = Math.max(0.5, Math.min(100 - topPct, (itemHeight / pageHeight) * 100));
        }

        items.push({
          str: item.str,
          leftPct: Number(leftPct.toFixed(2)),
          topPct: Number(topPct.toFixed(2)),
          widthPct: Number(widthPct.toFixed(2)),
          heightPct: Number(heightPct.toFixed(2)),
        });
      }

      // Group items into logical lines based on vertical proximity (~1.2% tolerance)
      const lines: Array<{ topPct: number; items: ExtractedTextItem[] }> = [];

      // Sort items top-to-bottom first
      const sortedByTop = [...items].sort((a, b) => a.topPct - b.topPct);

      for (const item of sortedByTop) {
        let matchingLine = lines.find((l) => Math.abs(l.topPct - item.topPct) <= 1.2);
        if (!matchingLine) {
          matchingLine = { topPct: item.topPct, items: [] };
          lines.push(matchingLine);
        }
        matchingLine.items.push(item);
      }

      // Sort each line left-to-right, calculate accurate line bounding boxes, and construct lines
      const extractedLines: ExtractedLineData[] = [];

      for (const line of lines) {
        line.items.sort((a, b) => a.leftPct - b.leftPct);
        const validItems = line.items.filter((it) => it.str.trim().length > 0);
        if (validItems.length === 0) continue;

        const lineTopPct = Number(
          (validItems.reduce((acc, it) => acc + it.topPct, 0) / validItems.length).toFixed(2)
        );
        const lineMaxHeight = Number(
          Math.max(...validItems.map((it) => it.heightPct)).toFixed(2)
        );
        const minLeftPct = Number(
          Math.min(...validItems.map((it) => it.leftPct)).toFixed(2)
        );
        const maxRightPct = Number(
          Math.max(...validItems.map((it) => it.leftPct + it.widthPct)).toFixed(2)
        );

        const lineText = validItems.map((it) => it.str).join(' ').trim();
        if (lineText.length > 0) {
          extractedLines.push({
            text: lineText,
            topPct: lineTopPct,
            heightPct: lineMaxHeight,
            minLeftPct,
            maxRightPct,
            items: validItems,
          });
        }
      }

      // Sort lines strictly top to bottom
      extractedLines.sort((a, b) => a.topPct - b.topPct);

      const fullText = extractedLines.map((l) => l.text).join('\n');

      results.push({
        pageNumber: pageNum,
        text: fullText,
        lines: extractedLines,
        items,
      });
    } finally {
      if (typeof page.cleanup === 'function') {
        page.cleanup();
      }
    }
  }

  return results;
  } finally {
    if (shouldDestroy && doc) {
      doc.destroy().catch(() => {});
    }
  }
}
