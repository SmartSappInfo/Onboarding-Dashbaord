'use server';

/**
 * ARCHITECTURE:
 * Server Actions for SmartSapp Creative Studio 2.0 (Phase 1: Production Core & Foundation)
 * 
 * Manages atomic CRUD operations for CreativeProjects, CreativeDocuments,
 * and CreativeVersions with multi-tenant workspace isolation.
 * 
 * CAUTION:
 * Never allow unauthenticated mutations. Always validate workspace boundaries.
 * 0% any/any[] strictly enforced.
 * 
 * TESTABILITY:
 * All actions return strict { success: boolean, data?: T, error?: string } payloads.
 */

import { revalidatePath } from 'next/cache';
import { adminDb } from '@/lib/firebase-admin';
import type {
  CreativeProject,
  CreativeDocument,
  CreativeElement,
  CreativeVersion,
  CreativeProjectType,
  CreativeProjectObjective,
} from '@/lib/creative/creative-types';
import { FORMAT_PRESETS, makeUniqueId } from '@/lib/creative/creative-types';

export interface CreateProjectInput {
  workspaceId: string;
  name: string;
  type: CreativeProjectType;
  objective?: CreativeProjectObjective;
  campaignId?: string;
  campaignName?: string;
  description?: string;
  brandKitId?: string;
  createdBy?: string;
  initialElements?: CreativeElement[];
  backgroundColor?: string;
}

export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function createCreativeProjectAction(
  input: CreateProjectInput
): Promise<ActionResult<{ project: CreativeProject; document: CreativeDocument }>> {
  try {
    if (!input.workspaceId || !input.name?.trim()) {
      return { success: false, error: 'Workspace ID and Project Name are required.' };
    }

    const projectId = makeUniqueId();
    const documentId = `doc-${projectId}`;
    const now = new Date().toISOString();
    const format = FORMAT_PRESETS[input.type] || FORMAT_PRESETS.youtube_thumbnail;

    const project: CreativeProject = {
      id: projectId,
      workspaceId: input.workspaceId,
      name: input.name.trim(),
      description: input.description,
      type: input.type,
      objective: input.objective || 'traffic',
      status: 'draft',
      campaignId: input.campaignId,
      campaignName: input.campaignName,
      brandKitId: input.brandKitId,
      documentId,
      createdBy: input.createdBy || 'user',
      createdAt: now,
      updatedAt: now,
    };

    const document: CreativeDocument = {
      id: documentId,
      projectId,
      workspaceId: input.workspaceId,
      name: input.name.trim(),
      format,
      backgroundColor: input.backgroundColor || '#0f172a',
      backgroundGradient: {
        type: 'linear',
        angle: 135,
        colors: ['#0f172a', '#1e1b4b'],
      },
      elements: input.initialElements || [],
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };

    const batch = adminDb.batch();
    const projectRef = adminDb.collection('creative_projects').doc(projectId);
    const docRef = adminDb.collection('creative_documents').doc(documentId);

    batch.set(projectRef, project);
    batch.set(docRef, document);
    await batch.commit();

    revalidatePath('/admin/creative-studio');
    revalidatePath('/admin/creative-studio/projects');

    return { success: true, data: { project, document } };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create creative project';
    console.error('[createCreativeProjectAction] Error:', error);
    return { success: false, error: message };
  }
}

export async function updateCreativeProjectAction(
  projectId: string,
  workspaceId: string,
  patch: Partial<CreativeProject>
): Promise<ActionResult<CreativeProject>> {
  try {
    if (!projectId || !workspaceId) {
      return { success: false, error: 'Project ID and Workspace ID are required.' };
    }

    const projectRef = adminDb.collection('creative_projects').doc(projectId);
    const snap = await projectRef.get();
    if (!snap.exists) {
      return { success: false, error: 'Project not found.' };
    }

    const current = snap.data() as CreativeProject;
    if (current.workspaceId !== workspaceId) {
      return { success: false, error: 'Unauthorized workspace access.' };
    }

    const updated: CreativeProject = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    await projectRef.set(updated, { merge: true });

    revalidatePath('/admin/creative-studio');
    revalidatePath(`/admin/creative-studio/projects/${projectId}`);

    return { success: true, data: updated };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update creative project';
    console.error('[updateCreativeProjectAction] Error:', error);
    return { success: false, error: message };
  }
}

