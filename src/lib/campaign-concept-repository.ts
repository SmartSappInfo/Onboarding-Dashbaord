import { adminDb } from './firebase-admin';
import {
  type CampaignConcept,
  type ObjectionBattlecard,
  CAMPAIGN_CONCEPTS_COLLECTION,
  OBJECTION_BATTLECARDS_COLLECTION,
} from './quick-notes-types';

/**
 * Multi-tenant Firestore Repository for Campaign Concepts & Objection Battlecards (Phase 8).
 *
 * Enforces workspace isolation, multi-tenant scoping, and safe batching <= 450 documents.
 */
export class CampaignConceptRepository {
  private static readonly MAX_BATCH_SIZE = 450;

  /* --------------------------------------------------------------------------
   * CAMPAIGN CONCEPTS
   * -------------------------------------------------------------------------- */

  /**
   * Creates a new Campaign Concept in the workspace.
   */
  static async createConcept(
    concept: Omit<CampaignConcept, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<CampaignConcept> {
    const colRef = adminDb.collection(CAMPAIGN_CONCEPTS_COLLECTION);
    const docRef = colRef.doc();
    const now = new Date().toISOString();

    const record: CampaignConcept = {
      ...concept,
      id: docRef.id,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(record);
    return record;
  }

  /**
   * Fetches a Campaign Concept by ID.
   */
  static async getById(conceptId: string): Promise<CampaignConcept | null> {
    const docRef = adminDb.collection(CAMPAIGN_CONCEPTS_COLLECTION).doc(conceptId);
    const snap = await docRef.get();
    if (!snap.exists) return null;
    return snap.data() as CampaignConcept;
  }

  /**
   * Fetches all Campaign Concepts for a workspace.
   */
  static async getByWorkspace(workspaceId: string): Promise<CampaignConcept[]> {
    const snap = await adminDb
      .collection(CAMPAIGN_CONCEPTS_COLLECTION)
      .where('workspaceId', '==', workspaceId)
      .get();

    return snap.docs.map((d) => d.data() as CampaignConcept);
  }

  /**
   * Updates a Campaign Concept with partial data.
   */
  static async updateConcept(
    conceptId: string,
    patch: Partial<Omit<CampaignConcept, 'id' | 'workspaceId' | 'createdAt'>>
  ): Promise<CampaignConcept> {
    const docRef = adminDb.collection(CAMPAIGN_CONCEPTS_COLLECTION).doc(conceptId);
    const now = new Date().toISOString();

    const updatePayload = {
      ...patch,
      updatedAt: now,
    };

    await docRef.set(updatePayload, { merge: true });
    const updatedSnap = await docRef.get();
    return updatedSnap.data() as CampaignConcept;
  }

  /**
   * Deletes a Campaign Concept by ID.
   */
  static async deleteConcept(conceptId: string): Promise<void> {
    await adminDb.collection(CAMPAIGN_CONCEPTS_COLLECTION).doc(conceptId).delete();
  }

  /* --------------------------------------------------------------------------
   * OBJECTION BATTLECARDS
   * -------------------------------------------------------------------------- */

  /**
   * Creates or updates a single Objection Battlecard.
   */
  static async saveBattlecard(
    battlecard: Omit<ObjectionBattlecard, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): Promise<ObjectionBattlecard> {
    const colRef = adminDb.collection(OBJECTION_BATTLECARDS_COLLECTION);
    const docRef = battlecard.id ? colRef.doc(battlecard.id) : colRef.doc();
    const now = new Date().toISOString();

    const record: ObjectionBattlecard = {
      ...battlecard,
      id: docRef.id,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(record, { merge: true });
    return record;
  }

  /**
   * Batch saves multiple Objection Battlecards with safe commit sizing (<= 450).
   */
  static async batchSaveBattlecards(
    workspaceId: string,
    battlecards: Array<Omit<ObjectionBattlecard, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }>
  ): Promise<number> {
    if (battlecards.length === 0) return 0;

    const colRef = adminDb.collection(OBJECTION_BATTLECARDS_COLLECTION);
    const now = new Date().toISOString();
    let savedCount = 0;

    for (let i = 0; i < battlecards.length; i += this.MAX_BATCH_SIZE) {
      const chunk = battlecards.slice(i, i + this.MAX_BATCH_SIZE);
      const batch = adminDb.batch();

      for (const card of chunk) {
        const docRef = card.id ? colRef.doc(card.id) : colRef.doc();
        const fullCard: ObjectionBattlecard = {
          ...card,
          id: docRef.id,
          workspaceId,
          createdAt: now,
          updatedAt: now,
        };
        batch.set(docRef, fullCard, { merge: true });
        savedCount += 1;
      }

      await batch.commit();
    }

    return savedCount;
  }

  /**
   * Fetches all Objection Battlecards for a workspace.
   */
  static async getBattlecardsByWorkspace(workspaceId: string): Promise<ObjectionBattlecard[]> {
    const snap = await adminDb
      .collection(OBJECTION_BATTLECARDS_COLLECTION)
      .where('workspaceId', '==', workspaceId)
      .get();

    return snap.docs.map((d) => d.data() as ObjectionBattlecard);
  }

  /**
   * Deletes an Objection Battlecard by ID.
   */
  static async deleteBattlecard(battlecardId: string): Promise<void> {
    await adminDb.collection(OBJECTION_BATTLECARDS_COLLECTION).doc(battlecardId).delete();
  }
}
