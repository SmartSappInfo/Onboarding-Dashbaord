/**
 * @fileOverview REST API Export Endpoint
 * Route: GET /api/v1/quick-notes/export?workspaceId=...&format=json|markdown
 *
 * Authenticates API Key or session user and streams the workspace knowledge bundle.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminDb } from '@/lib/firebase-admin';
import { exportWorkspaceKnowledgeAction } from '@/lib/quick-notes-federation-actions';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    const xApiKey = req.headers.get('x-api-key');

    let rawKey = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      rawKey = authHeader.replace(/^Bearer\s+/i, '').trim();
    } else if (xApiKey) {
      rawKey = xApiKey.trim();
    }

    if (!rawKey) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing API key in Authorization (Bearer) or x-api-key header.' },
        { status: 401 }
      );
    }

    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const keyQuery = await adminDb
      .collection('api_keys')
      .where('keyHash', '==', keyHash)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    if (keyQuery.empty) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid or revoked API key.' },
        { status: 401 }
      );
    }

    const keyData = keyQuery.docs[0].data();
    const workspaceId = keyData.workspaceId as string;
    const organizationId = keyData.organizationId as string;
    const createdBy = (keyData.createdBy as string) || 'export_client';

    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'json';

    const result = await exportWorkspaceKnowledgeAction({
      workspaceId,
      organizationId,
      userId: createdBy,
    });

    if (!result.success || !result.data) {
      return NextResponse.json(
        { error: result.error || 'Failed to generate export package.' },
        { status: 500 }
      );
    }

    if (format === 'markdown') {
      return new NextResponse(result.data.markdownBundle, {
        status: 200,
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': `attachment; filename="company-brain-export-${workspaceId}.md"`,
        },
      });
    }

    return NextResponse.json(result.data.jsonPackage, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
