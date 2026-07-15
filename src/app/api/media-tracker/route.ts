import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { shareId, sessionId, elapsed, contactId } = body;

    if (!shareId || !sessionId) {
      return NextResponse.json({ error: 'Missing shareId or sessionId' }, { status: 400 });
    }

    const userAgent = request.headers.get('user-agent') || 'Unknown';
    const now = new Date().toISOString();

    const docRef = adminDb
      .collection('media_share_analytics')
      .doc(shareId)
      .collection('sessions')
      .doc(sessionId);

    await adminDb.runTransaction(async (transaction) => {
      const snap = await transaction.get(docRef);
      if (!snap.exists) {
        transaction.set(docRef, {
          sessionId,
          contactId: contactId || null,
          firstSeen: now,
          ctaClicked: false,
          downloaded: false,
          maxProgress: 0,
          sessionTimeSeconds: Number(elapsed) || 0,
          updatedAt: now,
          userAgents: [userAgent],
        });
      } else {
        const data = snap.data() || {};
        const oldAgents = (data.userAgents as string[]) || (data.userAgent ? [data.userAgent] : []);
        const userAgents = oldAgents.includes(userAgent) ? oldAgents : [...oldAgents, userAgent];

        transaction.update(docRef, {
          sessionTimeSeconds: Math.max((data.sessionTimeSeconds as number) || 0, Number(elapsed) || 0),
          updatedAt: now,
          userAgents,
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[MediaTrackerRoute] Failed to save exit session time:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
