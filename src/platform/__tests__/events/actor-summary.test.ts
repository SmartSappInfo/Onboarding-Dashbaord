import { describe, it, expect } from 'vitest';
import { normalizeActor } from '@/platform/events/activity/actor-normalizer';
import { formatEventSummary } from '@/platform/events/activity/summary-formatter';
import { createDomainEvent, type DomainEvent } from '@/platform/capabilities/events/domain-event';
import { ActivityRecordV2Schema } from '@/platform/events/contracts/activity-record.contract';

describe('ActorNormalizer & SummaryFormatter: Natural Language & Actor Classification (Rules 4, 7, 13, 16)', () => {
  it('normalizes user actors with friendly display name and metadata', () => {
    const actor = normalizeActor(
      { type: 'user', id: 'usr-42' },
      { userName: 'Joseph Aidoo', email: 'joseph@smartsapp.com' }
    );

    expect(actor.type).toBe('user');
    expect(actor.id).toBe('usr-42');
    expect(actor.displayName).toBe('Joseph Aidoo');
  });

  it('normalizes agent actors with agentRole, model, and badge styling metadata', () => {
    const actor = normalizeActor(
      { type: 'agent', id: 'agent-sdr', agentVersion: '2.1' },
      { agentRole: 'AI SDR Agent', model: 'gemini-1.5-pro' }
    );

    expect(actor.type).toBe('agent');
    expect(actor.displayName).toBe('AI SDR Agent');
    expect(actor.agentRole).toBe('AI SDR Agent');
    expect(actor.model).toBe('gemini-1.5-pro');
    expect(actor.metadata).toMatchObject({ icon: 'Sparkles', color: 'purple' });
  });

  it('normalizes automation and system actors with appropriate icons and names', () => {
    const autoActor = normalizeActor(
      { type: 'automation', id: 'auto-followup-lead' },
      { workflowName: 'Lead Follow-up Sequence' }
    );
    expect(autoActor.type).toBe('automation');
    expect(autoActor.displayName).toBe('Lead Follow-up Sequence');
    expect(autoActor.metadata).toMatchObject({ icon: 'Zap', color: 'amber' });

    const sysActor = normalizeActor({ type: 'system', id: 'sys-outbox-worker' });
    expect(sysActor.type).toBe('system');
    expect(sysActor.displayName).toBe('SmartSapp System');
    expect(sysActor.metadata).toMatchObject({ icon: 'Settings2', color: 'slate' });
  });

  it('formats CRM contact events into plain English UI text (Rule 7)', () => {
    const event: DomainEvent = createDomainEvent({
      type: 'crm.contact.created',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      actor: { type: 'user', id: 'usr-1' },
      entity: { type: 'contact', id: 'cnt-1' },
      payload: { name: 'Sarah Connor' },
      correlationId: 'corr-1',
      source: 'test',
    });

    const summary = formatEventSummary(event, { actorDisplayName: 'Joseph Aidoo' });
    expect(summary).toBe('Joseph Aidoo created contact Sarah Connor');
  });

  it('formats Deal pipeline progression events with stage labels (Rule 7)', () => {
    const event: DomainEvent = createDomainEvent({
      type: 'deal.stage_changed',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      actor: { type: 'agent', id: 'agent-sdr' },
      entity: { type: 'deal', id: 'deal-99' },
      payload: { title: 'Cyberdyne Expansion', newStage: 'Proposal Sent' },
      correlationId: 'corr-2',
      source: 'test',
    });

    const summary = formatEventSummary(event, { actorDisplayName: 'AI SDR Agent' });
    expect(summary).toBe("AI SDR Agent moved deal 'Cyberdyne Expansion' to stage 'Proposal Sent'");
  });

  it('sanitizes malicious markup in entity names to prevent HTML/XSS leakage (Rule 13)', () => {
    const event: DomainEvent = createDomainEvent({
      type: 'crm.contact.created',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      actor: { type: 'user', id: 'usr-1' },
      entity: { type: 'contact', id: 'cnt-xss' },
      payload: { name: '<script>alert(1)</script>John Doe' },
      correlationId: 'corr-3',
      source: 'test',
    });

    const summary = formatEventSummary(event, { actorDisplayName: 'Joseph' });
    expect(summary).not.toContain('<script>');
    expect(summary).toBe('Joseph created contact John Doe');
  });

  it('validates a complete ActivityRecordV2 against ActivityRecordV2Schema', () => {
    const sampleRecord = {
      id: 'org-1_event-uuid-1',
      eventId: '12345678-1234-4234-8234-123456789abc',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      timestamp: new Date().toISOString(),
      eventType: 'crm.contact.created',
      actor: {
        type: 'user' as const,
        id: 'usr-1',
        displayName: 'Joseph Aidoo',
      },
      entity: {
        type: 'contact',
        id: 'cnt-1',
        name: 'Sarah Connor',
      },
      summary: 'Joseph Aidoo created contact Sarah Connor',
      details: { email: 'sarah@resistance.com' },
      metadata: { source: 'crm-form' },
      correlationId: 'trace-123',
    };

    const parsed = ActivityRecordV2Schema.parse(sampleRecord);
    expect(parsed.id).toBe('org-1_event-uuid-1');
    expect(parsed.actor.displayName).toBe('Joseph Aidoo');
  });
});
