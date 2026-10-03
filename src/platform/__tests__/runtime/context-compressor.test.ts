/**
 * @fileOverview Unit & Integration Tests for AgentContextCompressor (Rules 28, 30, 32, 33, 56)
 */

import { describe, it, expect } from 'vitest';
import { AgentContextCompressor } from '@/platform/runtime/governance/context-compressor';
import { type AgentStep } from '@/platform/runtime/agent-run-types';

describe('AgentContextCompressor (Rules 28, 30, 32, 33, 56)', () => {
  const createStep = (id: string, index: number, title: string, outputSummary: string, sensitiveData?: string): AgentStep => ({
    stepId: id,
    runId: 'run_123',
    organizationId: 'org_acme',
    workspaceId: 'ws_sales',
    stepIndex: index,
    type: 'tool_call',
    title,
    capabilityId: 'crm.search',
    status: 'completed',
    idempotencyKey: `idemp_${id}`,
    correlationId: `corr_${id}`,
    input: { query: 'test' },
    output: { summary: outputSummary, secret: sensitiveData, items: Array(5).fill('item') },
    outputValidated: true,
    tokensUsed: 200,
    compensationStatus: 'not_required',
  });

  it('compresses step history to fit within maxTokens budget', () => {
    const steps: AgentStep[] = [
      createStep('step_0', 0, 'Initial Search', 'Found 100 contacts matching criteria'),
      createStep('step_1', 1, 'Profile Extraction', 'Extracted 10 high-value targets'),
      createStep('step_2', 2, 'Enrichment Phase', 'Enriched firmographic data for accounts'),
      createStep('step_3', 3, 'Draft Email', 'Generated cold email drafts for review'),
    ];

    const result = AgentContextCompressor.compress({
      goalPrompt: 'Find and reach out to enterprise leads',
      steps,
      memoryCitations: ['Customer requested annual plans in Q2 2026.'],
      options: {
        maxTokens: 500,
        preserveRecentStepsCount: 2,
      },
    });

    expect(result.totalTokens).toBeLessThanOrEqual(500);
    expect(result.xmlPromptContext).toContain('<untrusted_reference_data id="compressed_history">');
    expect(result.xmlPromptContext).toContain('Draft Email');
    expect(result.retainedStepCount).toBeGreaterThan(0);
  });

  it('redacts sensitive API keys, Bearer tokens, private keys, credit cards, and SSNs during compression (Rules 32 & 33)', () => {
    const steps: AgentStep[] = [
      createStep('step_0', 0, 'Fetch Secret', 'Retrieved key', 'sk-ant-api03-12345678901234567890'),
      createStep('step_1', 1, 'Inspect Headers', 'Auth header', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.doNotLeakThisSignature'),
      createStep('step_2', 2, 'Verify Profile', 'Customer PII', 'SSN: 000-12-3456 and Card: 4111111111111111'),
    ];

    const result = AgentContextCompressor.compress({
      goalPrompt: 'Fetch credentials',
      steps,
      options: { redactSensitiveData: true },
    });

    expect(result.xmlPromptContext).not.toContain('sk-ant-api03-12345678901234567890');
    expect(result.xmlPromptContext).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    expect(result.xmlPromptContext).not.toContain('000-12-3456');
    expect(result.xmlPromptContext).not.toContain('4111111111111111');
    expect(result.xmlPromptContext).toContain('[REDACTED_CREDENTIAL]');
    expect(result.xmlPromptContext).toContain('[REDACTED_PII]');
    expect(result.xmlPromptContext).toContain('[REDACTED_FINANCIAL]');
    expect(result.redactedTokensCount).toBeGreaterThan(0);
  });

  it('preserves essential decision evidence and citations without loss (Rule 56)', () => {
    const steps: AgentStep[] = [
      createStep('step_0', 0, 'Check Note', 'Note says contact moved to VP of Sales'),
    ];

    const result = AgentContextCompressor.compress({
      goalPrompt: 'Verify contact status',
      steps,
      memoryCitations: ['Citation #1: CRM Note con_987'],
      options: { maxTokens: 1000 },
    });

    expect(result.xmlPromptContext).toContain('Citation #1: CRM Note con_987');
    expect(result.xmlPromptContext).toContain('VP of Sales');
  });

  it('handles empty step histories and large histories gracefully within performance budgets (Rule 54)', () => {
    const startTime = Date.now();
    const resultEmpty = AgentContextCompressor.compress({
      goalPrompt: 'Fresh run with no previous steps',
      steps: [],
    });

    expect(resultEmpty.retainedStepCount).toBe(0);
    expect(resultEmpty.xmlPromptContext).toContain('Fresh run with no previous steps');

    // Test with 30 steps
    const largeSteps: AgentStep[] = Array.from({ length: 30 }, (_, i) =>
      createStep(`step_${i}`, i, `Step ${i}`, `Completed step ${i} processing`)
    );

    const resultLarge = AgentContextCompressor.compress({
      goalPrompt: 'Large pipeline execution',
      steps: largeSteps,
      options: { maxTokens: 4000 },
    });

    const durationMs = Date.now() - startTime;
    expect(durationMs).toBeLessThanOrEqual(100); // Rule 54 performance budget <= 100ms
    expect(resultLarge.totalTokens).toBeLessThanOrEqual(4000);
  });
});
