/**
 * @fileOverview Meeting outcomes UI (Phase 11 M2 · T6): grouped outcomes with quotes and "Line N";
 * review items get no one-click action; create / undo bound to the shown analysis version;
 * "Why?" explains without model reasoning; the draft sheet has no Send button and opens the
 * composer; the brief shows its sources and the facts-only label; long lists are paged.
 */
import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import type { MeetingItem } from '@/lib/meetings/intelligence/intelligence-schemas';
import type { OutcomesView } from '@/app/actions/meeting-outcomes-actions';

const actions = vi.hoisted(() => ({
  getMeetingOutcomesAction: vi.fn(),
  createFollowupTasksAction: vi.fn(),
  undoFollowupTaskAction: vi.fn(),
  deleteFollowupDraftAction: vi.fn(),
  getFollowupRecipientsAction: vi.fn(),
  draftFollowupAction: vi.fn(),
  getProposalTargetsAction: vi.fn(),
  proposeCrmUpdateAction: vi.fn(),
}));
const intelligenceActions = vi.hoisted(() => ({ generateMeetingPrepBriefAction: vi.fn() }));
const toast = vi.hoisted(() => vi.fn());

vi.mock('@/app/actions/meeting-outcomes-actions', () => actions);
vi.mock('@/app/actions/meeting-intelligence-actions', () => intelligenceActions);
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));

import MeetingOutcomesPanel from '../outcomes/MeetingOutcomesPanel';
import MeetingBriefCard from '../outcomes/MeetingBriefCard';

const NOW = '2026-10-07T12:00:00.000Z';
const item = (hash: string, type: MeetingItem['type'], text: string, extra: Partial<MeetingItem> = {}): MeetingItem => ({
  workspaceId: 'ws-a', meetingId: 'm-1', transcriptId: 't-1', itemHash: hash, type, text, confidence: 0.9,
  evidence: [{ segmentIds: ['s41'], quote: `quote for ${hash}` }], contradicts: [], needsReview: false,
  reviewReasons: [], status: 'valid', promptVersion: 'mi_extract_v1', createdAt: NOW, ...extra,
});

function view(items: MeetingItem[], over: Partial<OutcomesView> = {}): OutcomesView {
  return {
    header: { version: 3, runId: 'mir_1', transcriptId: 't-1', promptVersion: 'mi_extract_v1', modelId: 'flash', generatedAt: NOW, coverage: 1, truncated: false, kept: items.length, needsReview: items.filter((i) => i.needsReview).length, dropped: 2, summary: null },
    items, tasks: {}, proposals: {}, drafts: [], ...over,
  };
}

const items = [
  item('it_dec', 'decision', 'Move to the annual plan'),
  item('it_com', 'commitment', 'Send the revised quote'),
  item('it_rev', 'action_item', 'Maybe call the bursar', { needsReview: true, reviewReasons: ['low_confidence'] }),
];

const renderPanel = (onJump = vi.fn()) => render(
  <MeetingOutcomesPanel meetingId="m-1" workspaceId="ws-a" refreshKey={0} onJumpToLine={onJump} />
);

beforeEach(() => {
  vi.clearAllMocks();
  actions.getMeetingOutcomesAction.mockResolvedValue({ success: true, data: view(items) });
});

