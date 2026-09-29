/**
 * Runs the agentic behavioural baseline: platform suites + the existing Identity / CRM / Portal
 * suites listed in src/platform/__tests__/baseline/baseline-manifest.json (roadmap Phase 0 exit gate).
 */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const manifest = JSON.parse(readFileSync('src/platform/__tests__/baseline/baseline-manifest.json', 'utf8'));
const targets = [...manifest.platform, ...Object.values(manifest.domains).flat()];
const result = spawnSync('npx', ['vitest', 'run', ...targets, ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(result.status ?? 1);
