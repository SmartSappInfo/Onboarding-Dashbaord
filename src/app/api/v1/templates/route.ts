/**
 * Public Developer REST API: /api/v1/templates
 *
 * GET: Lists published document templates and variable schemas for the authenticated workspace.
 *
 * @maintainer Antigravity Pair Programming
 */

import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import {
  authenticateDeveloperRequest,
  formatSuccessResponse,
} from '@/lib/documents/developer-api-helper';
import type { DocumentTemplate } from '@/lib/types/document-signing';

export async function GET(request: NextRequest) {
  const auth = await authenticateDeveloperRequest(request, 'templates:read');
  if (!auth.authenticated) {
    return auth.response;
  }

  const { workspaceId } = auth.keyRecord;
  const snapshot = await adminDb
    .collection(`workspaces/${workspaceId}/document_templates`)
    .where('workspaceId', '==', workspaceId)
    .where('status', '==', 'published')
    .limit(100)
    .get();

  const templates = snapshot.docs.map((doc) => {
    const data = doc.data() as DocumentTemplate;
    return {
      id: doc.id,
      name: data.name,
      documentType: data.documentType,
      currentPublishedVersionId: data.currentPublishedVersionId || null,
      description: data.description || null,
      tagIds: data.tagIds || [],
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  });

  return formatSuccessResponse(templates, {}, auth.rateLimitHeaders);
}
