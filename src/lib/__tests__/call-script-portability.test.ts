import { describe, it, expect } from 'vitest';
import {
  CFLOW_FORMAT,
  CFLOW_VERSION,
  CFLOW_EXTENSION,
  buildScriptExport,
  serializeScriptExport,
  parseScriptExport,
  slugifyScriptName,
} from '../call-script-portability';

const baseScript = {
  name: 'Welcome Call',
  description: 'Opening outreach',
  content: 'Hello {{ENTITY_NAME}}, this is {{AGENT_NAME}}.',
  variables: ['ENTITY_NAME', 'AGENT_NAME'],
};

describe('call-script-portability', () => {
  describe('buildScriptExport', () => {
    it('produces a versioned envelope with only portable fields', () => {
      const env = buildScriptExport(baseScript);
      expect(env.format).toBe(CFLOW_FORMAT);
      expect(env.version).toBe(CFLOW_VERSION);
      expect(typeof env.exportedAt).toBe('string');
      expect(env.script).toEqual({
        name: 'Welcome Call',
        description: 'Opening outreach',
        content: baseScript.content,
        variables: ['ENTITY_NAME', 'AGENT_NAME'],
      });
    });

    it('never leaks identity fields even if present on the input', () => {
      const env = buildScriptExport({
        ...baseScript,
        // @ts-expect-error — intentionally passing forbidden fields
        id: 'doc1',
        organizationId: 'org1',
        workspaceId: 'ws1',
        createdBy: 'user1',
      });
      const json = JSON.stringify(env);
      expect(json).not.toContain('org1');
      expect(json).not.toContain('ws1');
      expect(json).not.toContain('doc1');
      expect(json).not.toContain('user1');
    });
  });

  describe('round-trip', () => {
    it('build → serialize → parse recovers the script', () => {
      const text = serializeScriptExport(buildScriptExport(baseScript));
      const result = parseScriptExport(text);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.script.name).toBe('Welcome Call');
        expect(result.script.content).toBe(baseScript.content);
        expect(result.script.variables.sort()).toEqual(['AGENT_NAME', 'ENTITY_NAME']);
      }
    });
  });

  describe('parseScriptExport validation', () => {
    it('rejects invalid JSON', () => {
      const r = parseScriptExport('{not json');
      expect(r.ok).toBe(false);
    });

    it('rejects a wrong format marker', () => {
      const r = parseScriptExport(JSON.stringify({ format: 'something-else', version: 1, script: baseScript }));
      expect(r.ok).toBe(false);
    });

    it('rejects an unsupported version', () => {
      const r = parseScriptExport(JSON.stringify({ format: CFLOW_FORMAT, version: 999, script: baseScript }));
      expect(r.ok).toBe(false);
    });

    it('rejects a missing/empty name', () => {
      const r = parseScriptExport(JSON.stringify({ format: CFLOW_FORMAT, version: CFLOW_VERSION, script: { ...baseScript, name: '   ' } }));
      expect(r.ok).toBe(false);
    });

    it('rejects non-string content', () => {
      const r = parseScriptExport(JSON.stringify({ format: CFLOW_FORMAT, version: CFLOW_VERSION, script: { ...baseScript, content: { nope: true } } }));
      expect(r.ok).toBe(false);
    });

    it('rejects oversized content', () => {
      const huge = 'x'.repeat(2_000_000);
      const r = parseScriptExport(JSON.stringify({ format: CFLOW_FORMAT, version: CFLOW_VERSION, script: { ...baseScript, content: huge } }));
      expect(r.ok).toBe(false);
    });

    it('re-derives variables from content and ignores the file-provided list', () => {
      const r = parseScriptExport(JSON.stringify({
        format: CFLOW_FORMAT,
        version: CFLOW_VERSION,
        script: { name: 'X', content: 'Hi {{FIRST_NAME}} and {{COMPANY}}', variables: ['HACKED', 'INJECTED'] },
      }));
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.script.variables.sort()).toEqual(['COMPANY', 'FIRST_NAME']);
    });

    it('ignores identity keys embedded in the file', () => {
      const r = parseScriptExport(JSON.stringify({
        format: CFLOW_FORMAT,
        version: CFLOW_VERSION,
        script: { name: 'X', content: 'hello', organizationId: 'EVIL', workspaceId: 'EVIL', id: 'EVIL' },
      }));
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.script).not.toHaveProperty('organizationId');
        expect(r.script).not.toHaveProperty('workspaceId');
        expect(r.script).not.toHaveProperty('id');
      }
    });

    it('rejects a structurally invalid JSON graph', () => {
      // looks like a graph (has nodes/edges arrays) but a start node has no outgoing edge etc.
      const badGraph = JSON.stringify({ nodes: [], edges: [] });
      const r = parseScriptExport(JSON.stringify({
        format: CFLOW_FORMAT,
        version: CFLOW_VERSION,
        script: { name: 'Graph', content: badGraph },
      }));
      expect(r.ok).toBe(false);
    });

    it('accepts plain-text content', () => {
      const r = parseScriptExport(JSON.stringify({
        format: CFLOW_FORMAT,
        version: CFLOW_VERSION,
        script: { name: 'Plain', content: 'Just talk to the customer.' },
      }));
      expect(r.ok).toBe(true);
    });
  });

  describe('slugifyScriptName', () => {
    it('makes a filesystem-safe slug', () => {
      expect(slugifyScriptName('Welcome Call! (v2)')).toBe('welcome-call-v2');
    });
    it('falls back when empty', () => {
      expect(slugifyScriptName('   ')).toBe('call-script');
    });
  });

  it('exposes the .cflow extension', () => {
    expect(CFLOW_EXTENSION).toBe('.cflow');
  });
});
