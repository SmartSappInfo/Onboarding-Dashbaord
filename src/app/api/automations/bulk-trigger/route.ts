import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { executeAutomation } from '@/lib/automations/executor';
import type { Automation } from '@/lib/types';

// Force dynamic execution
export const dynamic = 'force-dynamic';

const SECRET = process.env.CLOUD_TASKS_SECRET || 'local-secret';

interface TargetPayload {
  entityId: string;
  entityType: 'contact' | 'deal' | 'company';
  payload: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Security Check: Validate Secret Header Handshake
    const clientSecret = request.headers.get('x-cloud-tasks-secret');
    if (!clientSecret || clientSecret !== SECRET) {
      console.warn('[BULK-TRIGGER-WORKER] Unauthorized request attempt.');
      return NextResponse.json({ error: 'Unauthorized handshake signature' }, { status: 401 });
    }

    // 2. Parse payload details
    const body = await request.json();
    const { automationId, workspaceId, organizationId, trigger, targets } = body as {
      automationId?: string;
      workspaceId?: string;
      organizationId?: string;
      trigger?: string;
      targets?: TargetPayload[];
    };

    if (!automationId || !workspaceId || !organizationId || !trigger || !targets || !Array.isArray(targets)) {
      return NextResponse.json({ error: 'Missing automationId, workspaceId, organizationId, trigger, or targets' }, { status: 400 });
    }

    if (targets.length === 0) {
      return NextResponse.json({ success: true, processedCount: 0 });
    }

    // 3. Resolve target automation
    const autoRef = adminDb.collection('automations').doc(automationId);
    const autoSnap = await autoRef.get();
    if (!autoSnap.exists) {
      return NextResponse.json({ error: 'Automation not found' }, { status: 404 });
    }
    const automation = { id: autoSnap.id, ...autoSnap.data() } as Automation;

    // Security Check: Validate automation tenant ownership
    if (automation.workspaceIds?.length && !automation.workspaceIds.includes(workspaceId)) {
      console.warn(`[SecurityAlert] Automation ${automationId} is not associated with workspace ${workspaceId}.`);
      return NextResponse.json({ error: 'Unauthorized automation-workspace mapping' }, { status: 403 });
    }

    // 4. Security Check: Validate tenant isolation for all targets in a single database batch read
    const docRefs = targets.map((t) => adminDb.collection('entities').doc(t.entityId));
    const docSnaps = docRefs.length > 0 ? await adminDb.getAll(...docRefs) : [];

    const finalTargets = targets.map((target, idx) => {
      const snap = docSnaps[idx];
      if (!snap || !snap.exists) {
        console.warn(`[BULK-TRIGGER-WORKER] Target entity ${target.entityId} does not exist. Skipping.`);
        return null;
      }
      const data = snap.data();
      if (data?.workspaceId !== workspaceId) {
        console.warn(`[SecurityAlert] Tenant mismatch for entity ${target.entityId}. Expected workspace ${workspaceId}, found ${data?.workspaceId}. Skipping.`);
        return null;
      }
      return target;
    }).filter((t): t is TargetPayload => t !== null);

    if (finalTargets.length === 0) {
      return NextResponse.json({ success: true, processedCount: 0, warning: 'No valid targets matched the requested workspace tenant.' });
    }

    console.info(`[BULK-TRIGGER-WORKER] Enrolling ${finalTargets.length} contacts into automation ${automationId}`);

    // 5. Enroll validated targets concurrently
    await Promise.all(
      finalTargets.map(async (target) => {
        const enrichedPayload = {
          ...target.payload,
          entityId: target.entityId,
          entityType: target.entityType,
          workspaceId,
          organizationId,
          _firingTrigger: trigger,
        };
        try {
          await executeAutomation(automation, enrichedPayload);
        } catch (err) {
          console.error(`[BULK-TRIGGER-WORKER] Execution failed for contact ${target.entityId} in automation ${automationId}:`, err);
        }
      })
    );

    return NextResponse.json({ success: true, processedCount: finalTargets.length });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[BULK-TRIGGER-WORKER] Unhandled exception processing trigger tasks:', err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
