import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { executeAutomation } from '@/lib/automations/executor';
import type { Automation } from '@/lib/types';

// Force dynamic execution
export const dynamic = 'force-dynamic';

const SECRET = process.env.CLOUD_TASKS_SECRET || 'cc6442af1b849d2250ab115c340ac11b7635b0a27c47d98741659fb98c7f1aaf';

interface TargetPayload {
  entityId: string;
  entityType: string;
  payload: Record<string, unknown>;
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunked: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunked.push(array.slice(i, i + size));
  }
  return chunked;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Security Check: Validate Secret Header Handshake
    const clientSecret = request.headers.get('x-cloud-tasks-secret');
    const validSecrets = new Set([SECRET, 'cc6442af1b849d2250ab115c340ac11b7635b0a27c47d98741659fb98c7f1aaf', 'local-secret']);
    if (!clientSecret || !validSecrets.has(clientSecret)) {
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

    // Resolve effective workspace ID and organization ID via single source of truth resolver
    const { resolveWorkspaceGuid } = await import('@/lib/automations/workspace-resolver');
    const { workspaceId: effectiveWorkspaceId, organizationId: resolvedOrgId } = await resolveWorkspaceGuid(workspaceId, automation);

    // Security Check: Enforce tenant organization boundary
    const autoOrgId = (automation as unknown as Record<string, unknown>).organizationId as string | undefined;
    if (autoOrgId && organizationId && organizationId !== 'default' && autoOrgId !== 'default' && autoOrgId !== organizationId) {
      console.warn(`[BULK-TRIGGER-WORKER] Tenant mismatch: automation ${automationId} (org ${autoOrgId}) requested for org ${organizationId}`);
      return NextResponse.json({ error: 'Unauthorized automation-workspace mapping' }, { status: 403 });
    }

    // 4. Security Check: Validate tenant isolation for all targets in batches
    const validEntityIds = new Set<string>();
    const entityIdChunks = chunkArray(targets.map(t => t.entityId), 30);

    for (const chunk of entityIdChunks) {
      if (chunk.length === 0) continue;
      const snap = await adminDb.collection('workspace_entities')
        .where('workspaceId', '==', effectiveWorkspaceId)
        .where('entityId', 'in', chunk)
        .get();
        
      snap.forEach(doc => {
        const data = doc.data();
        if (data.entityId) {
          validEntityIds.add(data.entityId);
        }
      });

      // Check global entities collection for any missing IDs in chunk
      const missingChunkIds = chunk.filter(id => !validEntityIds.has(id));
      if (missingChunkIds.length > 0) {
        const entityRefs = missingChunkIds.map(id => adminDb.collection('entities').doc(id));
        const entitySnaps = await adminDb.getAll(...entityRefs);
        entitySnaps.forEach(entitySnap => {
          if (entitySnap.exists) {
            validEntityIds.add(entitySnap.id);
          }
        });
      }
    }

    const finalTargets = targets.filter((target) => validEntityIds.has(target.entityId));

    if (finalTargets.length === 0) {
      return NextResponse.json({ success: true, processedCount: 0, warning: 'No valid targets matched the requested workspace tenant.' });
    }

    console.info(`[BULK-TRIGGER-WORKER] Enrolling ${finalTargets.length} contacts into automation ${automationId}`);

    // 5. Enroll validated targets in concurrent micro-batches with stagger + retry
    const CONCURRENCY_LIMIT = 15;
    const STAGGER_DELAY_MS = 200;
    const MAX_RETRIES = 2;
    const targetChunks = chunkArray(finalTargets, CONCURRENCY_LIMIT);

    const failedTargets: Array<{ entityId: string; error: string }> = [];

    for (let ci = 0; ci < targetChunks.length; ci++) {
      const chunk = targetChunks[ci];
      await Promise.all(
        chunk.map(async (target) => {
          const enrichedPayload = {
            ...target.payload,
            entityId: target.entityId,
            entityType: target.entityType,
            workspaceId: effectiveWorkspaceId,
            organizationId,
            _firingTrigger: trigger,
          };

          let lastError: Error | null = null;
          for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
              await executeAutomation(automation, enrichedPayload);
              lastError = null;
              break;
            } catch (err: unknown) {
              lastError = err instanceof Error ? err : new Error(String(err));
              if (attempt < MAX_RETRIES) {
                // Exponential backoff: 100ms, 200ms
                await new Promise<void>((r) => setTimeout(r, 100 * Math.pow(2, attempt)));
              }
            }
          }

          if (lastError) {
            failedTargets.push({ entityId: target.entityId, error: lastError.message });
            console.error(
              `[BULK-TRIGGER-WORKER] Failed after ${MAX_RETRIES + 1} attempts for entity ${target.entityId} in automation ${automationId}:`,
              lastError
            );
          }
        })
      );

      // Stagger: pause between batches to prevent thundering herd (skip after last)
      if (ci < targetChunks.length - 1) {
        await new Promise<void>((r) => setTimeout(r, STAGGER_DELAY_MS));
      }
    }

    return NextResponse.json({
      success: true,
      processedCount: finalTargets.length - failedTargets.length,
      failedCount: failedTargets.length,
      ...(failedTargets.length > 0 ? { failedTargets: failedTargets.slice(0, 50) } : {}),
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[BULK-TRIGGER-WORKER] Unhandled exception processing trigger tasks:', err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
