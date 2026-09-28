/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Signature Asset Streaming Endpoint:
 *    Streams signature PNG/JPEG assets offloaded to Cloud Storage under `signatures/...`.
 * 2. SSRF & Path Traversal Guard:
 *    Path is strictly validated: must begin with `signatures/` and must not contain `..`
 *    or illegal path traversal characters.
 * 3. Cache & Performance:
 *    Responses are immutable and cached for high performance (`Cache-Control: public, max-age=86400`).
 */

import { adminStorage } from '@/lib/firebase-admin';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const path = searchParams.get('path');

  if (!path || !path.startsWith('signatures/') || path.includes('..')) {
    return new Response('Invalid signature path parameter', { status: 400 });
  }

  try {
    const file = adminStorage.file(path);
    const [exists] = await file.exists();
    if (!exists) {
      return new Response('Signature not found', { status: 404 });
    }

    const [buffer] = await file.download();
    const contentType = path.endsWith('.jpg') || path.endsWith('.jpeg') ? 'image/jpeg' : 'image/png';

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, immutable',
      },
    });
  } catch (error: unknown) {
    console.error('Failed to stream signature image:', error);
    return new Response('Error retrieving signature asset', { status: 500 });
  }
}
