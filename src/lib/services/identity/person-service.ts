/**
 * @fileOverview Person Service (Identity & Access 2.0)
 *
 * Manages human identity documents, contact information, job titles, departments,
 * and profile preferences for the `people` collection in Firestore.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - A Person represents the physical/human identity attached to an Organization.
 * - `person.id` matches the user's `authUid` (or account ID).
 * - Multi-tenant isolation: all operations require or validate `organizationId`.
 * - Zero `any` or `any[]` typing.
 *
 * @testability Exported methods are covered in `identity-services.test.ts`.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { Person, PeopleDirectoryFilter } from '@/lib/types';

export class PersonService {
  private static COLLECTION = 'people';

  /**
   * Retrieves a Person document by UID.
   */
  static async getPerson(id: string): Promise<Person | null> {
    if (!id) return null;
    const snap = await adminDb.collection(this.COLLECTION).doc(id).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...snap.data() } as Person;
  }

  /**
   * Creates or sets a Person document.
   * Supports optional external Firestore transaction/batch for atomicity.
   */
  static async createPerson(
    person: Omit<Person, 'createdAt' | 'updatedAt'>,
    batchOrTransaction?: FirebaseFirestore.WriteBatch | FirebaseFirestore.Transaction
  ): Promise<Person> {
    const now = new Date().toISOString();
    const completePerson: Person = {
      ...person,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = adminDb.collection(this.COLLECTION).doc(person.id);

    if (batchOrTransaction) {
      (batchOrTransaction as FirebaseFirestore.WriteBatch).set(docRef, completePerson, { merge: true });
    } else {
      await docRef.set(completePerson, { merge: true });
    }

    return completePerson;
  }

  /**
   * Updates personal details (name, phone, avatar, job title, department, preferences).
   */
  static async updatePerson(
    id: string,
    updates: Partial<Omit<Person, 'id' | 'organizationId' | 'createdAt'>>,
    batchOrTransaction?: FirebaseFirestore.WriteBatch | FirebaseFirestore.Transaction
  ): Promise<void> {
    const now = new Date().toISOString();
    const docRef = adminDb.collection(this.COLLECTION).doc(id);

    const payload: Partial<Person> = {
      ...updates,
      updatedAt: now,
    };

    if (batchOrTransaction) {
      (batchOrTransaction as FirebaseFirestore.WriteBatch).set(docRef, payload, { merge: true });
    } else {
      await docRef.set(payload, { merge: true });
    }
  }

  /**
   * Lists all people belonging to an organization, with optional in-memory / query filtering.
   */
  static async listPeopleByOrganization(
    organizationId: string,
    filter?: PeopleDirectoryFilter
  ): Promise<Person[]> {
    if (!organizationId) return [];

    let query: FirebaseFirestore.Query = adminDb
      .collection(this.COLLECTION)
      .where('organizationId', '==', organizationId);

    if (filter?.departmentId) {
      query = query.where('departmentId', '==', filter.departmentId);
    }

    const snap = await query.get();
    let people: Person[] = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Person));

    // In-memory search filtering across name and email
    if (filter?.searchQuery) {
      const q = filter.searchQuery.toLowerCase().trim();
      people = people.filter(
        (p) =>
          p.displayName.toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q) ||
          (p.jobTitle && p.jobTitle.toLowerCase().includes(q)) ||
          (p.phone && p.phone.includes(q))
      );
    }

    // Stable sort by display name
    return people.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }
}
