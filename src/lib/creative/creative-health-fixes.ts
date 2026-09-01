/**
 * ARCHITECTURE:
 * One-Click Creative Health Auto-Fix Engine (Phase 4)
 * 
 * Provides deterministic, non-destructive transformations to resolve diagnostic issues
 * (enlarging headlines, reinforcing contrast strokes, shifting safe-zone collisions,
 * synchronizing brand tokens, and decluttering).
 * 
 * CAUTION:
 * All modifications pass through normalizeCanvasElements and clampCoordinate (0-100%).
 * Strict typing (0% any).
 * 
 * TESTABILITY:
 * Verified via unit tests in src/lib/creative/__tests__/creative-health-engine.test.ts
 */

import type {
  CreativeElement,
  CreativeHealthIssue,
  BrandKit,
} from './creative-types';
import { makeUniqueId } from './creative-types';
import { normalizeCanvasElements, clampCoordinate } from './creative-ai-gateway';

/**
 * Applies a single deterministic fix for a specific Creative Health Issue.
 */
export function applyHealthFix(
  elements: CreativeElement[],
  issue: CreativeHealthIssue,
  brandKit?: BrandKit | null
): CreativeElement[] {
  let updated = [...elements];

  switch (issue.fixActionType) {
    case 'enlarge_headline': {
      let found = false;
      updated = updated.map((el) => {
        if (el.id === issue.targetElementId || el.semanticRole === 'headline' || (el.type === 'text' && (el.fontSize || 0) >= 36)) {
          found = true;
          return {
            ...el,
            fontSize: Math.max(54, (el.fontSize || 40) + 12),
            fontWeight: '900',
            textStrokeWidth: Math.max(2, el.textStrokeWidth || 0),
            textStrokeColor: el.textStrokeColor || '#000000',
          };
        }
        return el;
      });

      // If no headline existed, add a bold default headline
      if (!found) {
        updated.unshift({
          id: makeUniqueId(),
          type: 'text',
          x: 10,
          y: 25,
          width: 80,
          height: 22,
          zIndex: updated.length + 1,
          text: 'BOLD HEADLINE HOOK',
          fontFamily: brandKit?.typography?.displayFont || 'Impact',
          fontSize: 54,
          fontWeight: '900',
          fill: '#facc15',
          textAlign: 'center',
          textStrokeWidth: 3,
          textStrokeColor: '#000000',
          semanticRole: 'headline',
        });
      }
      break;
    }

    case 'fix_contrast': {
      updated = updated.map((el) => {
        if (el.id === issue.targetElementId || el.type === 'text') {
          return {
            ...el,
            textStrokeWidth: 3,
            textStrokeColor: '#000000',
            fill: el.fill === '#000000' ? '#ffffff' : el.fill,
          };
        }
        return el;
      });
      break;
    }

    case 'shift_safe_zone': {
      updated = updated.map((el) => {
        if (el.id === issue.targetElementId || (el.x + el.width >= 78 && el.y + el.height >= 75)) {
          return {
            ...el,
            x: clampCoordinate(el.x - 15, 5, 65),
            y: clampCoordinate(el.y - 15, 5, 65),
          };
        }
        return el;
      });
      break;
    }

    case 'apply_brand_font': {
      const brandFont = brandKit?.typography?.displayFont || 'Impact';
      updated = updated.map((el) => {
        if (el.id === issue.targetElementId || el.semanticRole === 'headline' || el.type === 'text') {
          return {
            ...el,
            fontFamily: brandFont,
          };
        }
        return el;
      });
      break;
    }

    case 'apply_brand_color': {
      const brandColor = brandKit?.colors?.primary?.[0] || '#10b981';
      updated = updated.map((el) => {
        if (el.id === issue.targetElementId || el.type === 'rect' || el.type === 'circle') {
          return {
            ...el,
            shapeFill: brandColor,
            fill: el.type === 'text' ? brandColor : el.fill,
          };
        }
        return el;
      });
      break;
    }

    case 'clean_clutter': {
      // Keep primary subject and headline, prune excess decoration
      updated = updated.filter((el, idx) => {
        if (el.semanticRole === 'headline' || el.semanticRole === 'subject' || el.semanticRole === 'badge') return true;
        return idx < 5;
      });
      break;
    }

    default:
      break;
  }

  return normalizeCanvasElements(updated);
}

/**
 * Executes all recommended fixes in one batch pass.
 */
export function applyImproveAllFixes(
  elements: CreativeElement[],
  issues: CreativeHealthIssue[],
  brandKit?: BrandKit | null
): CreativeElement[] {
  let result = [...elements];
  for (const issue of issues) {
    if (issue.fixActionType) {
      result = applyHealthFix(result, issue, brandKit);
    }
  }
  return normalizeCanvasElements(result);
}
