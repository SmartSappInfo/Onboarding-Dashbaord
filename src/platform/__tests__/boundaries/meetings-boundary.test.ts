// @vitest-environment node
/**
 * @fileOverview Client/server boundary for meetings (Phase 11 M1 · T8.5, Rule 52).
 *
 * 1. Server modules that touch Firestore/Storage, signed URLs, consent, retention or provider calls
 *    carry `import 'server-only'` (Next.js then fails any client bundle that imports them).
 * 2. No 'use client' meeting component imports them at runtime (type-only imports are erased).
 *    Since M2 · T6 any file marked `server-only` counts, and the messaging composer (which opens
 *    meeting follow-up drafts) is scanned too.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';

const ROOT = process.cwd();
const SERVER_ONLY_MODULES = [
  'src/lib/meetings/meeting-access.ts',
  'src/lib/meetings/meeting-auth.ts',
  'src/lib/meetings/meeting-read-service.ts',
  'src/lib/meetings/compliance-policy-store.ts',
  'src/lib/meetings/transcript-store.ts',
  'src/lib/meetings/transcript-ingestion.ts',
  'src/lib/meetings/transcript-upload.ts',
  'src/lib/meetings/docx-guard.ts',
  'src/lib/meetings/consent-store.ts',
  'src/lib/meetings/retention-service.ts',
  'src/lib/meetings/transcription-service.ts',
  'src/lib/meetings/transcription-request.ts',
  'src/lib/meetings/gemini-transcription-provider.ts',
  // M2 · T3–T6
  'src/lib/meetings/intelligence/intelligence-model.ts',
  'src/lib/meetings/intelligence/followup-tasks.ts',
  'src/lib/meetings/intelligence/followup-drafts.ts',
  'src/lib/meetings/intelligence/followup-recipients.ts',
  'src/lib/meetings/intelligence/crm-proposals.ts',
  'src/lib/meetings/intelligence/shadow.ts',
];
const CLIENT_DIRS = ['src/app/admin/meetings', 'src/app/admin/messaging/composer'];

const isServerOnly = (file: string) => {
  try {
    return /^import 'server-only';/m.test(readFileSync(join(ROOT, file), 'utf8'));
  } catch {
    return false;
  }
};

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : /\.(tsx?|jsx?)$/.test(name) ? [full] : [];
  });
}

function resolveImport(fromFile: string, spec: string): string | null {
  const base = spec.startsWith('@/') ? join(ROOT, 'src', spec.slice(2)) : spec.startsWith('.') ? resolve(dirname(fromFile), spec) : null;
  if (!base) return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
    try {
      if (statSync(candidate).isFile()) return candidate.slice(ROOT.length + 1);
    } catch {
      // try the next candidate
    }
  }
  return null;
}

describe('meetings client/server boundary', () => {
  it('server modules declare server-only', () => {
    for (const file of SERVER_ONLY_MODULES) {
      expect(readFileSync(join(ROOT, file), 'utf8'), file).toMatch(/^import 'server-only';/m);
    }
  });

  it('client components never import server modules at runtime', () => {
    const clientFiles = CLIENT_DIRS.flatMap((d) => walk(join(ROOT, d))).filter((f) => /^['"]use client['"]/.test(readFileSync(f, 'utf8').trimStart()));
    expect(clientFiles.length).toBeGreaterThan(0);
    const violations: string[] = [];
    for (const file of clientFiles) {
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(/^import\s+(type\s+)?[\s\S]*?from\s+['"]([^'"]+)['"];?/gm)) {
        if (m[1]) continue; // `import type` is erased at compile time
        const target = resolveImport(file, m[2]);
        if (target && (SERVER_ONLY_MODULES.includes(target) || target === 'src/lib/firebase-admin.ts' || isServerOnly(target))) {
          violations.push(`${file.slice(ROOT.length + 1)} -> ${target}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});

describe('meeting outcomes panel (M2 · T6.5)', () => {
  it('the panel and brief card are lazy-loaded by the intelligence tab', () => {
    const tab = readFileSync(join(ROOT, 'src/app/admin/meetings/[id]/components/MeetingIntelligenceTab.tsx'), 'utf8');
    expect(tab).toMatch(/dynamic\(\(\) => import\('\.\/outcomes\/MeetingOutcomesPanel'\)/);
    expect(tab).toMatch(/dynamic\(\(\) => import\('\.\/outcomes\/MeetingBriefCard'\)/);
    expect(tab).not.toMatch(/^import .*outcomes\/MeetingOutcomesPanel/m);
  });
});
