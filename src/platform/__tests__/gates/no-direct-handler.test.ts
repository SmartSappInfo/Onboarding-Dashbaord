// @vitest-environment node
/**
 * @fileOverview Grep gate: capabilities execute only through the governed gateway (Phase 11 M0 · T3,
 * findings F3/B6; Rule 69).
 *
 * Any `.handler(` call outside the allowlist fails this test. The allowlist is a RATCHET:
 * - entries marked `not-a-capability` are other kinds of handlers (event subscribers, legacy tools);
 * - entries marked `debt` are known bypasses still to migrate (M0 T3.6/3.7). Their counts may only
 *   go DOWN; when a file reaches zero, delete its entry (the test fails on stale entries).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

const ALLOWLIST: Record<string, { count: number; reason: 'gateway' | 'not-a-capability' | 'debt' }> = {
  'platform/capabilities/execution/pipeline/13-execute-handler.ts': { count: 1, reason: 'gateway' },
  'platform/events/event-bus.ts': { count: 1, reason: 'not-a-capability' },
  'platform/mcp/bridge/strangler-bridge.ts': { count: 1, reason: 'not-a-capability' },
  // Debt (M0 T3.6/T3.7): migrate when the concurrent assignment-scoping work in lib/mcp settles.
  'app/actions/sales-agent-actions.ts': { count: 5, reason: 'debt' },
  'lib/mcp/registry.ts': { count: 3, reason: 'debt' },
  'lib/mcp/tools/task-tools.ts': { count: 2, reason: 'debt' },
  'lib/mcp/tools/deal-tools.ts': { count: 4, reason: 'debt' },
  'lib/mcp/tools/crm-tools.ts': { count: 2, reason: 'debt' },
  'lib/mcp/approval-engine.ts': { count: 1, reason: 'debt' },
  'lib/mcp/gateway.ts': { count: 1, reason: 'debt' },
  // Debt (needs M0 T2 unified approvals): the loop's legacy action-proposal approvals are not yet
  // gateway-verifiable approvals, so routing it now would refuse every approved high-risk step.
  'platform/runtime/execution/agent-execution-loop.ts': { count: 1, reason: 'debt' },
};

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === '__tests__' ? [] : walk(full);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

describe('no direct capability handler calls', () => {
  const counts = new Map<string, number>();
  for (const file of walk(ROOT)) {
    // Count code only: block comments and line comments are stripped first.
    const code = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    const n = (code.match(/\.handler\(/g) ?? []).length;
    if (n > 0) counts.set(file.slice(ROOT.length + 1), n);
  }

  it('no file outside the allowlist calls .handler(', () => {
    const unexpected = [...counts.keys()].filter((f) => !(f in ALLOWLIST));
    expect(unexpected).toEqual([]);
  });

  it('allowlisted counts never grow, and stale entries are removed', () => {
    for (const [file, entry] of Object.entries(ALLOWLIST)) {
      const actual = counts.get(file) ?? 0;
      expect(actual, `${file} (${entry.reason})`).toBeLessThanOrEqual(entry.count);
      expect(actual, `${file} reached ${actual}: lower or remove its allowlist entry`).toBe(entry.count);
    }
  });

  it('the platform workflow, saga, agent and Genkit paths are fully migrated', () => {
    for (const f of [
      'platform/workflows/execution/workflow-step-runner.ts',
      'platform/workflows/resilience/workflow-saga-engine.ts',
      'platform/runtime/governance/saga-compensation.ts',
      'platform/mcp/adapters/genkit-tool-adapter.ts',
    ]) {
      expect(counts.get(f) ?? 0, f).toBe(0);
    }
  });
});
