'use server';

import { adminDb } from './firebase-admin';
import { revalidatePath } from 'next/cache';
import type { FormSubmission, WorkspaceEntity, Entity, CampaignPage, SurveyResponse } from './types';
import crypto from 'crypto';
import { applyTagAction } from './scoped-tag-actions';

/**
 * Lead Actions for Phase 5: CRM Integration
 * 
 * Handles synchronization between Campaign Page submissions and the core CRM logic.
 */

interface LeadSummary {
    id: string;
    submittedAt: string;
    name: string;
    email: string;
    phone: string;
    data: Record<string, any>;
    entityId?: string;
    type: 'form' | 'survey';
    sourceId: string; // formId or surveyId
}

/**
 * Fetches all submissions/leads for a specific campaign page.
 * Merges form submissions and survey responses.
 */
export async function getLeadsForPageAction(pageId: string): Promise<{ success: boolean; data?: LeadSummary[]; error?: string }> {
    try {
        // 1. Fetch Form Submissions
        const formsSnap = await adminDb.collection('form_submissions')
            .where('sourcePageId', '==', pageId)
            .orderBy('submittedAt', 'desc')
            .get();

        const formLeads: LeadSummary[] = formsSnap.docs.map(doc => {
            const data = doc.data() as FormSubmission;
            return {
                id: doc.id,
                submittedAt: data.submittedAt,
                name: extractIdentity(data.data, 'name'),
                email: extractIdentity(data.data, 'email'),
                phone: extractIdentity(data.data, 'phone'),
                data: data.data,
                entityId: data.entityId,
                type: 'form',
                sourceId: data.formId
            };
        });

        // 2. Fetch Survey Responses
        // Note: Surveys store responses in subcollections. We use a collectionGroup query.
        const surveysSnap = await adminDb.collectionGroup('responses')
            .where('sourcePageId', '==', pageId)
            .get();

        const surveyLeads: LeadSummary[] = surveysSnap.docs.map(doc => {
            const data = doc.data() as any; // SurveyResponse has answers array
            const answers = data.answers || [];
            
            // Convert answers array to flat object for extraction
            const flatData: Record<string, any> = {};
            answers.forEach((a: any) => {
                flatData[a.questionId] = a.value;
            });

            return {
                id: doc.id,
                submittedAt: data.submittedAt,
                name: extractIdentity(flatData, 'name'),
                email: extractIdentity(flatData, 'email'),
                phone: extractIdentity(flatData, 'phone'),
                data: flatData,
                entityId: data.entityId,
                type: 'survey',
                sourceId: data.surveyId
            };
        });

        // 3. Merge and Sort
        const allLeads = [...formLeads, ...surveyLeads].sort((a, b) => 
            new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
        );

        return { success: true, data: allLeads };
    } catch (error: any) {
        console.error(">>> [LEADS:GET] Failed:", error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Generic identity extractor from flat data objects.
 */
function extractIdentity(data: Record<string, any>, field: 'name' | 'email' | 'phone'): string {
    if (!data) return '';
    
    if (field === 'email') {
        const email = data.email || data.Email || data['Your Email'] || '';
        return typeof email === 'string' ? email.trim().toLowerCase() : '';
    }
    
    if (field === 'phone') {
        const phone = data.phone || data.Phone || data.mobile || data.Mobile || '';
        return typeof phone === 'string' ? phone.trim() : '';
    }
    
    if (field === 'name') {
        const name = data.name || data.Name || data.fullName || data.FullName || 
                     `${data.firstName || data.FirstName || ''} ${data.lastName || data.LastName || ''}`.trim();
        return name || 'Anonymous';
    }
    
    return '';
}

/**
 * Background worker to process a submission as a CRM Lead.
 * Deduplicates by organizationId + email.
 */
export async function processLeadCaptureAction(params: {
    submissionId: string;
    collection: 'form_submissions' | 'survey_responses';
    data: Record<string, any>;
    organizationId: string;
    workspaceId: string;
    sourcePageId: string;
    surveyId?: string; // If it's a survey
    formId?: string;   // If it's a form
}) {
    try {
        const { submissionId, collection, data, organizationId, workspaceId, sourcePageId } = params;
        if (!sourcePageId) return;

        // 0. Normalize data (if survey answers array)
        let normalizedData = data;
        if (data.answers && Array.isArray(data.answers)) {
            normalizedData = {};
            data.answers.forEach((a: any) => {
                normalizedData[a.questionId] = a.value;
            });
        }

        // 1. Identify contact info
        const email = extractIdentity(normalizedData, 'email');
        if (!email) return;

        const name = extractIdentity(normalizedData, 'name');
        const phone = extractIdentity(normalizedData, 'phone');


        // 2. Fetch page context for tagging
        const pageSnap = await adminDb.collection('campaign_pages').doc(sourcePageId).get();
        const page = pageSnap.exists ? pageSnap.data() as CampaignPage : null;
        const pageName = page?.name || 'Campaign Page';

        // 3. Deduplicate / Find existing contact
        const existingSnap = await adminDb.collection('workspace_entities')
            .where('organizationId', '==', organizationId)
            .where('primaryEmail', '==', email)
            .limit(1)
            .get();

        let entityId = '';

        if (!existingSnap.empty) {
            const weDoc = existingSnap.docs[0];
            const weData = weDoc.data() as WorkspaceEntity;
            entityId = weData.entityId;
        } else {
            // 4. Create new Entity + WorkspaceEntity
            entityId = `entity_${crypto.randomUUID()}`;
            const timestamp = new Date().toISOString();

            const entity: Entity = {
                id: entityId,
                organizationId,
                entityType: 'person',
                name,
                contacts: [],
                globalTags: [],
                status: 'active',
                createdAt: timestamp,
                updatedAt: timestamp,
                personData: {
                    firstName: data.firstName || data.FirstName || name.split(' ')[0] || '',
                    lastName: data.lastName || data.LastName || name.split(' ').slice(1).join(' ') || '',
                    leadSource: `Campaign Page: ${pageName}`
                }
            };

            await adminDb.collection('entities').doc(entityId).set(entity);

            const weId = `we_${crypto.randomUUID()}`;
            const workspaceEntity: WorkspaceEntity = {
                id: weId,
                organizationId,
                workspaceId,
                entityId,
                entityType: 'person',
                pipelineId: 'default', 
                stageId: 'new',
                status: 'active',
                lifecycleStatus: 'Lead',
                workspaceTags: [],
                displayName: name,
                primaryEmail: email,
                primaryPhone: phone,
                addedAt: timestamp,
                updatedAt: timestamp
            };

            await adminDb.collection('workspace_entities').doc(weId).set(workspaceEntity);
        }

        // 5. Apply "Source" Tag
        const tagSlug = `source-${sourcePageId.toLowerCase()}`;
        const tagName = `Source: ${pageName}`;

        
        const tagsSnap = await adminDb.collection('tags')
            .where('workspaceId', '==', workspaceId)
            .where('slug', '==', tagSlug)
            .limit(1)
            .get();

        let tagId = '';
        if (tagsSnap.empty) {
            const tagRef = adminDb.collection('tags').doc();
            tagId = tagRef.id;
            await tagRef.set({
                id: tagId,
                workspaceId,
                organizationId,
                name: tagName,
                slug: tagSlug,
                category: 'lifecycle',
                color: '#3b82f6',
                isSystem: true,
                usageCount: 0,
                createdBy: 'system',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        } else {
            tagId = tagsSnap.docs[0].id;
        }

        await applyTagAction(entityId, [tagId], workspaceId, 'system');

        // 6. Link submission to the entity
        if (collection === 'form_submissions') {
            await adminDb.collection('form_submissions').doc(submissionId).update({
                entityId,
                updatedAt: new Date().toISOString()
            });
        } else if (collection === 'survey_responses' && params.surveyId) {
            await adminDb.collection('surveys').doc(params.surveyId).collection('responses').doc(submissionId).update({
                entityId,
                updatedAt: new Date().toISOString()
            });
        }

    } catch (error: any) {
        console.error(">>> [LEADS:PROCESS] Failed:", error.message);
    }
}
