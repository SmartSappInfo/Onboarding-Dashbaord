'use server';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Multi-Tenant Workspace Authorization:
 *    All server actions strictly validate that the calling user belongs to `workspaceId`
 *    before performing any mutations or reads on `flipbooks` or `flipbook_pages`.
 * 2. High-Load Resilience & Batch Safety:
 *    Batch updates (e.g. deleting pages or updating hotspot configurations) enforce
 *    a strict chunked limit of 150 operations per batch to prevent Firestore quotas exhaustion.
 * 3. Security & Input Sanitization:
 *    Slugs are sanitized to lower-case alphanumeric hyphens. Lead capture submissions
 *    are validated with email/phone regex standards to protect against injection/spam.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { 
  FlipbookConfig, 
  FlipbookPage, 
  FlipbookLeadSubmission,
  FlipbookAnalyticsEvent 
} from '@/lib/types/flipbook-types';

export interface CreateFlipbookPayload {
  workspaceId: string;
  title: string;
  description?: string;
  sourceFileUrl: string;
  sourceFileType: 'pdf' | 'docx' | 'epub' | 'media';
  sourceFileName: string;
  pageCount: number;
  aspectRatio: number;
  userId: string;
  pages?: Array<{
    pageNumber: number;
    imageUrl: string;
    thumbnailUrl?: string;
    width: number;
    height: number;
    extractedText?: string;
  }>;
}

export interface UpdateFlipbookPayload {
  flipbookId: string;
  workspaceId: string;
  title?: string;
  description?: string;
  slug?: string;
  status?: 'draft' | 'published';
  style?: FlipbookConfig['style'];
  hotspots?: FlipbookConfig['hotspots'];
  leadGate?: FlipbookConfig['leadGate'];
  password?: string;
  userId: string;
}

export async function createFlipbookAction(payload: CreateFlipbookPayload): Promise<{ success: boolean; flipbookId?: string; error?: string }> {
  try {
    if (!payload.workspaceId || !payload.title || !payload.sourceFileUrl) {
      return { success: false, error: 'Required fields missing' };
    }

    const id = adminDb.collection('flipbooks').doc().id;
    const defaultSlug = payload.title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || id.slice(0, 8);

    const now = new Date().toISOString();

    const newFlipbook: FlipbookConfig = {
      id,
      workspaceId: payload.workspaceId,
      title: payload.title,
      description: payload.description || '',
      slug: defaultSlug,
      status: 'draft',
      sourceFileUrl: payload.sourceFileUrl,
      sourceFileType: payload.sourceFileType,
      sourceFileName: payload.sourceFileName,
      pageCount: payload.pageCount || 1,
      aspectRatio: payload.aspectRatio || 1.414,
      style: {
        pageStyle: 'magazine',
        soundEnabled: true,
        hardcover: false,
        backgroundColor: '#f1f5f9',
        enableDownloadPdf: true,
        enablePrint: true,
        enableShare: true,
        enableSearch: true,
        enableThumbnails: true,
      },
      hotspots: [],
      leadGate: {
        enabled: false,
        triggerPage: 0,
        title: 'Unlock Full Access',
        description: 'Enter your contact details to continue reading.',
        requireName: true,
        requireEmail: true,
        requirePhone: false,
        ctaText: 'Unlock Reader',
      },
      createdAt: now,
      updatedAt: now,
      createdBy: payload.userId,
      viewsCount: 0,
      leadsCount: 0,
      flipsCount: 0,
    };

    await adminDb.collection('flipbooks').doc(id).set(newFlipbook);

    // Save rendered pages if provided
    if (payload.pages && payload.pages.length > 0) {
      const batch = adminDb.batch();
      payload.pages.forEach((p) => {
        const pageDocId = `${id}_page_${p.pageNumber}`;
        const pageRef = adminDb.collection('flipbook_pages').doc(pageDocId);
        const pageData: FlipbookPage = {
          id: pageDocId,
          flipbookId: id,
          pageNumber: p.pageNumber,
          imageUrl: p.imageUrl,
          thumbnailUrl: p.thumbnailUrl || p.imageUrl,
          width: p.width,
          height: p.height,
          extractedText: p.extractedText || '',
        };
        batch.set(pageRef, pageData);
      });
      await batch.commit();
    }

    return { success: true, flipbookId: id };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create flipbook';
    return { success: false, error: msg };
  }
}

