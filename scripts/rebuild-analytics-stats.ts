import fs from 'fs';
import path from 'path';

function loadEnv() {
  ['.env', '.env.local'].forEach(file => {
    const envPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      content.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let value = match[2] || '';
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1);
          } else if (value.startsWith("'") && value.endsWith("'")) {
            value = value.slice(1, -1);
          }
          process.env[key] = value.replace(/\\n/g, '\n');
        }
      });
    }
  });
}
loadEnv();

async function rebuildAnalytics() {
  console.log('Dynamically importing firebase-admin after environment load...');
  const { adminDb } = await import('../src/lib/firebase-admin');

  console.log('Starting media share analytics reconstruction...');
  const collectionRef = adminDb.collection('media_share_analytics');
  const snap = await collectionRef.get();
  console.log(`Found ${snap.size} documents to inspect.`);

  for (const doc of snap.docs) {
    const shareId = doc.id;
    console.log(`Processing share ID: ${shareId}`);

    const [eventsSnap, sessionsSnap] = await Promise.all([
      doc.ref.collection('events').get(),
      doc.ref.collection('sessions').get()
    ]);

    const events = eventsSnap.docs.map(d => d.data());
    const sessions = sessionsSnap.docs.map(d => d.data());

    const views = events.filter(e => e.type === 'view').length;
    const mediaPlays = events.filter(e => e.type === 'media_play').length;
    const mediaCompletions = events.filter(e => e.type === 'media_complete').length;
    const mediaHalfway = events.filter(e => e.type === 'media_progress' && e.progressPercent === 50).length;
    const ctaClicks = events.filter(e => e.type === 'cta_click').length;
    const downloads = events.filter(e => e.type === 'download').length;
    const uniqueViews = sessions.length;

    const stats = {
      views,
      uniqueViews,
      mediaPlays,
      mediaCompletions,
      mediaHalfway,
      ctaClicks,
      downloads
    };

    console.log(`Calculated stats for ${shareId}:`, stats);

    await doc.ref.update({ stats });
  }

  console.log('Analytics data recovery complete!');
}

rebuildAnalytics().catch(console.error);
