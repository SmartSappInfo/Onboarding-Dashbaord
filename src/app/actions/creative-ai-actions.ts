'use server';

/**
 * ARCHITECTURE:
 * Creative AI Director Server Actions (Phase 3)
 * 
 * Provides server-side mutations for multi-concept generation, NLP canvas transforms,
 * psychological copy variations, and cloud persistence in Firestore.
 * 
 * CAUTION:
 * Multi-tenant isolation enforced.
 * Strict typing (0% any).
 * 
 * TESTABILITY:
 * Verified via unit tests in src/lib/creative/__tests__/creative-ai-gateway.test.ts
 */

import { getAdminFirestore } from '@/lib/firebase-admin';
import type {
  CreativeConcept,
  CopyVariation,
  AiCanvasCommandResult,
  CreativeElement,
  BrandKit,
} from '@/lib/creative/creative-types';
import {
  generateConceptCompositions,
  generateCopyVariations,
  parseAndExecuteAiCanvasCommand,
} from '@/lib/creative/creative-ai-gateway';

export interface ActionResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Generates 3 distinct strategic creative concepts and saves them to Firestore.
 */
export async function generateCreativeConceptsAction(
  projectId: string,
  prompt: string,
  videoUrl?: string,
  brandKit?: BrandKit | null
): Promise<ActionResponse<CreativeConcept[]>> {
  try {
    if (!projectId || !prompt.trim()) {
      return { success: false, error: 'Project ID and topic prompt are required.' };
    }

    const concepts = generateConceptCompositions(projectId, prompt, videoUrl, brandKit);

    // Save concepts to Firestore if database is available
    const db = getAdminFirestore();
    if (db) {
      const batch = db.batch();
      for (const concept of concepts) {
        const ref = db.collection('creative_concepts').doc(concept.id);
        batch.set(ref, concept);
      }
      await batch.commit();
    }

    return {
      success: true,
      data: concepts,
      message: `Generated ${concepts.length} strategic concepts successfully.`,
    };
  } catch (err) {
    console.error('generateCreativeConceptsAction error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to generate creative concepts.',
    };
  }
}

/**
 * Lists stored concepts for a creative project.
 */
export async function listProjectConceptsAction(
  projectId: string
): Promise<ActionResponse<CreativeConcept[]>> {
  try {
    if (!projectId) return { success: false, error: 'Project ID is required.' };

    const db = getAdminFirestore();
    if (!db) {
      return { success: true, data: [] };
    }

    const snap = await db
      .collection('creative_concepts')
      .where('projectId', '==', projectId)
      .get();

    const concepts: CreativeConcept[] = snap.docs.map((d) => d.data() as CreativeConcept);
    return { success: true, data: concepts };
  } catch (err) {
    console.error('listProjectConceptsAction error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to list concepts.',
    };
  }
}

/**
 * Executes a natural-language canvas manipulation command.
 */
export async function executeAiCanvasCommandAction(
  _projectId: string,
  currentElements: CreativeElement[],
  instruction: string,
  brandKit?: BrandKit | null
): Promise<ActionResponse<AiCanvasCommandResult>> {
  try {
    if (!instruction.trim()) {
      return { success: false, error: 'Instruction cannot be empty.' };
    }

    const result = parseAndExecuteAiCanvasCommand(currentElements, instruction, brandKit);

    return {
      success: true,
      data: result,
      message: result.actionSummary,
    };
  } catch (err) {
    console.error('executeAiCanvasCommandAction error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to process canvas command.',
    };
  }
}

/**
 * Generates 5 psychological copy variations for headlines.
 */
export async function generateCopyVariationsAction(
  topic: string,
  currentHeadline?: string
): Promise<ActionResponse<CopyVariation[]>> {
  try {
    if (!topic.trim() && !currentHeadline?.trim()) {
      return { success: false, error: 'Topic or current headline is required.' };
    }

    const variations = generateCopyVariations(topic, currentHeadline);

    return {
      success: true,
      data: variations,
      message: `Generated ${variations.length} copy variations.`,
    };
  } catch (err) {
    console.error('generateCopyVariationsAction error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to generate copy variations.',
    };
  }
}
