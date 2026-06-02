import * as fs from 'fs';
import * as path from 'path';

// Manual env loader
try {
  const envPath = '/Users/josephaidoo/Desktop/Codes/vibe Coding/Onboarding-Dashbaord-main/.env.local';
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const idx = trimmed.indexOf('=');
        if (idx !== -1) {
          const k = trimmed.substring(0, idx).trim();
          const v = trimmed.substring(idx + 1).trim();
          process.env[k] = v;
        }
      }
    });
  }
} catch (e) {
  console.warn('Failed to load env:', e);
}

if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH = path.resolve('/Users/josephaidoo/Desktop/Codes/vibe Coding/Onboarding-Dashbaord-main', process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
}

async function main() {
  console.log('Starting manual dispatch of pending scheduled messages...');
  try {
    const { processScheduledMessages } = await import('/Users/josephaidoo/Desktop/Codes/vibe Coding/Onboarding-Dashbaord-main/src/lib/reminder-actions');
    const { processMeetingInvitations } = await import('/Users/josephaidoo/Desktop/Codes/vibe Coding/Onboarding-Dashbaord-main/src/lib/invitation-actions');

    const [result, invResult] = await Promise.all([
      processScheduledMessages(),
      processMeetingInvitations()
    ]);

    console.log(`\nSuccess! Dispatch Results:`);
    console.log(`- Scheduled Messages: ${result.sent} successfully sent, ${result.failed} failed.`);
    console.log(`- Invitations Series: ${invResult.sent} successfully sent, ${invResult.skipped} skipped, ${invResult.failed} failed.`);

  } catch (err) {
    console.error('Error during manual cron trigger:', err);
  }
}

main();
