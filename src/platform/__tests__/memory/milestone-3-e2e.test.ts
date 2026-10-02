/**
 * @fileOverview End-to-End Integration Test for Phase 4 Milestone 3
 *
 * Verifies full write-to-read knowledge plane cycle:
 * 1. Domain Event published (e.g. crm.note.created)
 * 2. DomainEventIndexer intercepts event and constructs Cloud Tasks job payload
 * 3. MemoryIngestionWorker processes job (SSRF guard, anti-poisoning, recursive chunking, embedding)
 * 4. Dual indexing in CanonicalMemoryService (Sparse BM25 + Dense Qdrant/Memory vector store)
 * 5. Downstream agent retrieval via CanonicalMemoryService.retrieveContext() with hybrid search and knapsack budgeting
 */

import { describe, it, expect } from 'vitest';
import { DomainEventIndexer } from '../../memory/subscribers/domain-event-indexer';
import { processMemoryIngestionJob } from '../../memory/ingestion/memory-ingestion-worker';
import { CanonicalMemoryService } from '../../memory/services/canonical-memory-service';
import { DeterministicMemoryEmbeddingProvider } from '../../memory/ingestion/embedding-service';
import { MemoryVectorStore } from '../../memory/adapters/memory-vector-store';
import { createDomainEvent } from '../../capabilities/events/domain-event';
import { MemoryIngestionJobPayload } from '../../memory/ingestion/ingestion-types';

describe('Phase 4 Milestone 3: Full Knowledge Ingestion & Retrieval Cycle (E2E)', () => {
  it('successfully ingests a CRM customer note and retrieves it via hybrid search with evidence citation', async () => {
    const vectorStore = new MemoryVectorStore();
    const embeddingProvider = new DeterministicMemoryEmbeddingProvider();
    const memoryService = new CanonicalMemoryService({
      vectorStore,
      embeddingProvider,
    });

    // 1. Setup subscriber with inline worker dispatch
    let dispatchedJob: MemoryIngestionJobPayload | null = null;
    const indexer = new DomainEventIndexer({
      onDispatchInline: async (payload) => {
        dispatchedJob = payload;
        await processMemoryIngestionJob(payload, {
          memoryService,
          embeddingProvider,
        });
      },
    });

    // 2. Emit Domain Event
    const event = createDomainEvent({
      type: 'crm.note.created',
      organizationId: 'org-enterprise-corp',
      workspaceId: 'ws-sales-east',
      source: 'crm_note_form',
      correlationId: 'corr-e2e-m3-001',
      actor: { id: 'agent_lead_sdr', type: 'agent' },
      entity: { id: 'con_apex_school', type: 'contact' },
      payload: {
        title: 'Apex Academy Discovery Meeting',
        note: `
# Executive Overview
Apex Academy is expanding to 3 new campuses in 2027.

## Decision Criteria
The principal emphasized that real-time parent notifications via WhatsApp are mandatory.
Budget allocation is approved up to $45,000 annually.

## Next Steps
Schedule technical demo for curriculum directors next Tuesday.
`,
        authorName: 'Agent Lead SDR',
        topics: ['budget', 'whatsapp', 'expansion'],
      },
    });

    const handled = await indexer.handleEvent(event);
    expect(handled).toBe(true);
    expect(dispatchedJob).not.toBeNull();

    // 3. Query context using the Milestone 2 Context Retrieval Algorithm
    const context = await memoryService.retrieveContext({
      query: 'What is Apex Academy budget and parent communication requirement?',
      organizationId: 'org-enterprise-corp',
      workspaceId: 'ws-sales-east',
      maxTokens: 2000,
    });

    // 4. Verify Evidence Pack and Citations
    expect(context.evidencePack.itemCount).toBeGreaterThan(0);
    expect(context.evidencePack.promptContext).toContain('Apex Academy');
    expect(context.evidencePack.promptContext).toContain('WhatsApp');
    expect(context.evidencePack.promptContext).toContain('$45,000');

    // 5. Verify Rule 30 Prompt Isolation Tag
    expect(context.evidencePack.promptContext).toContain('<untrusted_reference_data');
    expect(context.evidencePack.promptContext).toContain('</untrusted_reference_data>');

    // 6. Verify Rule 16 Provenance Citation
    expect(context.evidencePack.citations.length).toBeGreaterThan(0);
    expect(context.evidencePack.citations[0].sourceId).toBe('con_apex_school');
    expect(context.evidencePack.citations[0].sourceType).toBe('user_note');

    // 7. Verify Telemetry
    expect(context.telemetry.denseHitsCount).toBeGreaterThan(0);
    expect(context.telemetry.sparseHitsCount).toBeGreaterThan(0);
    expect(context.telemetry.totalTokens).toBeGreaterThan(0);
  });
});