describe('MeetingOutcomesPanel', () => {
  it('groups outcomes, shows quotes with "Line N", and counts what was left out', async () => {
    const onJump = vi.fn();
    renderPanel(onJump);
    expect(await screen.findByText('Decisions (1)')).toBeTruthy();
    expect(screen.getByText('Commitments (1)')).toBeTruthy();
    expect(screen.getByText(/3 outcomes · 1 need review · 2 left out/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Line 42' })[0]);
    expect(onJump).toHaveBeenCalledWith('s41', 't-1');
  });

  it('an outcome that needs review gets no one-click action', async () => {
    renderPanel();
    const row = (await screen.findByText('Maybe call the bursar')).closest('li');
    expect(row).toBeTruthy();
    if (!row) return;
    expect(within(row).getByText('Needs review')).toBeTruthy();
    expect(within(row).queryByRole('button', { name: /create task/i })).toBeNull();
  });

  it('creates a task bound to the analysis version shown, then offers Undo', async () => {
    actions.createFollowupTasksAction.mockResolvedValue({ success: true, data: { intelligenceVersion: 3, created: [{ itemHash: 'it_com', taskId: 'task-1' }], existing: [], skipped: [] } });
    renderPanel();
    const row = (await screen.findByText('Send the revised quote')).closest('li');
    if (!row) throw new Error('row missing');
    actions.getMeetingOutcomesAction.mockResolvedValue({ success: true, data: view(items, { tasks: { it_com: 'task-1' } }) });
    fireEvent.click(within(row).getByRole('button', { name: 'Create task' }));
    await waitFor(() => expect(actions.createFollowupTasksAction).toHaveBeenCalledWith('ws-a', 'm-1', { itemHashes: ['it_com'], expectedVersion: 3 }));
    expect(await screen.findByText('Task created')).toBeTruthy();
    expect(screen.getByRole('button', { name: /undo/i })).toBeTruthy();
  });

  it('a refused change shows the reason and reloads (e.g. the meeting was re-analysed)', async () => {
    actions.createFollowupTasksAction.mockResolvedValue({ success: false, error: 'The analysis changed since you reviewed it. Review it again.' });
    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: /create tasks \(1\)/i }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive', description: 'The analysis changed since you reviewed it. Review it again.' })));
    expect(actions.getMeetingOutcomesAction).toHaveBeenCalledTimes(2);
  });

  it('"Why?" shows the quote, the checks and how it was made, with no model reasoning', async () => {
    renderPanel();
    const row = (await screen.findByText('Maybe call the bursar')).closest('li');
    if (!row) throw new Error('row missing');
    fireEvent.click(within(row).getByRole('button', { name: /why/i }));
    expect(await screen.findByText('Why this outcome?')).toBeTruthy();
    expect(screen.getByText(/The AI was not sure this was really agreed/)).toBeTruthy();
    expect(screen.getByText(/Prompt mi_extract_v1 · model flash · run mir_1/)).toBeTruthy();
    expect(screen.queryByText(/reasoning|chain of thought/i)).toBeNull();
  });

  it('the draft sheet restricts recipients, has no Send button and opens the composer', async () => {
    actions.getFollowupRecipientsAction.mockResolvedValue({ success: true, data: [{ email: 'ama@customer.test', name: 'Ama', source: 'participant' }] });
    actions.draftFollowupAction.mockResolvedValue({ success: true, data: { trust: 'model_generated_from_customer_content', draftId: 'd-1', replayed: false, intelligenceVersion: 3, recipients: ['ama@customer.test'], subject: 'Next steps', body: 'We will send the quote.', sentences: [], droppedSentences: 0, promptVersion: 'mi_followup_v1' } });
    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: /draft follow-up/i }));
    expect(await screen.findByText('ama@customer.test · participant')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Write draft' }));
    await waitFor(() => expect(actions.draftFollowupAction).toHaveBeenCalledWith('ws-a', 'm-1', { recipients: ['ama@customer.test'], expectedVersion: 3 }));
    expect(await screen.findByText('We will send the quote.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^send/i })).toBeNull();
    expect(screen.getByRole('link', { name: 'Open in composer' }).getAttribute('href')).toBe('/admin/messaging/composer?meetingId=m-1&draftId=d-1');
  });

  it('pages long lists: 50 at a time', async () => {
    const many = Array.from({ length: 120 }, (_, i) => item(`it_${i}`, 'topic', `Topic ${i}`));
    actions.getMeetingOutcomesAction.mockResolvedValue({ success: true, data: view(many) });
    renderPanel();
    expect(await screen.findByText('Topic 49')).toBeTruthy();
    expect(screen.queryByText('Topic 50')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /show more \(70 more\)/i }));
    expect(await screen.findByText('Topic 99')).toBeTruthy();
  });

  it('renders nothing (and tells the tab) when there is no evidence-checked analysis', async () => {
    actions.getMeetingOutcomesAction.mockResolvedValue({ success: true, data: null });
    const onAvailability = vi.fn();
    const { container } = render(<MeetingOutcomesPanel meetingId="m-1" workspaceId="ws-a" refreshKey={0} onJumpToLine={vi.fn()} onAvailability={onAvailability} />);
    await waitFor(() => expect(onAvailability).toHaveBeenCalledWith(false));
    expect(container.textContent).toBe('');
  });
});

describe('MeetingBriefCard', () => {
  it('lists sources for every line and labels a facts-only brief', async () => {
    intelligenceActions.generateMeetingPrepBriefAction.mockResolvedValue({
      success: true,
      brief: {
        meetingId: 'm-1', title: 'Renewal', meetingTime: NOW, mode: 'facts_only', factsOnlyReason: 'model_unavailable', linkedEntity: true,
        objective: null, history: [{ text: 'Met twice this term.', sourceIds: ['meeting:m-0'] }], openDeals: [], openCommitments: [], risks: [], agenda: [], questions: [],
        citations: [{ id: 'meeting:m-0', type: 'prior_meeting', label: 'Kickoff call', at: NOW }],
        budget: { found: 12, used: 5, estimatedTokens: 900, droppedItems: 0 }, promptVersion: 'pb_v1', generatedAt: NOW,
      },
    });
    render(<MeetingBriefCard meetingId="m-1" workspaceId="ws-a" />);
    fireEvent.click(screen.getByRole('button', { name: 'Prepare brief' }));
    expect(await screen.findByText('AI summary unavailable; showing facts only.')).toBeTruthy();
    expect(screen.getByText('[1] Kickoff call', { exact: false })).toBeTruthy();
    expect(screen.getByText('Found 12 records, used the 5 most relevant.')).toBeTruthy();
  });
});
