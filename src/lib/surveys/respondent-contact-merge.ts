/**
 * @fileOverview Merging a respondent's contact details into an entity's contact list.
 *
 * WHY THIS IS NOT IN survey-actions.ts
 * That file is a 'use server' module, so every export there must be async AND becomes a
 * publicly callable HTTP endpoint. This is a pure, synchronous function over data that is
 * already in hand — it touches nothing and needs no authentication, so exposing it as an
 * endpoint would add attack surface for nothing. `next build` rejects a sync export from a
 * 'use server' file, which is what caught this; note that tsc and the unit tests did not.
 */
import type { EntityContact, ExistingEntityCorePolicy } from '@/lib/types';

/**
 * Merge a respondent's contact details into an entity's existing contact list.
 *
 * Extracted because this ran as two hand-copied blocks (matched-entity and duplicate-fallback)
 * that had already drifted apart in their isPrimary handling; the preserve option would have
 * had to be implemented twice and would eventually have been implemented differently.
 *
 * Under 'preserve' a MATCHED contact is returned untouched — that is the overwrite the author
 * asked us not to perform. A genuinely new contact is still appended, because adding someone
 * who was not on the record is not an overwrite.
 */
export function mergeRespondentContact(
  existingContacts: EntityContact[],
  incoming: {
    name: string;
    email: string;
    phone: string;
    typeKey: string;
    typeLabel: string;
    isManualNameInput: boolean;
    fallbackName: string;
  },
  options: { corePolicy?: ExistingEntityCorePolicy; firstIsPrimary: boolean }
): EntityContact[] {
  const merged = [...existingContacts];
  const preserve = options.corePolicy === 'preserve';

  for (let i = 0; i < merged.length; i++) {
    const ec = merged[i];
    const emailMatch = incoming.email && ec.email && ec.email.toLowerCase().trim() === incoming.email;
    const phoneMatch = incoming.phone && ec.phone && ec.phone.trim() === incoming.phone;

    if (emailMatch || phoneMatch) {
      if (preserve) return merged;
      merged[i] = {
        ...ec,
        name: incoming.isManualNameInput
          ? (incoming.name || ec.name || incoming.fallbackName)
          : (ec.name || incoming.name || incoming.fallbackName),
        email: incoming.email || ec.email || '',
        phone: incoming.phone || ec.phone || '',
      };
      return merged;
    }
  }

  merged.push({
    id: `ec_${crypto.randomUUID().substring(0, 8)}`,
    name: incoming.name || incoming.fallbackName,
    email: incoming.email,
    phone: incoming.phone,
    isPrimary: options.firstIsPrimary && merged.length === 0,
    isSignatory: false,
    typeKey: incoming.typeKey,
    typeLabel: incoming.typeLabel,
    order: merged.length,
    updatedAt: new Date().toISOString(),
  } as EntityContact);

  return merged;
}
