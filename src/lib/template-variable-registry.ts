'use server';

import { adminDb } from './firebase-admin';
import type { TemplateVariable } from './types';
import { STATIC_VARIABLES } from './template-variable-registry-data';

// ---------------------------------------------------------------------------
// Minimal input types for dynamic variable registration
// ---------------------------------------------------------------------------

export interface FormField {
  id: string;
  label: string;
  type?: string;
}

export interface SurveyElement {
  id: string;
  title?: string;
  name?: string;
  type?: string;
}

// Re-export STATIC_VARIABLES for backward compatibility
export { STATIC_VARIABLES };

// ---------------------------------------------------------------------------
// registerFormVariables
// ---------------------------------------------------------------------------

/**
 * Writes dynamic form field variables to the `template_variables` Firestore collection.
 * Called when a form is created or its fields are updated.
 */
export async function registerFormVariables(formId: string, fields: FormField[]): Promise<void> {
  const batch = adminDb.batch();

  for (const field of fields) {
    const docRef = adminDb.collection('template_variables').doc(`form_${formId}_${field.id}`);
    const variable: TemplateVariable = {
      id: `form_${formId}_${field.id}`,
      name: `form_fields.${field.id}`,
      label: field.label,
      description: `Form field: ${field.label}`,
      dataType: 'string',
      context: 'form',
      exampleValue: '',
      isDynamic: true,
      sourceFormId: formId,
      sourceFieldId: field.id,
      isComputed: false,
    };
    batch.set(docRef, variable);
  }

  await batch.commit();
}

// ---------------------------------------------------------------------------
// registerSurveyVariables
// ---------------------------------------------------------------------------

/**
 * Writes dynamic survey question variables to the `template_variables` Firestore collection.
 * Called when a survey is created or its elements are updated.
 */
export async function registerSurveyVariables(surveyId: string, elements: SurveyElement[]): Promise<void> {
  const batch = adminDb.batch();

  for (const element of elements) {
    const label = element.title ?? element.name ?? element.id;
    const docRef = adminDb.collection('template_variables').doc(`survey_${surveyId}_${element.id}`);
    const variable: TemplateVariable = {
      id: `survey_${surveyId}_${element.id}`,
      name: `survey_fields.${element.id}`,
      label,
      description: `Survey question: ${label}`,
      dataType: 'string',
      context: 'survey',
      exampleValue: '',
      isDynamic: true,
      sourceFormId: surveyId,
      sourceFieldId: element.id,
      isComputed: false,
    };
    batch.set(docRef, variable);
  }

  await batch.commit();
}

// ---------------------------------------------------------------------------
// getDynamicVariables
// ---------------------------------------------------------------------------

/**
 * Fetches dynamic variables for a specific form or survey from Firestore.
 */
export async function getDynamicVariables(formId: string): Promise<TemplateVariable[]> {
  const snapshot = await adminDb
    .collection('template_variables')
    .where('sourceFormId', '==', formId)
    .where('isDynamic', '==', true)
    .get();

  return snapshot.docs.map((doc) => doc.data() as TemplateVariable);
}
