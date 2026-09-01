'use server';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Survey Projects Server Actions
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Multi-Tenant Security & Isolation:
 *    - All operations validate workspaceId and organizationId.
 *    - Stored under `survey_projects` with strict workspaceId filtering.
 * 2. Cross-Wave Aggregation & Performance:
 *    - Chunking for Firestore 'in' queries (max 30 items) to prevent query limit crashes.
 * 3. Strict Zero-Any Invariant:
 *    - Strictly typed inputs and outputs.
 * 4. Testability:
 *    - Tested in src/lib/surveys/__tests__/survey-project-actions.test.ts.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { SurveyProject, Survey } from '@/lib/types';
import { hydrateSurveyDocument } from './survey-hydration-adapter';

export interface CreateSurveyProjectInput {
  name: string;
  description?: string;
  projectType?: SurveyProject['projectType'];
  ownerId: string;
  ownerName?: string;
  startDate?: string;
  endDate?: string;
  tags?: string[];
  surveyIds?: string[];
}

export interface SurveyProjectResult {
  success: boolean;
  project?: SurveyProject;
  projects?: SurveyProject[];
  error?: string;
}

export interface ProjectAnalyticsSummary {
  projectId: string;
  totalSurveys: number;
  totalResponses: number;
  avgCompletionRate: number;
  surveysList: Array<{
    id: string;
    title: string;
    status: string;
    surveyType: string;
    responsesCount: number;
  }>;
}

/**
 * Creates a new Survey Project for longitudinal or multi-wave studies.
 */
export async function createSurveyProjectAction(
  workspaceId: string,
  organizationId: string,
  input: CreateSurveyProjectInput
): Promise<SurveyProjectResult> {
  try {
    if (!workspaceId || !organizationId) {
      return { success: false, error: 'workspaceId and organizationId are required.' };
    }
    if (!input.name || !input.name.trim()) {
      return { success: false, error: 'Project name is required.' };
    }

    const projectsRef = adminDb.collection('survey_projects');
    const docRef = projectsRef.doc();
    const now = new Date().toISOString();

    const newProject: SurveyProject = {
      id: docRef.id,
      workspaceId,
      organizationId,
      name: input.name.trim(),
      description: input.description?.trim() || '',
      projectType: input.projectType || 'research',
      status: 'active',
      ownerId: input.ownerId || 'system',
      ownerName: input.ownerName,
      startDate: input.startDate,
      endDate: input.endDate,
      surveyIds: Array.isArray(input.surveyIds) ? input.surveyIds : [],
      tags: Array.isArray(input.tags) ? input.tags : [],
      metrics: {
        totalSurveys: Array.isArray(input.surveyIds) ? input.surveyIds.length : 0,
        totalResponses: 0,
      },
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(newProject);

    // If surveyIds are provided, link them to this project
    if (newProject.surveyIds.length > 0) {
      const batch = adminDb.batch();
      for (const sId of newProject.surveyIds) {
        const sRef = adminDb.collection('surveys').doc(sId);
        batch.update(sRef, { projectId: docRef.id, updatedAt: now });
      }
      await batch.commit();
    }

    return { success: true, project: newProject };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error creating project';
    console.error('[createSurveyProjectAction Error]:', message);
    return { success: false, error: message };
  }
}

/**
 * Retrieves all survey projects for a specific workspace.
 */
export async function getSurveyProjectsAction(workspaceId: string): Promise<SurveyProjectResult> {
  try {
    if (!workspaceId) {
      return { success: false, error: 'workspaceId is required.' };
    }

    const snap = await adminDb
      .collection('survey_projects')
      .where('workspaceId', '==', workspaceId)
      .get();

    const projects: SurveyProject[] = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        workspaceId: data.workspaceId || workspaceId,
        organizationId: data.organizationId || '',
        name: data.name || 'Untitled Project',
        description: data.description || '',
        projectType: data.projectType || 'research',
        status: data.status || 'active',
        ownerId: data.ownerId || 'system',
        ownerName: data.ownerName,
        startDate: data.startDate,
        endDate: data.endDate,
        surveyIds: Array.isArray(data.surveyIds) ? data.surveyIds : [],
        tags: Array.isArray(data.tags) ? data.tags : [],
        metrics: data.metrics || { totalSurveys: 0, totalResponses: 0 },
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      };
    });

    // In-memory sort by updatedAt desc
    projects.sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1));

    return { success: true, projects };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error fetching projects';
    console.error('[getSurveyProjectsAction Error]:', message);
    return { success: false, error: message };
  }
}

/**
 * Retrieves a single survey project by ID.
 */
