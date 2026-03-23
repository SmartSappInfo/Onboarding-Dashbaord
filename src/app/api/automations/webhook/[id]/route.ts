
import { adminDb } from '@/lib/firebase-admin';
import { triggerAutomationProtocols } from '@/lib/automation-processor';
import { NextResponse } from 'next/server';

/**
 * @fileOverview Universal Ingress for External Automation Triggers.
 * Receives POST requests and initiates SmartSapp flows using the request body as payload.
 */

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: automationId } = await params;

  console.log(`>>> [WEBHOOK:INGRESS] Payload received for Automation ID: ${automationId}`);

  try {
    const payload = await req.json();

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

    // 2. Direct Trigger Call
    // We pass the automation record directly to avoid redundant lookups in the processor
    // triggerAutomationProtocols normally searches by trigger type, but here we have a specific ID
    
    const timestamp = new Date().toISOString();
    
    // We use the triggerAutomationProtocols but with a specific filter for THIS automation only if possible
    // For now, we utilize the standard event bus logic
    await triggerAutomationProtocols('WEBHOOK_RECEIVED', {
        ...payload,
        ingressId: automationId,
        source: 'external_webhook'
    });

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
