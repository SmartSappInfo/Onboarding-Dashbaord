// @vitest-environment node
/**
 * @fileOverview Client/server boundary for meetings (Phase 11 M1 · T8.5, Rule 52).
 *
 * 1. Server modules that touch Firestore/Storage, signed URLs, consent, retention or provider calls
 *    carry `import 'server-only'` (Next.js then fails any client bundle that imports them).
 * 2. No 'use client' meeting component imports them at runtime (type-only imports are erased).
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
];

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
    const clientFiles = walk(join(ROOT, 'src/app/admin/meetings')).filter((f) => /^['"]use client['"]/.test(readFileSync(f, 'utf8').trimStart()));
    expect(clientFiles.length).toBeGreaterThan(0);
    const violations: string[] = [];
    for (const file of clientFiles) {
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(/^import\s+(type\s+)?[\s\S]*?from\s+['"]([^'"]+)['"];?/gm)) {
        if (m[1]) continue; // `import type` is erased at compile time
        const target = resolveImport(file, m[2]);
        if (target && (SERVER_ONLY_MODULES.includes(target) || target === 'src/lib/firebase-admin.ts')) {
          violations.push(`${file.slice(ROOT.length + 1)} -> ${target}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
