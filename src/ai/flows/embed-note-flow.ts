import { ai } from '../genkit';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * Quick Notes — text embeddings for semantic search.
 *
 * Uses Google's `text-embedding-004` (768 dimensions). The vector is stored on
 * the `note_index` rows and queried with Firestore `findNearest` (cosine).
 * Server-only (requires a Google AI key on the default Genkit instance).
 *
 * D3 (locked): model `text-embedding-004`, dimension 768 — this MUST match the
 * Firestore vector index created out-of-band (see scripts/NOTE_INDEX_VECTOR_README.md).
 */
export const EMBED_MODEL = 'text-embedding-004';
export const EMBED_DIMENSIONS = 768;

/** Returns the embedding vector for a piece of text, or [] for empty input. */
export async function embedText(text: string): Promise<number[]> {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return [];
  const result = await ai.embed({ embedder: googleAI.embedder(EMBED_MODEL), content: trimmed });
  return result[0]?.embedding ?? [];
}
