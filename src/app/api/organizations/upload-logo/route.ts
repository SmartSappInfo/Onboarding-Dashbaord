import { NextRequest, NextResponse } from 'next/server';
import { adminStorage } from '@/lib/firebase-admin';

// 8 seconds timeout
const UPLOAD_TIMEOUT_MS = 8_000;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageUrl, organizationId } = body as { imageUrl?: string; organizationId?: string };

    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json({ error: 'A valid "imageUrl" is required.' }, { status: 400 });
    }

    if (!organizationId || typeof organizationId !== 'string') {
      return NextResponse.json({ error: 'A valid "organizationId" is required.' }, { status: 400 });
    }

    // Try to parse URL to confirm it's valid
    try {
      new URL(imageUrl);
    } catch {
      return NextResponse.json({ error: 'Invalid logo URL format.' }, { status: 400 });
    }

    // Fetch the external logo image with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

    let siteResponse: Response;
    try {
      siteResponse = await fetch(imageUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SmartSappBot/1.0; +https://smartsapp.com/bot)',
        },
      });
      clearTimeout(timeoutId);
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      return NextResponse.json({ error: `Could not fetch external logo: ${fetchErr.message}` }, { status: 422 });
    }

    if (!siteResponse.ok) {
      return NextResponse.json({ error: `External image server returned HTTP ${siteResponse.status}` }, { status: 422 });
    }

    const contentType = siteResponse.headers.get('Content-Type') || 'image/png';
    // Determine extension
    let extension = 'png';
    if (contentType.includes('image/svg+xml')) {
      extension = 'svg';
    } else if (contentType.includes('image/jpeg')) {
      extension = 'jpg';
    } else if (contentType.includes('image/gif')) {
      extension = 'gif';
    } else if (contentType.includes('image/webp')) {
      extension = 'webp';
    }

    const arrayBuffer = await siteResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Save to Firebase Storage bucket
    const filePath = `organizations/${organizationId}/logo.${extension}`;
    const file = adminStorage.file(filePath);

    await file.save(buffer, {
      metadata: {
        contentType,
        cacheControl: 'public, max-age=31536000',
      },
    });

    // Make file public
    await file.makePublic();

    // Get public URL using storage.googleapis.com
    const publicUrl = `https://storage.googleapis.com/${adminStorage.name}/${filePath}`;

    return NextResponse.json({ success: true, storageUrl: publicUrl }, { status: 200 });

  } catch (error: any) {
    console.error('[API:UPLOAD-LOGO:POST] Unhandled error:', error);
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred during logo upload.' },
      { status: 500 },
    );
  }
}
