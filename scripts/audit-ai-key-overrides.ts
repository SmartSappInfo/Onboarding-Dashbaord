/**
 * Read-only audit: which organizations hold a per-org AI key override? (audit F1 / Phase 0)
 *
 * Rotation is easy to get wrong here. `src/ai/genkit.ts` resolves a provider key through a
 * four-step precedence chain, and an organization document wins over EVERYTHING — over the
 * sealed backoffice global at `system_settings/ai_keys`, and over `process.env`. So
 * rotating the environment variable, or even the backoffice value, can silently change
 * nothing for any tenant holding its own key.
 *
 * These org-level values are also stored in PLAINTEXT, unlike the backoffice global which
 * is sealed with `sealSecret`.
 *
 * Prints only presence and the last four characters — never a usable key.
 *
 *   pnpm tsx scripts/audit-ai-key-overrides.ts
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const FIELDS = ['geminiApiKey', 'claudeApiKey', 'openRouterApiKey'] as const;

function hint(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) return '';
  if (value.startsWith('{') || value.includes('"ciphertext"')) return 'sealed';
  return `plaintext …${value.slice(-4)}`;
}

async function run() {
  const { adminDb } = await import('../src/lib/firebase-admin');

  const snap = await adminDb.collection('organizations').get();
  const rows: Array<{ org: string; name: string; field: string; state: string }> = [];

  for (const doc of snap.docs) {
    const data = doc.data();
    for (const f of FIELDS) {
      const h = hint(data?.[f]);
      if (h) rows.push({ org: doc.id, name: data?.name ?? '(unnamed)', field: f, state: h });
    }
  }

  console.log(`\nScanned ${snap.size} organizations.\n`);
  if (rows.length === 0) {
    console.log('No per-org AI key overrides found.');
    console.log('Rotation only needs the backoffice global + process.env.\n');
  } else {
    console.log(`${rows.length} override(s) found — EACH must be updated individually:\n`);
    for (const r of rows) {
      console.log(`  ${r.org.padEnd(28)} ${r.name.padEnd(24)} ${r.field.padEnd(18)} ${r.state}`);
    }
    console.log('\nUpdate via Settings -> Integrations for each organization above.');
    console.log('Until then, those tenants keep using the old (leaked) key.\n');
  }

  // The sealed global, for completeness.
  const globalDoc = await adminDb.collection('system_settings').doc('ai_keys').get();
  if (globalDoc.exists) {
    const g = globalDoc.data() ?? {};
    console.log('Backoffice global (system_settings/ai_keys):');
    for (const f of FIELDS) console.log(`  ${f.padEnd(18)} ${hint(g[f]) || '(not set)'}`);
    console.log('  -> rotate at /backoffice/settings/system-defaults\n');
  }
  process.exit(0);
}

run().catch((err) => {
  console.error('Audit failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
