import { NextResponse } from 'next/server';
import { runAutomationById } from '@/lib/automation-processor';

export async function POST(req: Request) {
  try {
    const { automationId, entityId, entityType, workspaceId, payload } = await req.json();

    if (!automationId || !entityId || !workspaceId) {
      return NextResponse.json({ error: 'Missing required parameters (automationId, entityId, workspaceId)' }, { status: 400 });
    }

    const triggerPayload = {
      entityId,
      entityType: entityType || 'contact',
      workspaceId,
      ...payload,
      startedBy: 'manual_enrollment',
    };

    await runAutomationById(automationId, triggerPayload);

    return NextResponse.json({ success: true, message: 'Entity successfully enrolled in automation.' });
  } catch (error: any) {
    console.error('[ENROLL_AUTOMATION_ROUTE] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to enroll entity' }, { status: 500 });
  }
}
