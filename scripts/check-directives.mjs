#!/usr/bin/env node
/**
 * Fails if a 'use client' / 'use server' directive is not the first statement in its file.
 *
 * Why this exists (audit, Phase 6): an automated codemod inserted imports above the
 * directive in four files. That is not a syntax error and not a type error — `tsc` and the
 * full 4,296-test suite both passed. It silently demotes the module: a 'use server' file
 * stops being a Server Action module and its server-only dependencies (genkit, express)
 * get pulled into the client bundle. Only `next build` caught it.
 *
 * Cheap to check, expensive to miss.
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const DIRECTIVE = /^\s*['"]use (client|server)['"]\s*;?\s*$/;
const files = execSync(
  `grep -rlE "use (client|server)" src --include=*.ts --include=*.tsx || true`,
  { encoding: 'utf8' }
).split('\n').filter(Boolean);

const bad = [];
for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');
  const idx = lines.findIndex((l) => DIRECTIVE.test(l));
  if (idx <= 0) continue;
  for (let i = 0; i < idx; i++) {
    const s = lines[i].trim();
    if (!s || s.startsWith('//') || s.startsWith('/*') || s.startsWith('*')) continue;
    bad.push(`${file}:${i + 1}  code precedes the directive on line ${idx + 1}`);
    break;
  }
}

if (bad.length) {
  console.error('Misplaced "use client"/"use server" directives:\n' + bad.map((b) => '  ' + b).join('\n'));
  process.exit(1);
}
console.log(`checked ${files.length} files: all directives are the first statement`);