export async function getCreativeProjectWithDocumentAction(
  projectId: string,
  workspaceId?: string
): Promise<ActionResult<{ project: CreativeProject; document: CreativeDocument }>> {
  try {
    if (!projectId) {
      return { success: false, error: 'Project ID is required.' };
    }

    const projectRef = adminDb.collection('creative_projects').doc(projectId);
    const snap = await projectRef.get();

    if (!snap.exists) {
      // Check if this is a legacy thumbnail_designs document
      const legacyRef = adminDb.collection('thumbnail_designs').doc(projectId);
      const legacySnap = await legacyRef.get();
      if (legacySnap.exists) {
        const legacyData = legacySnap.data();
        if (legacyData) {
          const { thumbnailDesignToCreativeProject } = await import('@/lib/creative/creative-types');
          const converted = thumbnailDesignToCreativeProject({
            id: legacySnap.id,
            workspaceId: legacyData.workspaceId || workspaceId || 'default-workspace',
            name: legacyData.name || 'Untitled Thumbnail',
            backgroundColor: legacyData.backgroundColor || '#0f172a',
            backgroundGradient: legacyData.backgroundGradient,
            backgroundImage: legacyData.backgroundImage,
            elements: legacyData.elements || [],
            thumbnailUrl: legacyData.thumbnailUrl,
            createdAt: legacyData.createdAt || new Date().toISOString(),
            updatedAt: legacyData.updatedAt || new Date().toISOString(),
          });
          return { success: true, data: converted };
        }
      }
      return { success: false, error: 'Creative project not found.' };
    }

    const project = snap.data() as CreativeProject;
    if (workspaceId && project.workspaceId !== workspaceId) {
      return { success: false, error: 'Unauthorized workspace access.' };
    }

    // Fetch corresponding document
    const docQuery = await adminDb
      .collection('creative_documents')
      .where('projectId', '==', projectId)
      .limit(1)
      .get();

    let document: CreativeDocument;
    if (!docQuery.empty) {
      document = docQuery.docs[0].data() as CreativeDocument;
    } else {
      // Fallback: create default document for project
      const documentId = `doc-${projectId}`;
      const now = new Date().toISOString();
      const format = FORMAT_PRESETS[project.type] || FORMAT_PRESETS.youtube_thumbnail;
      document = {
        id: documentId,
        projectId,
        workspaceId: project.workspaceId,
        name: project.name,
        format,
        backgroundColor: '#0f172a',
        elements: [],
        status: 'draft',
        createdAt: now,
        updatedAt: now,
      };
      await adminDb.collection('creative_documents').doc(documentId).set(document);
    }

    return { success: true, data: { project, document } };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve project';
    console.error('[getCreativeProjectWithDocumentAction] Error:', error);
    return { success: false, error: message };
  }
}

export async function saveCreativeDocumentAction(
  documentId: string,
  projectId: string,
  workspaceId: string,
  elements: CreativeElement[],
  thumbnailUrl?: string,
  options?: {
    backgroundColor?: string;
    backgroundGradient?: CreativeDocument['backgroundGradient'];
    backgroundImage?: string;
    createSnapshot?: boolean;
    snapshotNote?: string;
  }
): Promise<ActionResult<CreativeDocument>> {
  try {
    if (!documentId || !projectId || !workspaceId) {
      return { success: false, error: 'Document ID, Project ID, and Workspace ID are required.' };
    }

    const docRef = adminDb.collection('creative_documents').doc(documentId);
    const snap = await docRef.get();
    const now = new Date().toISOString();

    let current: CreativeDocument;
    if (snap.exists) {
      current = snap.data() as CreativeDocument;
    } else {
      current = {
        id: documentId,
        projectId,
        workspaceId,
        name: 'Untitled Document',
        format: FORMAT_PRESETS.youtube_thumbnail,
        backgroundColor: '#0f172a',
        elements: [],
        status: 'draft',
        createdAt: now,
        updatedAt: now,
      };
    }

    const updatedDocument: CreativeDocument = {
      ...current,
      elements,
      thumbnailUrl: thumbnailUrl !== undefined ? thumbnailUrl : current.thumbnailUrl,
      backgroundColor: options?.backgroundColor || current.backgroundColor,
      backgroundGradient: options?.backgroundGradient !== undefined ? options?.backgroundGradient : current.backgroundGradient,
      backgroundImage: options?.backgroundImage !== undefined ? options?.backgroundImage : current.backgroundImage,
      updatedAt: now,
    };

    const batch = adminDb.batch();
    batch.set(docRef, updatedDocument, { merge: true });

    // Update project thumbnail and updatedAt
    const projectRef = adminDb.collection('creative_projects').doc(projectId);
    const projectPatch: Partial<CreativeProject> = {
      updatedAt: now,
    };
    if (thumbnailUrl) {
      projectPatch.thumbnailUrl = thumbnailUrl;
    }
    batch.update(projectRef, projectPatch);

    // Also update legacy thumbnail_designs collection if it exists for backwards compatibility
    const legacyRef = adminDb.collection('thumbnail_designs').doc(projectId);
    batch.set(
      legacyRef,
      {
        id: projectId,
        workspaceId,
        name: current.name,
        backgroundColor: updatedDocument.backgroundColor,
        backgroundGradient: updatedDocument.backgroundGradient,
        backgroundImage: updatedDocument.backgroundImage,
        elements: updatedDocument.elements,
        thumbnailUrl: updatedDocument.thumbnailUrl,
        updatedAt: now,
      },
      { merge: true }
    );

    await batch.commit();

    // Optionally create a version snapshot
    if (options?.createSnapshot) {
      await createVersionSnapshotAction(documentId, projectId, elements, thumbnailUrl, options.snapshotNote);
    }

    return { success: true, data: updatedDocument };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save creative document';
    console.error('[saveCreativeDocumentAction] Error:', error);
    return { success: false, error: message };
  }
}

