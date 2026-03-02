
'use server';

import { adminDb } from './firebase-admin';
import type { VariableDefinition, Survey, PDFForm, SurveyQuestion } from './types';
import { revalidatePath } from 'next/cache';

/**
 * Synchronizes the Variable Registry by scanning Schools, Meetings, Surveys, and PDFs.
 * This is the central logic for Phase 1 of Variable Management.
 */
export async function syncVariableRegistry() {
  try {
    const variablesCol = adminDb.collection('messaging_variables');
    const batch = adminDb.batch();

    // 1. Static Core Variables (School & Meeting)
    const staticVariables: Omit<VariableDefinition, 'id'>[] = [
      { key: 'school_name', label: 'School Name', category: 'general', source: 'static', entity: 'School', path: 'name', type: 'string' },
      { key: 'school_initials', label: 'School Initials', category: 'general', source: 'static', entity: 'School', path: 'initials', type: 'string' },
      { key: 'school_location', label: 'School Location', category: 'general', source: 'static', entity: 'School', path: 'location', type: 'string' },
      { key: 'school_phone', label: 'School Phone', category: 'general', source: 'static', entity: 'School', path: 'phone', type: 'string' },
      { key: 'school_email', label: 'School Email', category: 'general', source: 'static', entity: 'School', path: 'email', type: 'string' },
      { key: 'meeting_time', label: 'Meeting Time', category: 'meetings', source: 'static', entity: 'Meeting', path: 'meetingTime', type: 'date' },
      { key: 'meeting_link', label: 'Meeting Link', category: 'meetings', source: 'static', entity: 'Meeting', path: 'meetingLink', type: 'string' },
      { key: 'meeting_type', label: 'Meeting Type', category: 'meetings', source: 'static', entity: 'Meeting', path: 'type.name', type: 'string' },
    ];

    staticVariables.forEach(v => {
      const ref = variablesCol.doc(v.key);
      batch.set(ref, v);
    });

    // 2. Dynamic Survey Variables
    const surveysSnap = await adminDb.collection('surveys').where('status', '==', 'published').get();
    surveysSnap.forEach(doc => {
      const survey = doc.data() as Survey;
      const questions = survey.elements.filter((el): el is SurveyQuestion => 'isRequired' in el);
      
      questions.forEach(q => {
        const varId = `survey_${doc.id}_${q.id}`;
        const ref = variablesCol.doc(varId);
        batch.set(ref, {
          key: q.id,
          label: q.title.replace(/<[^>]*>?/gm, ''),
          category: 'surveys',
          source: 'survey',
          sourceId: doc.id,
          sourceName: survey.internalName || survey.title,
          entity: 'SurveyResponse',
          path: q.id,
          type: 'string'
        } as Omit<VariableDefinition, 'id'>);
      });
    });

    // 3. Dynamic PDF Form Variables
    const pdfsSnap = await adminDb.collection('pdfs').where('status', '==', 'published').get();
    pdfsSnap.forEach(doc => {
      const pdf = doc.data() as PDFForm;
      const fields = pdf.fields || [];
      
      fields.forEach(f => {
        if (f.type === 'signature' || f.type === 'photo') return;
        
        const varId = `pdf_${doc.id}_${f.id}`;
        const ref = variablesCol.doc(varId);
        batch.set(ref, {
          key: f.id,
          label: f.label || f.placeholder || f.id,
          category: 'forms',
          source: 'pdf',
          sourceId: doc.id,
          sourceName: pdf.name,
          entity: 'Submission',
          path: f.id,
          type: 'string'
        } as Omit<VariableDefinition, 'id'>);
      });
    });

    await batch.commit();
    revalidatePath('/admin/messaging/variables');
    return { success: true };
  } catch (error: any) {
    console.error(">>> [VARIABLES] Sync Failed:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Deletes all harvested variables for a specific source.
 */
export async function clearVariablesForSource(sourceId: string) {
    const variablesCol = adminDb.collection('messaging_variables');
    const querySnap = await variablesCol.where('sourceId', '==', sourceId).get();
    
    const batch = adminDb.batch();
    querySnap.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    
    revalidatePath('/admin/messaging/variables');
    return { success: true };
}
