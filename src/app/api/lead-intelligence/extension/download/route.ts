import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { LeadIntelligenceSettings } from '@/lib/lead-intelligence/types';
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const workspaceId = searchParams.get('workspaceId') || '';
    const token = searchParams.get('token') || '';

    if (!workspaceId || !token) {
      return NextResponse.json(
        { error: 'workspaceId and token parameters are required' },
        { status: 400 }
      );
    }

    // 1. Verify access key
    const settingsSnap = await adminDb.collection('system_settings')
      .doc(`keys_${workspaceId}`)
      .get();

    if (!settingsSnap.exists) {
      return NextResponse.json(
        { error: 'Workspace settings not found' },
        { status: 404 }
      );
    }

    const settings = settingsSnap.data() as LeadIntelligenceSettings;
    if (settings.chromeExtensionToken !== token) {
      return NextResponse.json(
        { error: 'Unauthorized access token mismatch' },
        { status: 401 }
      );
    }

    // 2. Read public/extension folder files
    const extensionDir = path.join(process.cwd(), 'public/extension');
    const filesToPackage = ['manifest.json', 'popup.html', 'popup.js', 'background.js'];

    const zip = new JSZip();

    // Add each source file
    for (const fileName of filesToPackage) {
      const filePath = path.join(extensionDir, fileName);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        zip.file(fileName, content);
      } else {
        console.warn(`[API:LEAD_INTEL:DOWNLOAD] Warning: File not found: ${filePath}`);
      }
    }

    // 3. Construct custom config.json containing active credentials
    const requestUrl = new URL(request.url);
    const workspaceUrl = `${requestUrl.protocol}//${requestUrl.host}`;
    const customConfig = {
      workspaceUrl,
      apiToken: token
    };

    zip.file('config.json', JSON.stringify(customConfig, null, 2));

    // 4. Generate ZIP archive buffer
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    // 5. Return zip download
    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="smartsapp-lead-intelligence.zip"',
        'Cache-Control': 'no-store'
      }
    });

  } catch (err: unknown) {
    console.error('[API:LEAD_INTEL:DOWNLOAD] Error packaging zip:', err);
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
