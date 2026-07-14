import { NextRequest, NextResponse } from 'next/server';
import { submitStandaloneFormAction } from '@/lib/form-actions';

// CORS response headers helper
const getCorsHeaders = (): Record<string, string> => {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Requested-With',
  };
};

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(),
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const headers = getCorsHeaders();

  try {
    let body: Record<string, string> = {};
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const parsedBody = await req.json() as unknown;
      if (parsedBody && typeof parsedBody === 'object') {
        const bodyObj = parsedBody as Record<string, unknown>;
        Object.keys(bodyObj).forEach((key) => {
          body[key] = String(bodyObj[key]);
        });
      }
    } else {
      // Handle urlencoded or multipart form data
      const formData = await req.formData();
      formData.forEach((value, key) => {
        body[key] = String(value);
      });
    }

    // Extract meta fields
    const { formId, workspaceId, organizationId, redirectUrl, ...formData } = body;

    if (!formId || !workspaceId || !organizationId) {
      return NextResponse.json(
        { success: false, error: 'Missing required configuration fields (formId, workspaceId, organizationId).' },
        { status: 400, headers }
      );
    }

    // Call the server submission function
    const ipAddress = req.headers.get('x-forwarded-for') || '';
    const userAgent = req.headers.get('user-agent') || '';

    const res = await submitStandaloneFormAction(
      formId,
      formData,
      workspaceId,
      organizationId,
      { ipAddress, userAgent }
    );

    if (!res.success) {
      return NextResponse.json(
        { success: false, error: res.error || 'Submission failed' },
        { status: 500, headers }
      );
    }

    // If standard form submit redirectUrl is provided, redirect
    if (redirectUrl) {
      return NextResponse.redirect(new URL(redirectUrl, req.url), 303);
    }

    return NextResponse.json(
      { success: true, submissionId: res.submissionId },
      { status: 200, headers }
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500, headers }
    );
  }
}
