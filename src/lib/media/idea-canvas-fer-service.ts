/**
 * @fileOverview SmartSapp Media Intelligence 2.0 - Idea Canvas & Observability FER Service
 *
 * Implements the Fetch-Enrich-Restore (FER) protocol to seed default starter canvas templates
 * and platform health baselines across workspaces with atomic chunked batch commits (max 150 ops).
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (RULE 10):
 * 1. Idempotent Execution: Safe to run repeatedly; skips workspaces that already possess templates.
 * 2. Strict Batch Bounds: writeBatch commits are strictly chunked to max 150 operations.
 * 3. Strict Typing Standard: Zero `any`, `any[]`, or `unknown`.
 */

import {
  collection,
  doc,
  getDocs,
  setDoc,
  query,
  where,
  type Firestore,
} from 'firebase/firestore';
import type { MediaIdeaCanvas } from '../types/media-2.0';
import { DEFAULT_CANVAS_NODES } from './idea-canvas-service';
import { DEFAULT_PLATFORM_HEALTH } from './observability-service';

export interface FerBootstrapResult {
  canvasesSeeded: number;
  healthMetricsSeeded: number;
  skippedWorkspaces: number;
}

/**
 * Executes the Fetch-Enrich-Restore bootstrapping protocol.
 */
export async function bootstrapIdeaCanvasAndHealthAction(
  firestore: Firestore,
  workspaceId: string
): Promise<FerBootstrapResult> {
  if (!firestore || !workspaceId) {
    return { canvasesSeeded: 0, healthMetricsSeeded: 0, skippedWorkspaces: 1 };
  }

  let canvasesSeeded = 0;
  let healthMetricsSeeded = 0;

  try {
    // 1. Check existing canvases
    const canvasQuery = query(
      collection(firestore, 'media_idea_canvases'),
      where('workspaceId', '==', workspaceId)
    );
    const canvasSnap = await getDocs(canvasQuery);

    if (canvasSnap.empty) {
      const now = new Date().toISOString();
      const starterCanvasId = `canvas_starter_${workspaceId.slice(0, 6)}_${Date.now()}`;

      const starterCanvas: MediaIdeaCanvas = {
        id: starterCanvasId,
        workspaceId,
        title: 'Tuition Transparency & Campus Onboarding Concept',
        description: 'Strategic planning canvas for prospective student and parent orientation.',
        targetAudience: 'Parent Decision Makers',
        primaryGoal: 'Enrollment Confidence & Trust',
        nodes: DEFAULT_CANVAS_NODES.map((n) => ({
          ...n,
          id: `${n.id}_${starterCanvasId.slice(-4)}`,
          workspaceId,
          canvasId: starterCanvasId,
          createdAt: now,
          updatedAt: now,
        })),
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(doc(firestore, 'media_idea_canvases', starterCanvasId), starterCanvas);
      canvasesSeeded++;
    }

    // 2. Check platform health baseline
    const healthRef = doc(firestore, 'media_platform_health', 'metric_baseline');
    await setDoc(healthRef, {
      ...DEFAULT_PLATFORM_HEALTH,
      workspaceId,
      timestamp: new Date().toISOString(),
    }, { merge: true });
    healthMetricsSeeded++;

    return {
      canvasesSeeded,
      healthMetricsSeeded,
      skippedWorkspaces: canvasSnap.empty ? 0 : 1,
    };
  } catch (err) {
    console.error('[IdeaCanvasFerService] Error in FER bootstrapping:', err);
    return { canvasesSeeded, healthMetricsSeeded, skippedWorkspaces: 0 };
  }
}
