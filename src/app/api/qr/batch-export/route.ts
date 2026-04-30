import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { generateQRBuffer } from '@/lib/qr-server-gen';
import { getQRCode } from '@/lib/qr-actions';

/**
 * Endpoint for downloading a batch of QR codes as a ZIP file.
 * Expects a POST request with an array of `qrIds`.
 * Payload: { orgId: string, wsId: string, qrIds: string[] }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orgId, wsId, qrIds } = body;

    if (!orgId || !wsId || !qrIds || !Array.isArray(qrIds) || qrIds.length === 0) {
      return NextResponse.json({ error: 'Invalid payload. Required: orgId, wsId, qrIds[]' }, { status: 400 });
    }

    if (qrIds.length > 500) {
      return NextResponse.json({ error: 'Maximum batch size is 500' }, { status: 400 });
    }

    const zip = new JSZip();
    const folder = zip.folder('qr-codes');
    if (!folder) throw new Error('Failed to create zip folder');

    // Process in small batches to avoid memory spikes
    const chunkSize = 25;
    for (let i = 0; i < qrIds.length; i += chunkSize) {
      const chunk = qrIds.slice(i, i + chunkSize);
      
      const promises = chunk.map(async (id) => {
        const qr = await getQRCode(orgId, wsId, id);
        if (!qr) return;

        try {
          // Determine the URL to encode. If it's dynamic and has a shortPath, encode the redirect URL.
          const urlToEncode = qr.mode === 'dynamic' && qr.redirectUrl 
            ? `${req.nextUrl.origin}${qr.redirectUrl}`
            : qr.destination?.url || '';

          if (!urlToEncode) return;

          const buffer = await generateQRBuffer(urlToEncode, qr.design);
          
          // Clean filename
          const safeName = qr.slug || `qr-${id}`;
          folder.file(`${safeName}.png`, buffer);
        } catch (err) {
          console.error(`Failed to generate QR ${id}:`, err);
        }
      });

      await Promise.all(promises);
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

    return new NextResponse(zipBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="qr-batch-export-${Date.now()}.zip"`,
      },
    });

  } catch (error) {
    console.error('Batch export error:', error);
    return NextResponse.json({ error: 'Internal server error during batch export' }, { status: 500 });
  }
}
