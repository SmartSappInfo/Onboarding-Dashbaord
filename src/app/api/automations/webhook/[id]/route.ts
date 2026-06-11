
import { adminDb } from '@/lib/firebase-admin';
import { triggerAutomationProtocols } from '@/lib/automation-processor';
import { NextResponse } from 'next/server';

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

  try {
    const rawPayload = await req.json();

    // 1. Verify Automation Existence & Status
    const autoRef = adminDb.collection('automations').doc(automationId);
    const autoSnap = await autoRef.get();

    if (!autoSnap.exists) {
      return NextResponse.json({ error: 'Automation blueprint not found' }, { status: 404 });
    }

    const automation = autoSnap.data();
    if (!automation?.isActive) {
      return NextResponse.json({ error: 'Automation is currently inactive' }, { status: 403 });
    }

    if (automation.trigger !== 'WEBHOOK_RECEIVED') {
      return NextResponse.json({ error: 'This automation is not configured for webhook ingress' }, { status: 400 });
    }

    const workspaceId = automation.workspaceIds?.[0] || '';
    if (!workspaceId) {
      return NextResponse.json({ error: 'Automation is not associated with any workspace' }, { status: 400 });
    }
    const organizationId = automation.organizationId || 'default';

    // 2. Flatten and Enrich Payload
    const flattened = flattenObject(rawPayload);
    const payload = {
      ...rawPayload,
      ...flattened,
      workspaceId,
      organizationId,
      ingressId: automationId,
      source: 'external_webhook'
    };

    // 3. Direct Trigger Call
    const timestamp = new Date().toISOString();
    await triggerAutomationProtocols('WEBHOOK_RECEIVED', payload);

    return NextResponse.json({ 
        status: 'accepted', 
        receivedAt: timestamp,
        ingressId: automationId 
    });

  } catch (error: any) {
    console.error(">>> [WEBHOOK:INGRESS] CRITICAL FAILURE:", error.message);
    return NextResponse.json({ error: 'Logical Ingress Failure', details: error.message }, { status: 500 });
  }
}

/**
 * Handle GET/OPTIONS for simple connectivity checks.
 */
export async function GET() {
    return NextResponse.json({ 
        status: 'online', 
        protocol: 'SmartSapp Webhook Ingress',
        method: 'POST REQUIRED' 
    });
}
