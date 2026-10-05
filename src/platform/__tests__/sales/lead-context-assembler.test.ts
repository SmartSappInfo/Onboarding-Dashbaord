import { describe, it, expect, beforeEach } from 'vitest';
import { LeadContextAssembler } from '../../agents/sales/context/lead-context-assembler';
import { SALES_INTELLIGENCE_ERROR_CODES, SalesIntelligenceError } from '../../agents/sales/context/lead-context-types';

describe('LeadContextAssembler', () => {
  let assembler: LeadContextAssembler;

  beforeEach(() => {
    assembler = new LeadContextAssembler();
  });

  it('assembles a bounded lead dossier with XML containerization', async () => {
    const result = await assembler.assemble({
      organizationId: 'org_test',
      workspaceId: 'ws_test',
      prospectId: 'lead_sample_01',
      maxTokens: 4000,
      includeSignals: true,
      includeDossier: true,
    });

    expect(result).toHaveProperty('dossier');
    expect(result).toHaveProperty('promptXml');
    expect(result.dossier.prospectId).toBe('lead_sample_01');
    expect(result.promptXml).toContain('<untrusted_reference_data id="lead_context_lead_sample_01">');
    expect(result.promptXml).toContain('</untrusted_reference_data>');
    expect(result.tokenEstimate).toBeLessThanOrEqual(4000);
  });

  it('fails closed on missing tenant IDs with IDOR error', async () => {
    await expect(
      assembler.assemble({
        organizationId: '',
        workspaceId: 'ws_test',
        prospectId: 'lead_sample_01',
        maxTokens: 4000,
        includeSignals: true,
        includeDossier: true,
      })
    ).rejects.toThrowError(SalesIntelligenceError);

    try {
      await assembler.assemble({
        organizationId: '',
        workspaceId: 'ws_test',
        prospectId: 'lead_sample_01',
        maxTokens: 4000,
        includeSignals: true,
        includeDossier: true,
      });
    } catch (err) {
      expect((err as SalesIntelligenceError).code).toBe(SALES_INTELLIGENCE_ERROR_CODES.IDOR_VIOLATION);
    }
  });

  it('caches context assembly across invocations within TTL', async () => {
    const res1 = await assembler.assemble({
      organizationId: 'org_test',
      workspaceId: 'ws_test',
      prospectId: 'lead_cached_01',
      maxTokens: 4000,
      includeSignals: true,
      includeDossier: true,
    });

    const res2 = await assembler.assemble({
      organizationId: 'org_test',
      workspaceId: 'ws_test',
      prospectId: 'lead_cached_01',
      maxTokens: 4000,
      includeSignals: true,
      includeDossier: true,
    });

    expect(res1.dossier.assembledAt).toBe(res2.dossier.assembledAt);
  });

  it('sanitizes XML delimiters in untrusted metadata to prevent prompt breakout', async () => {
    const res = await assembler.assemble({
      organizationId: 'org_test',
      workspaceId: 'ws_test',
      prospectId: 'malicious_<script>alert("hack")</script>',
      maxTokens: 4000,
      includeSignals: true,
      includeDossier: true,
    });

    expect(res.promptXml).not.toContain('<script>');
    expect(res.promptXml).toContain('&lt;script&gt;');
  });
});
