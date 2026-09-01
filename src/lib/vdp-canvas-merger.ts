/**
 * @fileoverview Variable Data Printing (VDP) Canvas Merger
 * Dynamically merges individual contact/record tokens into QR poster canvas layouts
 * strictly through FieldsVariablesService token resolution.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Direct regex replacement is strictly prohibited by .agents/AGENTS.md.
 * - All variable parsing delegates to FieldsVariablesService or resolveTextWithMap.
 * - Zero `any` or `any[]` typing.
 */

import type { CanvasState, CanvasElement } from '@/app/admin/qr-studio/components/designer/canvas-types';
import { resolveTextWithMap } from '@/lib/utils/variable-replacer';

export interface VDPRecordData {
  id: string;
  name: string;
  qrDestinationUrl: string;
  attributes: Record<string, string>;
}

export interface MergedVDPCanvas {
  recordId: string;
  recordName: string;
  canvas: CanvasState;
}

/**
 * Merges an array of batch records with a master QR Canvas poster template.
 * Interpolates text element tokens (e.g. {{name}}, {{student_id}}, {{class}}, {{event_title}})
 * into customized canvas configurations ready for batch rendering.
 */
export function mergeVDPCanvasBatch(
  masterCanvas: CanvasState,
  records: VDPRecordData[]
): MergedVDPCanvas[] {
  return records.map((record) => {
    // Build context dictionary map for canonical resolver
    const variableMap = new Map<string, string>();
    variableMap.set('name', record.name);
    variableMap.set('id', record.id);
    variableMap.set('qr_url', record.qrDestinationUrl);

    // Merge custom record attributes (e.g. class, seat, tier, role, student_id)
    Object.entries(record.attributes).forEach(([key, val]) => {
      variableMap.set(key, String(val ?? ''));
      // Support lowercase/slugified aliases
      variableMap.set(key.toLowerCase().replace(/[\s-]/g, '_'), String(val ?? ''));
    });

    const personalizedElements: CanvasElement[] = masterCanvas.elements.map((el: CanvasElement) => {
      if (el.type === 'text' && el.text) {
        // Delegate tag parsing to standardized variable replacer
        const resolvedText = resolveTextWithMap(el.text, variableMap);
        return {
          ...el,
          text: resolvedText,
        };
      }
      return { ...el };
    });

    return {
      recordId: record.id,
      recordName: record.name,
      canvas: {
        ...masterCanvas,
        elements: personalizedElements,
      },
    };
  });
}
