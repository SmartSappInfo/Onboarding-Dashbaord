import { NextRequest } from 'next/server';
import { requireOrgAdmin } from '@/lib/auth/require-org-admin';
import { WhatsAppCredentialRepository } from '@/lib/whatsapp/whatsapp-credential-repository';
import { MetaCloudApiClient } from '@/lib/whatsapp/meta-cloud-client';
import { validateHeaderMedia } from '@/lib/whatsapp/whatsapp-domain';

// firebase-admin + Meta upload need full Node.
export const runtime = 'nodejs';

/**
 * POST — upload a WhatsApp template header media file (multipart/form-data) and
 * return the Meta `header_handle`. This is a route handler (not a Server Action)
 * deliberately: Server Actions are capped at `bodySizeLimit: 2mb`, too small for
 * real media. Auth is verified INSIDE via a Bearer ID token (header-based → no
 * CSRF surface). The file size is checked BEFORE buffering into memory.
 *
 * Body shape mirrors the action `ActionResult`: `{ success, handle?, format?, error? }`.
 */
export async function POST(req: NextRequest) {
  const idToken = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ success: false, error: 'Bad form data.' }, { status: 400 });
  }

  const organizationId = String(form.get('organizationId') ?? '');
  const file = form.get('file');
  if (!(file instanceof File)) {
    return Response.json({ success: false, error: 'No file provided.' }, { status: 400 });
  }

  try {
    await requireOrgAdmin(idToken, organizationId);

    const appId = process.env.META_APP_ID;
    if (!appId) {
      return Response.json(
        { success: false, error: 'Media headers require META_APP_ID to be configured on the server.' },
        { status: 400 },
      );
    }

    // Validate against file.size FIRST — never buffer an oversized file.
    // NOTE: file.type is client-supplied and could be spoofed; we don't sniff
    // magic bytes — Meta validates the actual content on use and rejects a lie.
    const check = validateHeaderMedia(file.type, file.size);
    if (!check.valid || !check.format) {
      return Response.json({ success: false, error: check.error }, { status: 400 });
    }

    const creds = await WhatsAppCredentialRepository.getCredentials(organizationId);
    if (!creds) {
      return Response.json({ success: false, error: 'No WhatsApp connection configured.' }, { status: 400 });
    }

    const data = new Uint8Array(await file.arrayBuffer());
    const handle = await new MetaCloudApiClient(creds).uploadResumable({
      appId,
      fileName: file.name,
      fileType: file.type,
      data,
    });
    return Response.json({ success: true, handle, format: check.format });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Upload failed.';
    const status = /unauthor|forbidden/i.test(msg) ? 401 : 500;
    return Response.json({ success: false, error: msg }, { status });
  }
}
