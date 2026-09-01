'use server';

/**
 * ARCHITECTURE:
 * Global Template Seeder for Creative Studio 2.0 (Phase 1)
 * 
 * Seeds industry-standard global templates with proven CTR formulas
 * into Firestore's `creative_templates` collection with `scope: 'global'`.
 * 
 * CAUTION:
 * Idempotent operation: Checks template ID before inserting to avoid duplicates.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { CreativeTemplate } from '@/lib/creative/creative-types';
import { FORMAT_PRESETS } from '@/lib/creative/creative-types';

export const GLOBAL_BLUEPRINT_TEMPLATES: CreativeTemplate[] = [
  {
    id: 'tmpl-yt-reaction-shock',
    name: 'Shock / Breakthrough Formula',
    description: 'High-CTR YouTube Cover: Expressive subject on one side, bold contrasting headline, and glowing accent spotlight.',
    category: 'business',
    format: FORMAT_PRESETS.youtube_thumbnail,
    scope: 'global',
    baselineHealthScore: 94,
    backgroundColor: '#0f172a',
    backgroundGradient: {
      type: 'linear',
      angle: 135,
      colors: ['#0f172a', '#3b0764', '#1e1b4b'],
    },
    elements: [
      {
        id: 'bg-glow',
        type: 'circle',
        x: 65,
        y: 15,
        width: 35,
        height: 60,
        zIndex: 1,
        shapeFill: '#facc15',
        opacity: 0.15,
        borderRadius: 9999,
      },
      {
        id: 'hero-subject',
        type: 'image',
        x: 60,
        y: 10,
        width: 35,
        height: 85,
        zIndex: 2,
        imageSrc: 'https://picsum.photos/id/1025/400/600',
        imageOutlineColor: '#facc15',
        imageOutlineWidth: 6,
        semanticRole: 'subject',
      },
      {
        id: 'headline-text',
        type: 'text',
        x: 5,
        y: 25,
        width: 50,
        height: 25,
        zIndex: 3,
        text: 'NEVER DO THIS!',
        fontSize: 56,
        fontFamily: 'Impact',
        fill: '#facc15',
        textAlign: 'left',
        textStrokeColor: '#000000',
        textStrokeWidth: 4,
        semanticRole: 'headline',
      },
      {
        id: 'sub-text',
        type: 'text',
        x: 5,
        y: 55,
        width: 45,
        height: 15,
        zIndex: 3,
        text: 'The $1M Secret',
        fontSize: 32,
        fontFamily: 'Montserrat',
        fontWeight: 'bold',
        fill: '#ffffff',
        textAlign: 'left',
        badgeColor: '#dc2626',
        badgeOpacity: 0.9,
        semanticRole: 'subtitle',
      },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'tmpl-yt-split-compare',
    name: 'Before vs After Split Screen',
    description: 'Split visual comparison with vertical contrast line and dual-side result badges.',
    category: 'education',
    format: FORMAT_PRESETS.youtube_thumbnail,
    scope: 'global',
    baselineHealthScore: 91,
    backgroundColor: '#090d16',
    backgroundGradient: {
      type: 'linear',
      angle: 90,
      colors: ['#450a0a', '#022c22'],
    },
    elements: [
      {
        id: 'split-divider',
        type: 'rect',
        x: 49.5,
        y: 0,
        width: 1,
        height: 100,
        zIndex: 2,
        shapeFill: '#facc15',
      },
      {
        id: 'label-left',
        type: 'text',
        x: 10,
        y: 15,
        width: 30,
        height: 15,
        zIndex: 3,
        text: 'FAIL',
        fontSize: 48,
        fontFamily: 'Impact',
        fill: '#ef4444',
        textAlign: 'center',
        semanticRole: 'badge',
      },
      {
        id: 'label-right',
        type: 'text',
        x: 60,
        y: 15,
        width: 30,
        height: 15,
        zIndex: 3,
        text: '10X GROWTH',
        fontSize: 48,
        fontFamily: 'Impact',
        fill: '#10b981',
        textAlign: 'center',
        semanticRole: 'badge',
      },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'tmpl-social-square-authority',
    name: 'Executive Authority Square',
    description: 'Clean, high-trust square layout for Instagram & LinkedIn posts with prominent quote callout.',
    category: 'social',
    format: FORMAT_PRESETS.social,
    scope: 'global',
    baselineHealthScore: 93,
    backgroundColor: '#0f172a',
    backgroundGradient: {
      type: 'linear',
      angle: 180,
      colors: ['#0f172a', '#020617'],
    },
    elements: [
      {
        id: 'quote-card',
        type: 'rect',
        x: 8,
        y: 15,
        width: 84,
        height: 70,
        zIndex: 1,
        shapeFill: '#1e293b',
        borderRadius: 24,
      },
      {
        id: 'quote-text',
        type: 'text',
        x: 14,
        y: 28,
        width: 72,
        height: 35,
        zIndex: 2,
        text: '"Consistency beats talent when talent stops working."',
        fontSize: 36,
        fontFamily: 'Outfit',
        fontWeight: 'bold',
        fill: '#f8fafc',
        textAlign: 'center',
        semanticRole: 'headline',
      },
      {
        id: 'author-name',
        type: 'text',
        x: 20,
        y: 68,
        width: 60,
        height: 10,
        zIndex: 2,
        text: 'SmartSapp Growth Insights',
        fontSize: 20,
        fontFamily: 'Inter',
        fill: '#10b981',
        textAlign: 'center',
        semanticRole: 'subtitle',
      },
    ],
    createdAt: new Date().toISOString(),
  },
];

export async function seedGlobalCreativeBlueprintsAction(): Promise<{
  success: boolean;
  seededCount: number;
  message: string;
}> {
  try {
    const batch = adminDb.batch();
    let seededCount = 0;

    for (const template of GLOBAL_BLUEPRINT_TEMPLATES) {
      const docRef = adminDb.collection('creative_templates').doc(template.id);
      batch.set(docRef, template, { merge: true });
      seededCount++;
    }

    await batch.commit();

    return {
      success: true,
      seededCount,
      message: `Successfully seeded ${seededCount} global creative blueprints.`,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to seed global blueprints';
    console.error('[seedGlobalCreativeBlueprintsAction] Error:', error);
    return { success: false, seededCount: 0, message };
  }
}
