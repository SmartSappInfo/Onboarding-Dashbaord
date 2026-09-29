// @vitest-environment node
/**
 * @fileOverview Export-sweep guard test (agents_mcp build plan PR-0 §4.0.3; Rules 51, P8).
 *
 * Every export of a `'use server'` module is a public endpoint. This test fails CI when:
 * 1. a NEW export has no verified identity guard and is not on the public allowlist;
 * 2. a baseline entry was fixed (or removed) but not deleted from the baseline — so the list of known
 *    gaps can only shrink and never goes stale;
 * 3. a public-allowlist entry no longer exists.
 *
 * CAUTION: do not "fix" a failure by adding to the baseline. Guard the action, or — only if it is
 * public by design — add it to PUBLIC_SERVER_ACTIONS with a reviewable reason.
 */

import path from 'path';
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import baselineJson from './server-action-guard-baseline.json';
import { PUBLIC_SERVER_ACTIONS } from './public-server-actions';
import { exportKey, sweepRepository, sweepSource } from '../../../../scripts/agentic-inventory/server-action-sweep';

const BaselineSchema = z.object({ knownUnguarded: z.array(z.string()) });
const baseline = new Set(BaselineSchema.parse(baselineJson).knownUnguarded);
const repoRoot = path.resolve(__dirname, '../../../..');

describe('sweepSource (unit)', () => {
  const file = 'src/app/actions/example-actions.ts';

  it('ignores modules without a file-level use server directive', () => {
    expect(sweepSource(file, `export async function a() { return 1; }`)).toEqual([]);
  });

  it('accepts a verified guard in the export or in a same-file helper chain', () => {
    const code = `'use server';
      import { requireWorkspace } from '@/lib/auth/require-auth';
      async function inner(ws: string) { return requireWorkspace(ws); }
      async function outer(ws: string) { return inner(ws); }
      export async function direct(ws: string) { await requireWorkspace(ws); }
      export async function viaHelpers(ws: string) { await outer(ws); }
      export const arrow = async (ws: string) => { await inner(ws); };`;
    expect(sweepSource(file, code).map((e) => [e.name, e.guarded])).toEqual([
      ['direct', true],
      ['viaHelpers', true],
      ['arrow', true],
    ]);
  });

  it('does NOT accept caller-trusting checks such as canUser(userId, …) or checkWorkspaceAccess', () => {
    const code = `'use server';
      export async function create(userId: string, ws: string) {
        await canUser(userId, 'operations', 'tasks', 'create', ws);
        await checkWorkspaceAccess(userId, ws);
      }`;
    expect(sweepSource(file, code)).toEqual([{ file, name: 'create', guarded: false, guards: [] }]);
  });

  it('flags re-exports from a use server module (their bodies are not visible here)', () => {
    const code = `'use server';
      export { doThing } from './elsewhere';`;
    expect(sweepSource(file, code)).toEqual([{ file, name: 'doThing', guarded: false, guards: [] }]);
  });
});

describe('repository sweep', () => {
  const results = sweepRepository(repoRoot);
  const unguarded = results.filter((e) => !e.guarded).map(exportKey);
  const allKeys = new Set(results.map(exportKey));

  it('has no new unguarded server action (guard it, or justify it as public)', () => {
    const unexpected = unguarded.filter((key) => !baseline.has(key) && !(key in PUBLIC_SERVER_ACTIONS));
    expect(unexpected).toEqual([]);
  });

  it('keeps the baseline exact: fixed or removed exports must be deleted from it', () => {
    const unguardedSet = new Set(unguarded);
    const stale = [...baseline].filter((key) => !unguardedSet.has(key));
    expect(stale).toEqual([]);
  });

  it('only lists public actions that still exist', () => {
    const missing = Object.keys(PUBLIC_SERVER_ACTIONS).filter((key) => !allKeys.has(key));
    expect(missing).toEqual([]);
  });

  it('gives every public action a reason', () => {
    const blank = Object.entries(PUBLIC_SERVER_ACTIONS).filter(([, reason]) => reason.trim().length < 20);
    expect(blank).toEqual([]);
  });
});