export async function createVersionSnapshotAction(
  documentId: string,
  projectId: string,
  elements: CreativeElement[],
  previewUrl?: string,
  note?: string,
  createdBy: string = 'user'
): Promise<ActionResult<CreativeVersion>> {
  try {
    const versionsQuery = await adminDb
      .collection('creative_versions')
      .where('documentId', '==', documentId)
      .get();

    const versionNumber = versionsQuery.size + 1;
    const versionId = `ver-${documentId}-${versionNumber}`;
    const now = new Date().toISOString();

    const docSnap = await adminDb.collection('creative_documents').doc(documentId).get();
    const docData = docSnap.exists ? (docSnap.data() as CreativeDocument) : null;

    const version: CreativeVersion = {
      id: versionId,
      projectId,
      documentId,
      versionNumber,
      elements,
      backgroundColor: docData?.backgroundColor || '#0f172a',
      backgroundGradient: docData?.backgroundGradient,
      backgroundImage: docData?.backgroundImage,
      previewUrl: previewUrl || docData?.thumbnailUrl,
      note: note || `Version ${versionNumber}`,
      createdBy,
      createdAt: now,
    };

    await adminDb.collection('creative_versions').doc(versionId).set(version);

    return { success: true, data: version };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create version snapshot';
    console.error('[createVersionSnapshotAction] Error:', error);
    return { success: false, error: message };
  }
}

export async function listCreativeVersionsAction(
  documentId: string
): Promise<ActionResult<CreativeVersion[]>> {
  try {
    if (!documentId) {
      return { success: false, error: 'Document ID is required.' };
    }

    const snap = await adminDb
      .collection('creative_versions')
      .where('documentId', '==', documentId)
      .orderBy('versionNumber', 'desc')
      .limit(30)
      .get();

    const versions = snap.docs.map((d) => d.data() as CreativeVersion);
    return { success: true, data: versions };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to list versions';
    console.error('[listCreativeVersionsAction] Error:', error);
    return { success: false, error: message };
  }
}

export async function deleteCreativeProjectAction(
  projectId: string,
  workspaceId: string
): Promise<ActionResult<{ deleted: boolean }>> {
  try {
    if (!projectId || !workspaceId) {
      return { success: false, error: 'Project ID and Workspace ID are required.' };
    }

    const projectRef = adminDb.collection('creative_projects').doc(projectId);
    const snap = await projectRef.get();
    if (!snap.exists) {
      return { success: false, error: 'Project not found.' };
    }

    const project = snap.data() as CreativeProject;
    if (project.workspaceId !== workspaceId) {
      return { success: false, error: 'Unauthorized workspace access.' };
    }

    const batch = adminDb.batch();
    batch.delete(projectRef);

    // Delete document
    const docQuery = await adminDb.collection('creative_documents').where('projectId', '==', projectId).get();
    docQuery.forEach((docSnap) => batch.delete(docSnap.ref));

    // Delete legacy thumbnail_designs if exists
    const legacyRef = adminDb.collection('thumbnail_designs').doc(projectId);
    batch.delete(legacyRef);

    await batch.commit();

    revalidatePath('/admin/creative-studio');
    revalidatePath('/admin/creative-studio/projects');

    return { success: true, data: { deleted: true } };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete project';
    console.error('[deleteCreativeProjectAction] Error:', error);
    return { success: false, error: message };
  }
}
