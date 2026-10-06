/**
 * @fileOverview Meeting transcript UI (Phase 11 M1 · T8): paste flow, plain-text rendering, honest
 * empty states.
 */
import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const actions = vi.hoisted(() => ({
  ingestPastedTranscriptAction: vi.fn(),
  getMeetingTranscriptAction: vi.fn(),
  getMeetingConsentsAction: vi.fn(),
  recordMeetingConsentAction: vi.fn(),
  deleteMeetingTranscriptAction: vi.fn(),
  createTranscriptUploadAction: vi.fn(),
  ingestUploadedTranscriptAction: vi.fn(),
}));
const toast = vi.hoisted(() => vi.fn());

vi.mock('@/app/actions/meeting-transcript-actions', () => actions);
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));

import { AddTranscriptModal } from '../AddTranscriptModal';
import { MeetingTranscriptPanel } from '../MeetingTranscriptPanel';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AddTranscriptModal', () => {
  it('pastes a transcript and reports flagged lines in plain words', async () => {
    actions.ingestPastedTranscriptAction.mockResolvedValue({ success: true, data: { transcriptId: 't', replayed: false, injectionFlagged: true, segmentCount: 1, speakerCount: 1, wordCount: 3, timed: false, warnings: [] } });
    const onAdded = vi.fn();
    render(<AddTranscriptModal open onOpenChange={() => undefined} meetingId="m-1" workspaceId="ws-a" onAdded={onAdded} />);
    fireEvent.mouseDown(screen.getByRole('tab', { name: /paste text/i }));
    fireEvent.click(screen.getByRole('tab', { name: /paste text/i }));
    fireEvent.change(await screen.findByLabelText('Transcript text'), { target: { value: 'Ama: hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add transcript' }));
    await waitFor(() => expect(actions.ingestPastedTranscriptAction).toHaveBeenCalledWith('ws-a', 'm-1', 'Ama: hello'));
    await waitFor(() => expect(onAdded).toHaveBeenCalled());
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'Some lines look like instructions. They were saved as text only.' }));
  });

  it('shows the server message when adding fails', async () => {
    actions.ingestPastedTranscriptAction.mockResolvedValue({ success: false, error: 'Record transcription consent for this meeting first.' });
    render(<AddTranscriptModal open onOpenChange={() => undefined} meetingId="m-1" workspaceId="ws-a" onAdded={() => undefined} />);
    fireEvent.mouseDown(screen.getByRole('tab', { name: /paste text/i }));
    fireEvent.click(screen.getByRole('tab', { name: /paste text/i }));
    fireEvent.change(await screen.findByLabelText('Transcript text'), { target: { value: 'Ama: hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add transcript' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive', description: 'Record transcription consent for this meeting first.' })));
  });
});

describe('MeetingTranscriptPanel', () => {
  it('renders transcript text as text (markup is never interpreted)', async () => {
    actions.getMeetingTranscriptAction.mockResolvedValue({
      success: true,
      data: {
        transcriptId: 't-1', trust: 'untrusted_customer_content', page: 0, pageCount: 1, language: 'en', speakers: [],
        segmentCount: 1, durationMs: 1000, injectionFlagged: true, version: 1,
        segments: [{ id: 's0', speakerId: 'sp1', speakerName: 'Ama', startMs: 0, endMs: 1000, text: '<img src=x onerror=alert(1)>' }],
      },
    });
    const { container } = render(
      <MeetingTranscriptPanel meetingId="m-1" workspaceId="ws-a" consentEnforced={false} refreshKey={0} onTranscriptChange={() => undefined} />
    );
    expect(await screen.findByText('<img src=x onerror=alert(1)>')).toBeTruthy();
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('Needs review')).toBeTruthy();
  });

  it('"Line N" loads the page holding the line, renders it and highlights it (M2 · T6)', async () => {
    Element.prototype.scrollIntoView = vi.fn();
    const page = (n: number) => ({
      success: true,
      data: {
        transcriptId: 't-1', trust: 'untrusted_customer_content', page: n, pageCount: 2, language: 'en', speakers: [],
        segmentCount: 600, durationMs: 1000, injectionFlagged: false, version: 1,
        segments: Array.from({ length: n === 0 ? 500 : 100 }, (_, i) => ({ id: `s${n * 500 + i}`, speakerId: 'sp1', speakerName: 'Ama', startMs: 0, endMs: 1, text: `line ${n * 500 + i + 1}` })),
      },
    });
    actions.getMeetingTranscriptAction.mockImplementation(async (_ws: string, _m: string, p: number) => page(p));
    const { rerender } = render(
      <MeetingTranscriptPanel meetingId="m-1" workspaceId="ws-a" consentEnforced={false} refreshKey={0} onTranscriptChange={() => undefined} />
    );
    expect(await screen.findByText('line 1')).toBeTruthy();
    rerender(
      <MeetingTranscriptPanel meetingId="m-1" workspaceId="ws-a" consentEnforced={false} refreshKey={0} onTranscriptChange={() => undefined} focus={{ segmentId: 's549', transcriptId: 't-1', nonce: 1 }} />
    );
    const line = await screen.findByText('line 550');
    expect(actions.getMeetingTranscriptAction).toHaveBeenCalledWith('ws-a', 'm-1', 1, 't-1');
    await waitFor(() => expect(line.closest('li')?.className).toContain('bg-primary/15'));
  });

  it('shows nothing (no invented content) when there is no transcript', async () => {
    actions.getMeetingTranscriptAction.mockResolvedValue({ success: true, data: null });
    const onChange = vi.fn();
    render(<MeetingTranscriptPanel meetingId="m-1" workspaceId="ws-a" consentEnforced={false} refreshKey={0} onTranscriptChange={onChange} />);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(null));
    expect(screen.queryByText('Transcript')).toBeNull();
  });
});
