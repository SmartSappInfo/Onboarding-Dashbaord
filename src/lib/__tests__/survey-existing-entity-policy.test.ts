import { describe, it, expect, vi } from 'vitest';
import { sanitizeEntityPayloadForUpdate } from '@/lib/survey-actions';
// Pure helper, deliberately outside the 'use server' module — see its @fileOverview.
import { mergeRespondentContact } from '@/lib/surveys/respondent-contact-merge';
import type { EntityContact } from '@/lib/types';

/**
 * The survey/form author's choice about an already-known entity's core identity.
 *
 * The promise being tested is narrow and worth stating precisely, because getting it wrong in
 * either direction is bad: under 'preserve' the CRM's IDENTITY must survive the submission,
 * while everything else the respondent gave us must still be written. An option that silently
 * discarded answers would be worse than not having the option.
 */

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async () => ({ uid: 'u1', profile: {} })),
}));

const basePayload = {
  name: 'Typed By Respondent Ltd',
  globalTags: ['tag-a'],
  workspaceTags: ['tag-b'],
  customData: { budget: '5000' },
};

describe("sanitizeEntityPayloadForUpdate — 'preserve'", () => {
  it('keeps the stored entity name, discarding the submitted one', async () => {
    const out = await sanitizeEntityPayloadForUpdate(
      { ...basePayload },
      {
        isExistingEntity: true,
        isExplicitlyMapped: false,
        isManualInput: false,
        existingEntityName: 'Kofi Annan Institute',
        corePolicy: 'preserve',
      },
    );

    expect(out.name).toBeUndefined();
  });

  it('still writes everything that is not identity', async () => {
    const out = await sanitizeEntityPayloadForUpdate(
      { ...basePayload },
      {
        isExistingEntity: true,
        isExplicitlyMapped: false,
        isManualInput: false,
        existingEntityName: 'Kofi Annan Institute',
        corePolicy: 'preserve',
      },
    );

    // The point of the option is "do not rewrite who this is", not "ignore this submission".
    expect(out.customData).toEqual({ budget: '5000' });
    expect(out.globalTags).toEqual(['tag-a']);
    expect(out.workspaceTags).toEqual(['tag-b']);
  });

  it('strips the person name too, since for person entities that IS the entity name', async () => {
    const out = await sanitizeEntityPayloadForUpdate(
      { ...basePayload, personData: { firstName: 'Ama', lastName: 'Mensah', occupation: 'Nurse' } },
      {
        isExistingEntity: true,
        isExplicitlyMapped: false,
        isManualInput: false,
        existingEntityName: 'Ama Owusu',
        corePolicy: 'preserve',
      },
    );

    expect(out.personData).toEqual({ occupation: 'Nurse' });
  });

  it('overrides the generic-name rescue, because the author asked it to', async () => {
    // Without a policy, a junk stored name like "Yes" is deliberately overwritable. An author
    // who chose 'preserve' did not ask us to make exceptions on their behalf.
    const out = await sanitizeEntityPayloadForUpdate(
      { ...basePayload },
      {
        isExistingEntity: true,
        isExplicitlyMapped: true,
        isManualInput: true,
        existingEntityName: 'Yes',
        corePolicy: 'preserve',
      },
    );

    expect(out.name).toBeUndefined();
  });

  it('does nothing to a brand new entity — there is nothing to preserve', async () => {
    const out = await sanitizeEntityPayloadForUpdate(
      { ...basePayload },
      {
        isExistingEntity: false,
        isExplicitlyMapped: false,
        isManualInput: false,
        corePolicy: 'preserve',
      },
    );

    expect(out.name).toBe('Typed By Respondent Ltd');
  });
});

describe("sanitizeEntityPayloadForUpdate — 'update' and the default", () => {
  it('behaves exactly as before when no policy is set', async () => {
    // Regression guard: every survey authored before this option existed passes undefined.
    const withoutPolicy = await sanitizeEntityPayloadForUpdate(
      { ...basePayload },
      {
        isExistingEntity: true,
        isExplicitlyMapped: true,
        isManualInput: true,
        existingEntityName: 'Kofi Annan Institute',
      },
    );
    const withUpdate = await sanitizeEntityPayloadForUpdate(
      { ...basePayload },
      {
        isExistingEntity: true,
        isExplicitlyMapped: true,
        isManualInput: true,
        existingEntityName: 'Kofi Annan Institute',
        corePolicy: 'update',
      },
    );

    expect(withoutPolicy).toEqual(withUpdate);
    expect(withUpdate.name).toBe('Typed By Respondent Ltd');
  });

  it("still guards the name when it was neither mapped nor typed", async () => {
    const out = await sanitizeEntityPayloadForUpdate(
      { ...basePayload },
      {
        isExistingEntity: true,
        isExplicitlyMapped: false,
        isManualInput: false,
        existingEntityName: 'Kofi Annan Institute',
        corePolicy: 'update',
      },
    );

    expect(out.name).toBeUndefined();
  });
});

describe('mergeRespondentContact', () => {
  const existing: EntityContact[] = [
    {
      id: 'ec_1',
      name: 'Original Contact',
      email: 'staff@kofiannan.edu',
      phone: '+233240001111',
      isPrimary: true,
      isSignatory: false,
      typeKey: 'administrator',
      typeLabel: 'Administrator',
      order: 0,
      updatedAt: '2026-01-01T00:00:00Z',
    } as EntityContact,
  ];

  const incoming = {
    name: 'Different Name',
    email: 'staff@kofiannan.edu',
    phone: '+233240009999',
    typeKey: 'administrator',
    typeLabel: 'Administrator',
    isManualNameInput: true,
    fallbackName: 'Fallback',
  };

  it("leaves a matched contact completely untouched under 'preserve'", () => {
    const out = mergeRespondentContact(existing, incoming, {
      corePolicy: 'preserve',
      firstIsPrimary: true,
    });

    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('Original Contact');
    expect(out[0].phone).toBe('+233240001111');
  });

  it("overwrites a matched contact under 'update'", () => {
    const out = mergeRespondentContact(existing, incoming, {
      corePolicy: 'update',
      firstIsPrimary: true,
    });

    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('Different Name');
    expect(out[0].phone).toBe('+233240009999');
  });

  it("still appends a genuinely new contact under 'preserve'", () => {
    // Adding someone who was not on the record is not an overwrite, so it is allowed.
    const out = mergeRespondentContact(
      existing,
      { ...incoming, email: 'newperson@kofiannan.edu', phone: '+233555000111' },
      { corePolicy: 'preserve', firstIsPrimary: true },
    );

    expect(out).toHaveLength(2);
    expect(out[1].email).toBe('newperson@kofiannan.edu');
    expect(out[0].name).toBe('Original Contact');
  });

  it('matches on phone as well as email', () => {
    const out = mergeRespondentContact(
      existing,
      { ...incoming, email: 'someoneelse@x.com', phone: '+233240001111' },
      { corePolicy: 'preserve', firstIsPrimary: true },
    );

    expect(out).toHaveLength(1);
  });

  it('respects firstIsPrimary, which differed between the two original call sites', () => {
    const intoEmpty = mergeRespondentContact([], incoming, {
      corePolicy: 'update',
      firstIsPrimary: true,
    });
    expect(intoEmpty[0].isPrimary).toBe(true);

    const duplicateFallback = mergeRespondentContact([], incoming, {
      corePolicy: 'update',
      firstIsPrimary: false,
    });
    expect(duplicateFallback[0].isPrimary).toBe(false);
  });
});
