
import { adminDb } from '@/lib/firebase-admin';
import { NextResponse } from 'next/server';

/**
 * @fileOverview Webhook receiver for Resend events.
 * Listens for: email.delivered, email.opened, email.clicked, email.bounced.
 */

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const { type, data } = payload;

    if (!type || !data || !data.email_id) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const providerId = data.email_id;
    console.log(`>>> [WEBHOOK:RESEND] Event: ${type}, ID: ${providerId}`);

    // 1. Locate the log(s) associated with this provider ID
    const logsCol = adminDb.collection('message_logs');
    const querySnap = await logsCol.where('providerId', '==', providerId).limit(1).get();

    if (querySnap.empty) {
      console.warn(`>>> [WEBHOOK:RESEND] No internal log found for ID: ${providerId}`);
      return NextResponse.json({ status: 'ignored' });
    }

    const logDoc = querySnap.docs[0];
    const logData = logDoc.data();

    // 2. Map Resend events to internal status and counters
    const updates: any = {
      providerStatus: type.replace('email.', ''),
      updatedAt: new Date().toISOString()
    };

    if (type === 'email.delivered') {
        updates.status = 'sent';
    } else if (type === 'email.bounced') {
        updates.status = 'failed';
        updates.error = 'Bounced by recipient mail server';
    } else if (type === 'email.opened') {
        updates.openedCount = (logData.openedCount || 0) + 1;
    } else if (type === 'email.clicked') {
        updates.clickedCount = (logData.clickedCount || 0) + 1;
    }

    // 3. Persist the update
    await logDoc.ref.update(updates);

    return NextResponse.json({ status: 'success' });

  } catch (error: any) {
    console.error(">>> [WEBHOOK:RESEND] CRITICAL ERROR:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
