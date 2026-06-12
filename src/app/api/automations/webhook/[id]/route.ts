
import { adminDb } from '@/lib/firebase-admin';
import { triggerAutomationProtocols } from '@/lib/automation-processor';
import { NextResponse, after } from 'next/server';

/**
 * @fileOverview Universal Ingress for External Automation Triggers.
 * Receives POST requests and initiates SmartSapp flows using the request body as payload.
 */

/**
 * Recursively flattens an object to dot-notation keys.
 * Collision-safe: prioritizes deeper nested values over flat keys.
 */
function flattenObject(obj: any, prefix = '', res: Record<string, any> = {}): Record<string, any> {
  if (!obj || typeof obj !== 'object') return res;

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flattenObject(value, newKey, res);
    } else {
      res[newKey] = value;
    }
  }
  return res;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: automationId } = await params;

  console.log(`>>> [WEBHOOK:INGRESS] Payload received for Automation ID: ${automationId}`);

  const url = new URL(req.url);
  const query = Object.fromEntries(url.searchParams.entries());

  const headersObj: Record<string, string> = {};
  req.headers.forEach((val, key) => {
    if (!key.startsWith('x-cf-') && !key.startsWith('x-forwarded-') && !key.startsWith('x-real-')) {
      headersObj[key] = val;
    }
  });

  let body: any = {};
  const files: any[] = [];
  const contentType = req.headers.get('content-type') || '';

  try {
    if (contentType.includes('application/json')) {
      body = await req.json();
    } else if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      formData.forEach((value, key) => {
        if (value instanceof File) {
          files.push({
            name: value.name,
            size: value.size,
            type: value.type,
            capturedAt: new Date().toISOString()
          });
        } else {
          body[key] = value;
        }
      });
    }
  } catch (parseError: any) {
    console.warn('[WEBHOOK] Payload parsing warning:', parseError.message);
  }

  try {
    // 1. Verify Automation Existence & Trigger Config
    const autoRef = adminDb.collection('automations').doc(automationId);
    const autoSnap = await autoRef.get();

    if (!autoSnap.exists) {
      return NextResponse.json({ error: 'Automation blueprint not found' }, { status: 404 });
    }

    const automation = autoSnap.data();
    if (!automation) {
      return NextResponse.json({ error: 'Automation blueprint not found' }, { status: 404 });
    }
    const hasWebhookTrigger = 
      automation.trigger === 'WEBHOOK_RECEIVED' ||
      automation.triggerTypes?.includes('WEBHOOK_RECEIVED') ||
      automation.triggers?.some((t: any) => t.type === 'WEBHOOK_RECEIVED');

    if (automation.isActive && !hasWebhookTrigger) {
      return NextResponse.json({ error: 'This automation is not configured for webhook ingress' }, { status: 400 });
    }

    const workspaceId = automation.workspaceIds?.[0] || '';
    if (!workspaceId) {
      return NextResponse.json({ error: 'Automation is not associated with any workspace' }, { status: 400 });
    }
    const organizationId = automation.organizationId || 'default';

    const timestamp = new Date().toISOString();
    const latestCapturedWebhook = {
      body,
      headers: headersObj,
      query,
      files,
      capturedAt: timestamp
    };

    // 2. Update Captured Webhook Payload in Firestore
    await autoRef.update({ latestCapturedWebhook });

    // 3. Trigger Flow Background Execution ONLY if active
    if (automation.isActive) {
      const flattened = flattenObject(body);
      const payload = {
        body,
        ...body,
        ...flattened,
        workspaceId,
        organizationId,
        ingressId: automationId,
        source: 'external_webhook',
        headers: headersObj,
        query,
        files
      };

      after(async () => {
        try {
          await triggerAutomationProtocols('WEBHOOK_RECEIVED', payload);
        } catch (err: any) {
          console.error(`>>> [WEBHOOK:INGRESS] Async trigger failed for ${automationId}:`, err.message);
        }
      });

      return NextResponse.json({ 
        status: 'accepted', 
        receivedAt: timestamp,
        ingressId: automationId 
      });
    }

    return NextResponse.json({ 
      status: 'captured', 
      receivedAt: timestamp,
      ingressId: automationId 
    });

  } catch (error: any) {
    console.error(">>> [WEBHOOK:INGRESS] CRITICAL FAILURE:", error.message);
    return NextResponse.json({ error: 'Logical Ingress Failure', details: error.message }, { status: 500 });
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: automationId } = await params;

  console.log(`>>> [WEBHOOK:INGRESS] GET request received for Automation ID: ${automationId}`);

  const url = new URL(req.url);
  const query = Object.fromEntries(url.searchParams.entries());

  const headersObj: Record<string, string> = {};
  req.headers.forEach((val, key) => {
    if (!key.startsWith('x-cf-') && !key.startsWith('x-forwarded-') && !key.startsWith('x-real-')) {
      headersObj[key] = val;
    }
  });

  const body = { ...query };
  const files: any[] = [];

  try {
    const autoRef = adminDb.collection('automations').doc(automationId);
    const autoSnap = await autoRef.get();

    if (!autoSnap.exists) {
      const acceptHeader = req.headers.get('accept') || '';
      if (acceptHeader.includes('text/html')) {
        return new NextResponse(
          `<html>
            <head>
              <title>Automation Not Found</title>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #09090b; color: #f4f4f5; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                .card { background: #18181b; border: 1px solid #27272a; padding: 2.5rem; border-radius: 1.5rem; max-width: 400px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
                h1 { color: #ef4444; font-size: 1.5rem; margin-top: 0; }
                p { color: #a1a1aa; font-size: 0.875rem; line-height: 1.5; }
              </style>
            </head>
            <body>
              <div class="card">
                <h1>Automation Blueprint Not Found</h1>
                <p>The webhook ingress URL points to an automation that does not exist or has been deleted.</p>
              </div>
            </body>
          </html>`,
          { headers: { 'content-type': 'text/html' }, status: 404 }
        );
      }
      return NextResponse.json({ error: 'Automation blueprint not found' }, { status: 404 });
    }

    const automation = autoSnap.data();
    if (!automation) {
      return NextResponse.json({ error: 'Automation blueprint not found' }, { status: 404 });
    }
    const hasWebhookTrigger = 
      automation.trigger === 'WEBHOOK_RECEIVED' ||
      automation.triggerTypes?.includes('WEBHOOK_RECEIVED') ||
      automation.triggers?.some((t: any) => t.type === 'WEBHOOK_RECEIVED');

    if (automation.isActive && !hasWebhookTrigger) {
      return NextResponse.json({ error: 'This automation is not configured for webhook ingress' }, { status: 400 });
    }

    const workspaceId = automation.workspaceIds?.[0] || '';
    if (!workspaceId) {
      return NextResponse.json({ error: 'Automation is not associated with any workspace' }, { status: 400 });
    }
    const organizationId = automation.organizationId || 'default';

    const timestamp = new Date().toISOString();
    const latestCapturedWebhook = {
      body,
      headers: headersObj,
      query,
      files,
      capturedAt: timestamp
    };

    await autoRef.update({ latestCapturedWebhook });

    if (automation.isActive) {
      const flattened = flattenObject(body);
      const payload = {
        body,
        ...body,
        ...flattened,
        workspaceId,
        organizationId,
        ingressId: automationId,
        source: 'external_webhook',
        headers: headersObj,
        query,
        files
      };

      after(async () => {
        try {
          await triggerAutomationProtocols('WEBHOOK_RECEIVED', payload);
        } catch (err: any) {
          console.error(`>>> [WEBHOOK:INGRESS] Async GET trigger failed for ${automationId}:`, err.message);
        }
      });
    }

    const acceptHeader = req.headers.get('accept') || '';
    if (acceptHeader.includes('text/html')) {
      return new NextResponse(
        `<!DOCTYPE html>
        <html>
          <head>
            <title>Webhook Received Successfully</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                background-color: #030712;
                background-image: 
                  radial-gradient(at 0% 0%, rgba(59, 130, 246, 0.08) 0px, transparent 50%),
                  radial-gradient(at 100% 100%, rgba(16, 185, 129, 0.05) 0px, transparent 50%);
                color: #f3f4f6;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                margin: 0;
                padding: 1rem;
                box-sizing: border-box;
              }
              .card {
                background: rgba(17, 24, 39, 0.7);
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                border: 1px solid rgba(255, 255, 255, 0.08);
                padding: 3rem 2rem;
                border-radius: 2rem;
                max-width: 440px;
                width: 100%;
                text-align: center;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
                box-sizing: border-box;
              }
              .icon-container {
                width: 72px;
                height: 72px;
                background: rgba(16, 185, 129, 0.1);
                border: 1px solid rgba(16, 185, 129, 0.2);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 1.5rem auto;
              }
              .icon {
                color: #10b981;
                font-size: 2.2rem;
                font-weight: bold;
              }
              h1 {
                font-size: 1.35rem;
                font-weight: 700;
                margin: 0 0 0.5rem 0;
                background: linear-gradient(135deg, #fff 0%, #a1a1aa 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
              }
              p {
                color: #9ca3af;
                font-size: 0.875rem;
                line-height: 1.6;
                margin: 0 0 2rem 0;
              }
              .details {
                background: rgba(0, 0, 0, 0.2);
                border-radius: 1rem;
                padding: 1rem;
                text-align: left;
                font-size: 0.75rem;
                border: 1px solid rgba(255, 255, 255, 0.03);
              }
              .row {
                display: flex;
                justify-content: space-between;
                padding: 0.35rem 0;
                border-bottom: 1px solid rgba(255, 255, 255, 0.03);
              }
              .row:last-child {
                border-bottom: none;
              }
              .key {
                color: #6b7280;
                font-family: monospace;
              }
              .val {
                color: #e5e7eb;
                font-family: monospace;
                max-width: 200px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              }
            </style>
          </head>
          <body>
            <div class="card">
              <div class="icon-container">
                <div class="icon">✓</div>
              </div>
              <h1>Webhook Captured</h1>
              <p>Your request has been successfully recorded in expectant capture mode and automation protocols triggered.</p>
              ${Object.keys(query).length > 0 ? `
              <div class="details">
                ${Object.entries(query).map(([k, v]) => `
                  <div class="row">
                    <span class="key">${k}</span>
                    <span class="val" title="${v}">${v}</span>
                  </div>
                `).join('')}
              </div>
              ` : ''}
            </div>
          </body>
        </html>`,
        { headers: { 'content-type': 'text/html' } }
      );
    }

    return NextResponse.json({ 
      status: automation.isActive ? 'accepted' : 'captured', 
      receivedAt: timestamp,
      ingressId: automationId 
    });

  } catch (error: any) {
    console.error(">>> [WEBHOOK:INGRESS] GET FAILURE:", error.message);
    return NextResponse.json({ error: 'Logical Ingress Failure', details: error.message }, { status: 500 });
  }
}