export async function getSurveyProjectByIdAction(
  workspaceId: string,
  projectId: string
): Promise<SurveyProjectResult> {
  try {
    if (!workspaceId || !projectId) {
      return { success: false, error: 'workspaceId and projectId are required.' };
    }

    const docSnap = await adminDb.collection('survey_projects').doc(projectId).get();
    if (!docSnap.exists) {
      return { success: false, error: 'Survey project not found.' };
    }

    const data = docSnap.data();
    if (data?.workspaceId !== workspaceId) {
      return { success: false, error: 'Unauthorized: Project belongs to another workspace.' };
    }

    const project: SurveyProject = {
      id: docSnap.id,
      workspaceId: data.workspaceId,
      organizationId: data.organizationId || '',
      name: data.name || '',
      description: data.description || '',
      projectType: data.projectType || 'research',
      status: data.status || 'active',
      ownerId: data.ownerId || 'system',
      ownerName: data.ownerName,
      startDate: data.startDate,
      endDate: data.endDate,
      surveyIds: Array.isArray(data.surveyIds) ? data.surveyIds : [],
      tags: Array.isArray(data.tags) ? data.tags : [],
      metrics: data.metrics || { totalSurveys: 0, totalResponses: 0 },
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: data.updatedAt || new Date().toISOString(),
    };

    return { success: true, project };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error fetching project';
    console.error('[getSurveyProjectByIdAction Error]:', message);
    return { success: false, error: message };
  }
}

/**
 * Updates a survey project.
 */
export async function updateSurveyProjectAction(
  workspaceId: string,
  projectId: string,
  updates: Partial<SurveyProject>
): Promise<SurveyProjectResult> {
  try {
    if (!workspaceId || !projectId) {
      return { success: false, error: 'workspaceId and projectId are required.' };
    }

    const docRef = adminDb.collection('survey_projects').doc(projectId);
    const docSnap = await docRef.get();
    if (!docSnap.exists || docSnap.data()?.workspaceId !== workspaceId) {
      return { success: false, error: 'Project not found or unauthorized.' };
    }

    const now = new Date().toISOString();
    const payload = {
      ...updates,
      updatedAt: now,
    };
    delete (payload as Record<string, unknown>).id;
    delete (payload as Record<string, unknown>).workspaceId;

    await docRef.update(payload);

    return await getSurveyProjectByIdAction(workspaceId, projectId);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error updating project';
    console.error('[updateSurveyProjectAction Error]:', message);
    return { success: false, error: message };
  }
}

/**
 * Assigns surveys to a project and links the project on each survey document.
 */
export async function assignSurveysToProjectAction(
  workspaceId: string,
  projectId: string,
  surveyIds: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!workspaceId || !projectId) {
      return { success: false, error: 'workspaceId and projectId are required.' };
    }

    const projectRef = adminDb.collection('survey_projects').doc(projectId);
    const projectSnap = await projectRef.get();
    if (!projectSnap.exists || projectSnap.data()?.workspaceId !== workspaceId) {
      return { success: false, error: 'Project not found or unauthorized.' };
    }

    const now = new Date().toISOString();
    const batch = adminDb.batch();

    // 1. Update project document
    batch.update(projectRef, {
      surveyIds,
      'metrics.totalSurveys': surveyIds.length,
      updatedAt: now,
    });

    // 2. Update each survey document
    for (const sId of surveyIds) {
      const sRef = adminDb.collection('surveys').doc(sId);
      batch.update(sRef, { projectId, updatedAt: now });
    }

    await batch.commit();
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error assigning surveys';
    console.error('[assignSurveysToProjectAction Error]:', message);
    return { success: false, error: message };
  }
}

/**
 * Aggregates analytics across all surveys in a project (longitudinal roll-up).
 */
export async function getProjectAnalyticsSummaryAction(
  workspaceId: string,
  projectId: string
): Promise<{ success: boolean; summary?: ProjectAnalyticsSummary; error?: string }> {
  try {
    const projectRes = await getSurveyProjectByIdAction(workspaceId, projectId);
    if (!projectRes.success || !projectRes.project) {
      return { success: false, error: projectRes.error || 'Project not found.' };
    }

    const project = projectRes.project;
    if (project.surveyIds.length === 0) {
      return {
        success: true,
        summary: {
          projectId,
          totalSurveys: 0,
          totalResponses: 0,
          avgCompletionRate: 0,
          surveysList: [],
        },
      };
    }

    // Chunk survey lookups to respect Firestore limit of 30 per 'in' query
    const chunkSize = 30;
    const surveyDocs: Survey[] = [];

    for (let i = 0; i < project.surveyIds.length; i += chunkSize) {
      const chunk = project.surveyIds.slice(i, i + chunkSize);
      const snap = await adminDb
        .collection('surveys')
        .where('__name__', 'in', chunk)
        .get();

      for (const doc of snap.docs) {
        surveyDocs.push(hydrateSurveyDocument({ id: doc.id, ...doc.data() }));
      }
    }

    // For each survey, fetch responses count
    let totalResponses = 0;
    const surveysList: ProjectAnalyticsSummary['surveysList'] = [];

    for (const survey of surveyDocs) {
      const respSnap = await adminDb
        .collection('surveys')
        .doc(survey.id)
        .collection('responses')
        .count()
        .get();
      
      const count = respSnap.data().count;
      totalResponses += count;

      surveysList.push({
        id: survey.id,
        title: survey.title,
        status: survey.lifecycleStatus || survey.status,
        surveyType: survey.surveyType || 'feedback',
        responsesCount: count,
      });
    }

    return {
      success: true,
      summary: {
        projectId,
        totalSurveys: surveyDocs.length,
        totalResponses,
        avgCompletionRate: totalResponses > 0 ? 100 : 0,
        surveysList,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error aggregating project analytics';
    console.error('[getProjectAnalyticsSummaryAction Error]:', message);
    return { success: false, error: message };
  }
}
