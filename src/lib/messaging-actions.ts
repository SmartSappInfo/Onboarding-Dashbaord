
'use server';

import { adminDb } from './firebase-admin';
import type { VariableDefinition, Survey, PDFForm, SurveyQuestion, Meeting, Submission, SurveyResponse, MessageLog } from './types';
import { revalidatePath } from 'next/cache';
import { fetchSmsStatusAction } from './mnotify-actions';
import { fetchEmailStatusAction } from './resend-actions';

/**
 * @fileOverview Server-side actions for the Variable Registry.
 * Handles harvesting dynamic schema from Surveys and PDFs, managing constants,
 * and resolving data for the messaging engine.
 */

/**
 * Synchronizes the Variable Registry by scanning Schools, Meetings, Surveys, and PDFs.
 * Includes a cleanup phase to remove orphaned dynamic variables while preserving constants.
 */
export async function syncVariableRegistry() {
  try {
    const variablesCol = adminDb.collection('messaging_variables');
    
    // 1. CLEANUP PHASE: Fetch all dynamic variables first (excluding constants)
    const existingDynamicSnap = await variablesCol
      .where('source', 'in', ['survey', 'pdf', 'static'])
      .get();
    
    const existingVarIds = new Set(existingDynamicSnap.docs.map(d => d.id));
    const varsToKeep = new Set<string>();

    const batch = adminDb.batch();

    // 2. STATIC CORE VARIABLES (Always Sync/Update)
    const staticVariables: Omit<VariableDefinition, 'id'>[] = [
      { key: 'school_name', label: 'School Name', category: 'general', source: 'static', entity: 'School', path: 'name', type: 'string' },
      { key: 'school_initials', label: 'School Initials', category: 'general', source: 'static', entity: 'School', path: 'initials', type: 'string' },
      { key: 'school_location', label: 'School Location', category: 'general', source: 'static', entity: 'School', path: 'location', type: 'string' },
      { key: 'school_phone', label: 'School Phone', category: 'general', source: 'static', entity: 'School', path: 'phone', type: 'string' },
      { key: 'school_email', label: 'School Email', category: 'general', source: 'static', entity: 'School', path: 'email', type: 'string' },
      { key: 'contact_name', label: 'Primary Contact Name', category: 'general', source: 'static', entity: 'School', path: 'contactPerson', type: 'string' },
      { key: 'meeting_time', label: 'Meeting Time', category: 'meetings', source: 'static', entity: 'Meeting', path: 'meetingTime', type: 'date' },
      { key: 'meeting_link', label: 'Meeting Link', category: 'meetings', source: 'static', entity: 'Meeting', path: 'meetingLink', type: 'string' },
      { key: 'meeting_type', label: 'Meeting Type', category: 'meetings', source: 'static', entity: 'Meeting', path: 'type.name', type: 'string' },
      { key: 'survey_score', label: 'Respondent Score', category: 'surveys', source: 'static', entity: 'SurveyResponse', path: 'score', type: 'number' },
      { key: 'max_score', label: 'Survey Max Points', category: 'surveys', source: 'static', entity: 'SurveyResponse', path: 'maxScore', type: 'number' },
      { key: 'outcome_label', label: 'Logic Result Name', category: 'surveys', source: 'static', entity: 'SurveyResponse', path: 'outcome.label', type: 'string' },
      { key: 'result_url', label: 'Public Result Link', category: 'surveys', source: 'static', entity: 'SurveyResponse', path: 'resultUrl', type: 'string' },
    ];

    staticVariables.forEach(v => {
      const ref = variablesCol.doc(v.key);
      batch.set(ref, v, { merge: true }); 
      varsToKeep.add(v.key);
    });

    // 3. DYNAMIC SURVEY HARVESTING
    const surveysSnap = await adminDb.collection('surveys').where('status', '!=', 'archived').get();
    surveysSnap.forEach(doc => {
      const survey = doc.data() as Survey;
      const questions = survey.elements.filter((el): el is SurveyQuestion => 'isRequired' in el);
      
      questions.forEach(q => {
        const varId = `survey_${doc.id}_${q.id}`;
        varsToKeep.add(varId);
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
        } as Omit<VariableDefinition, 'id'>, { merge: true });
      });
    });

    // 4. DYNAMIC PDF FORM HARVESTING
    const pdfsSnap = await adminDb.collection('pdfs').where('status', '!=', 'archived').get();
    pdfsSnap.forEach(doc => {
      const pdf = doc.data() as PDFForm;
      const fields = pdf.fields || [];
      
      fields.forEach(f => {
        if (f.type === 'signature' || f.type === 'photo') return;
        
        const varId = `pdf_${doc.id}_${f.id}`;
        varsToKeep.add(varId);
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
        } as Omit<VariableDefinition, 'id'>, { merge: true });
      });
    });

    // 5. PURGE ORPHANS
    existingVarIds.forEach(id => {
      if (!varsToKeep.has(id)) {
        batch.delete(variablesCol.doc(id));
      }
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
 * Synchronizes statuses for all relevant messaging logs by querying providers.
 * High-cost operation - limited to top 50 logs.
 */
export async function syncAllLogStatuses() {
    try {
        const logsCol = adminDb.collection('message_logs');
        const logsSnap = await logsCol
            .where('status', '==', 'sent')
            .orderBy('sentAt', 'desc')
            .limit(50)
            .get();

        if (logsSnap.empty) return { success: true, count: 0 };

        let updatedCount = 0;
        for (const logDoc of logsSnap.docs) {
            const log = { id: logDoc.id, ...logDoc.data() } as MessageLog;
            if (!log.providerId) continue;

            let providerStatus = '';
            let isDelivered = false;

            try {
                if (log.channel === 'sms') {
                    const res = await fetchSmsStatusAction(log.providerId);
                    if (res.success) {
                        providerStatus = String(res.data.status);
                        isDelivered = providerStatus === '0' || providerStatus.toLowerCase().includes('delivered');
                    }
                } else {
                    const res = await fetchEmailStatusAction(log.providerId);
                    if (res.success) {
                        providerStatus = res.data.last_event || 'sent';
                        isDelivered = providerStatus === 'delivered';
                    }
                }

                if (providerStatus && providerStatus !== log.providerStatus) {
                    await logDoc.ref.update({
                        providerStatus,
                        status: isDelivered ? 'sent' : providerStatus === 'bounced' ? 'failed' : log.status,
                        updatedAt: new Date().toISOString()
                    });
                    updatedCount++;
                }
            } catch (e) {
                console.error(`Status sync failed for log ${log.id}`);
            }
        }

        revalidatePath('/admin/messaging/logs');
        return { success: true, count: updatedCount };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Creates or updates a Global Constant variable.
 */
export async function upsertConstantVariable(data: Partial<VariableDefinition>) {
    try {
        const id = data.id || `const_${data.key}`;
        const finalData = {
            ...data,
            source: 'constant',
            entity: 'Global',
            category: 'general',
            type: 'string',
            updatedAt: new Date().toISOString()
        };
        await adminDb.collection('messaging_variables').doc(id).set(finalData, { merge: true });
        revalidatePath('/admin/messaging/variables');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Updates the global visibility of a variable.
 */
export async function updateVariableVisibility(id: string, hidden: boolean) {
    try {
        await adminDb.collection('messaging_variables').doc(id).update({ 
            hidden,
            updatedAt: new Date().toISOString()
        });
        revalidatePath('/admin/messaging/variables');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Deletes a manual constant variable.
 */
export async function deleteVariable(id: string) {
    try {
        await adminDb.collection('messaging_variables').doc(id).delete();
        revalidatePath('/admin/messaging/variables');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Fetches data for a specific entity to resolve variables in the composer.
 */
export async function fetchContextualData(entity: string, id: string, parentId?: string) {
    try {
        let data: any = null;
        if (entity === 'Meeting') {
            const snap = await adminDb.collection('meetings').doc(id).get();
            if (snap.exists) data = snap.data();
        } else if (entity === 'SurveyResponse' && parentId) {
            const snap = await adminDb.collection('surveys').doc(parentId).collection('responses').doc(id).get();
            if (snap.exists) data = snap.data();
        } else if (entity === 'Submission' && parentId) {
            const snap = await adminDb.collection('pdfs').doc(parentId).collection('submissions').doc(id).get();
            if (snap.exists) data = snap.data();
        } else if (entity === 'School') {
            const snap = await adminDb.collection('schools').doc(id).get();
            if (snap.exists) data = snap.data();
        }

        return { success: true, data };
    } catch (e: any) {
        return { success: false, error: e.message };
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