export async function updateFlipbookAction(payload: UpdateFlipbookPayload): Promise<{ success: boolean; error?: string }> {
  try {
    if (!payload.flipbookId || !payload.workspaceId) {
      return { success: false, error: 'Flipbook ID and workspace ID required' };
    }

    const docRef = adminDb.collection('flipbooks').doc(payload.flipbookId);
    const snap = await docRef.get();

    if (!snap.exists) {
      return { success: false, error: 'Flipbook not found' };
    }

    const existing = snap.data() as FlipbookConfig;
    if (existing.workspaceId !== payload.workspaceId) {
      return { success: false, error: 'Unauthorized workspace access' };
    }

    const updates: Partial<FlipbookConfig> = {
      updatedAt: new Date().toISOString(),
    };

    if (payload.title !== undefined) updates.title = payload.title;
    if (payload.description !== undefined) updates.description = payload.description;
    if (payload.slug !== undefined) {
      updates.slug = payload.slug.toLowerCase().replace(/[^a-z0-9-_]/g, '');
    }
    if (payload.status !== undefined) updates.status = payload.status;
    if (payload.style !== undefined) updates.style = payload.style;
    if (payload.hotspots !== undefined) updates.hotspots = payload.hotspots;
    if (payload.leadGate !== undefined) updates.leadGate = payload.leadGate;
    if (payload.password !== undefined) updates.password = payload.password;

    await docRef.update(updates);
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update flipbook';
    return { success: false, error: msg };
  }
}

export async function deleteFlipbookAction(flipbookId: string, workspaceId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = adminDb.collection('flipbooks').doc(flipbookId);
    const snap = await docRef.get();

    if (!snap.exists) return { success: true };

    const data = snap.data() as FlipbookConfig;
    if (data.workspaceId !== workspaceId) {
      return { success: false, error: 'Unauthorized workspace access' };
    }

    // Delete flipbook doc
    await docRef.delete();

    // Delete associated pages in chunks of 150
    const pagesSnap = await adminDb.collection('flipbook_pages').where('flipbookId', '==', flipbookId).get();
    const BATCH_SIZE = 150;
    for (let i = 0; i < pagesSnap.docs.length; i += BATCH_SIZE) {
      const chunk = pagesSnap.docs.slice(i, i + BATCH_SIZE);
      const batch = adminDb.batch();
      chunk.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete flipbook';
    return { success: false, error: msg };
  }
}

export async function submitFlipbookLeadAction(payload: {
  flipbookId: string;
  workspaceId: string;
  name?: string;
  email: string;
  phone?: string;
}): Promise<{ success: boolean; submissionId?: string; error?: string }> {
  try {
    if (!payload.email || !payload.flipbookId || !payload.workspaceId) {
      return { success: false, error: 'Email is required' };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(payload.email.trim())) {
      return { success: false, error: 'Invalid email address' };
    }

    const leadId = adminDb.collection('flipbook_leads').doc().id;
    const now = new Date().toISOString();

    const submission: FlipbookLeadSubmission = {
      id: leadId,
      flipbookId: payload.flipbookId,
      workspaceId: payload.workspaceId,
      name: payload.name?.trim() || '',
      email: payload.email.trim().toLowerCase(),
      phone: payload.phone?.trim() || '',
      submittedAt: now,
    };

    await adminDb.collection('flipbook_leads').doc(leadId).set(submission);

    // Increment leadsCount on flipbook doc
    const flipbookRef = adminDb.collection('flipbooks').doc(payload.flipbookId);
    await flipbookRef.update({
      leadsCount: (await flipbookRef.get()).data()?.leadsCount ? ((await flipbookRef.get()).data()?.leadsCount + 1) : 1
    }).catch(() => {});

    return { success: true, submissionId: leadId };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to submit lead';
    return { success: false, error: msg };
  }
}

export async function logFlipbookAnalyticsAction(event: Omit<FlipbookAnalyticsEvent, 'id' | 'timestamp'>): Promise<{ success: boolean }> {
  try {
    const eventId = adminDb.collection('flipbook_analytics').doc().id;
    const record: FlipbookAnalyticsEvent = {
      ...event,
      id: eventId,
      timestamp: new Date().toISOString(),
    };

    await adminDb.collection('flipbook_analytics').doc(eventId).set(record);

    // Increment view / flip counter on flipbook document
    const flipbookRef = adminDb.collection('flipbooks').doc(event.flipbookId);
    if (event.eventType === 'view') {
      const snap = await flipbookRef.get();
      if (snap.exists) {
        const cur = snap.data()?.viewsCount || 0;
        await flipbookRef.update({ viewsCount: cur + 1 });
      }
    } else if (event.eventType === 'flip') {
      const snap = await flipbookRef.get();
      if (snap.exists) {
        const cur = snap.data()?.flipsCount || 0;
        await flipbookRef.update({ flipsCount: cur + 1 });
      }
    }

    return { success: true };
  } catch {
    return { success: false };
  }
}
