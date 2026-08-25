'use server';

/**
 * @fileoverview Server Actions for Smart Routing Forms and Lead Qualification.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Routing form evaluations run server-side using pure routing service.
 * - Submissions are recorded immutably in `routing_submissions`.
 * - Auto-tags route through standard Contact CRM tag handlers.
 * - Zero 'any' policy strictly enforced.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { RoutingForm, RoutingSubmission, RoutingEvaluationResult } from '@/lib/meetings/types/routing';
import { evaluateRoutingRules } from '@/lib/meetings/routing-service';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

/**
 * Lists all routing forms for a workspace.
 */
export async function getRoutingFormsAction(
  workspaceId: string
): Promise<{ success: boolean; forms?: RoutingForm[]; error?: string }> {
  try {
    const snap = await adminDb
      .collection('routing_forms')
      .where('workspaceId', '==', workspaceId)
      .get();

    const forms: RoutingForm[] = snap.docs.map(doc => ({
      ...(doc.data() as RoutingForm),
      id: doc.id,
    }));

    return { success: true, forms };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Fetches a single routing form by its public slug.
 */
export async function getRoutingFormBySlugAction(
  slug: string
): Promise<{ success: boolean; form?: RoutingForm; error?: string }> {
  try {
    const snap = await adminDb
      .collection('routing_forms')
      .where('slug', '==', slug)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    if (snap.empty) {
      return { success: false, error: 'Routing form not found.' };
    }

    const form = {
      ...(snap.docs[0].data() as RoutingForm),
      id: snap.docs[0].id,
    };

    return { success: true, form };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Creates or updates a routing form.
 */
export async function createOrUpdateRoutingFormAction(
  payload: Partial<RoutingForm> & { workspaceId: string; name: string; slug: string }
): Promise<{ success: boolean; formId?: string; error?: string }> {
  try {
    const now = new Date().toISOString();

    // Check slug uniqueness within workspace
    const existingSnap = await adminDb
      .collection('routing_forms')
      .where('workspaceId', '==', payload.workspaceId)
      .where('slug', '==', payload.slug)
      .get();

    if (payload.id) {
      // Update
      const docRef = adminDb.collection('routing_forms').doc(payload.id);
      const existing = await docRef.get();
      if (!existing.exists) {
        throw new Error('Routing form not found.');
      }

      await docRef.update({
        name: payload.name,
        slug: payload.slug,
        description: payload.description || '',
        headline: payload.headline || '',
        subheadline: payload.subheadline || '',
        fields: payload.fields || [],
        rules: payload.rules || [],
        fallbackDestination: payload.fallbackDestination || { type: 'message', messageTitle: 'Thank you', messageBody: 'We will be in touch shortly.' },
        autoTagIds: payload.autoTagIds || [],
        status: payload.status || 'active',
        updatedAt: now,
      });

      return { success: true, formId: payload.id };
    } else {
      // Create
      if (!existingSnap.empty) {
        throw new Error(`A routing form with slug "${payload.slug}" already exists in this workspace.`);
      }

      const docRef = adminDb.collection('routing_forms').doc();
      const newForm: RoutingForm = {
        id: docRef.id,
        workspaceId: payload.workspaceId,
        organizationId: payload.organizationId,
        name: payload.name,
        slug: payload.slug,
        description: payload.description || '',
        headline: payload.headline || '',
        subheadline: payload.subheadline || '',
        fields: payload.fields || [],
        rules: payload.rules || [],
        fallbackDestination: payload.fallbackDestination || { type: 'message', messageTitle: 'Thank you', messageBody: 'We will be in touch shortly.' },
        autoTagIds: payload.autoTagIds || [],
        status: 'active',
        totalSubmissions: 0,
        createdAt: now,
        updatedAt: now,
      };

      await docRef.set(newForm);
      return { success: true, formId: docRef.id };
    }
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Deletes a routing form.
 */
export async function deleteRoutingFormAction(
  formId: string,
  workspaceId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = adminDb.collection('routing_forms').doc(formId);
    const snap = await docRef.get();

    if (!snap.exists) {
      throw new Error('Routing form not found.');
    }

    const data = snap.data() as RoutingForm;
    if (data.workspaceId !== workspaceId) {
      throw new Error('Unauthorized workspace access.');
    }

    await docRef.delete();
    return { success: true };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Submits a public routing form, evaluates the matching destination rule,
 * saves the submission record, and returns the evaluation result for redirection.
 */
export async function submitRoutingFormAction(
  formSlug: string,
  answers: Record<string, string | number | boolean | string[]>
): Promise<{ success: boolean; result?: RoutingEvaluationResult; redirectUrl?: string; error?: string }> {
  try {
    const formRes = await getRoutingFormBySlugAction(formSlug);
    if (!formRes.success || !formRes.form) {
      throw new Error(formRes.error || 'Routing form not found.');
    }

    const form = formRes.form;
    const now = new Date().toISOString();

    // Pure evaluation of rules
    const evalResult = evaluateRoutingRules(
      answers,
      form.rules || [],
      form.fallbackDestination,
      form.autoTagIds || []
    );

    // Save submission record
    const submissionRef = adminDb.collection('routing_submissions').doc();
    const submission: RoutingSubmission = {
      id: submissionRef.id,
      formId: form.id,
      formName: form.name,
      workspaceId: form.workspaceId,
      organizationId: form.organizationId,
      answers,
      evaluatedDestination: evalResult.destination,
      matchedRuleId: evalResult.matchedRule?.id,
      matchedRuleName: evalResult.matchedRule?.name,
      submittedAt: now,
    };

    await submissionRef.set(submission);

    // Increment submission count
    await adminDb.collection('routing_forms').doc(form.id).update({
      totalSubmissions: (form.totalSubmissions || 0) + 1,
      updatedAt: now,
    });

    // Compute redirect URL if applicable
    let redirectUrl: string | undefined;
    if (evalResult.destination.type === 'event_type') {
      let slug = evalResult.destination.eventTypeSlug;
      if (!slug && evalResult.destination.eventTypeId) {
        const etSnap = await adminDb.collection('event_types').doc(evalResult.destination.eventTypeId).get();
        if (etSnap.exists) {
          slug = (etSnap.data() as { slug?: string }).slug;
        }
      }
      if (slug) {
        redirectUrl = `/book/${slug}`;
      }
    } else if (evalResult.destination.type === 'custom_url' && evalResult.destination.url) {
      redirectUrl = evalResult.destination.url;
    }

    return {
      success: true,
      result: evalResult,
      redirectUrl,
    };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}
