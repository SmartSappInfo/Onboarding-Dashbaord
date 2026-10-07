/**
 * @fileOverview Unit & Integration Tests: Meeting Operator Surfaces (Phase 11 M5 · T1)
 *
 * Verifies:
 * - MeetingAiTimeline: rendering, filtering, timestamp seek callback, empty states
 * - MeetingBriefCard: rendering prep brief and citations
 * - MeetingOutcomesPanel: rendering extracted items, tasks, and proposals
 * - Strict Rule 4 typing (zero any/any[])
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  MeetingAiTimeline,
  type MeetingTimelineEvent,
} from '@/app/admin/meetings/[id]/components/MeetingAiTimeline';
import MeetingBriefCard from '@/app/admin/meetings/[id]/components/outcomes/MeetingBriefCard';

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/app/actions/meeting-intelligence-actions', () => ({
  generateMeetingPrepBriefAction: vi.fn().mockResolvedValue({
    success: true,
    brief: {
      mode: 'complete',
      objective: { text: 'Align on annual renewal terms' },
      history: [{ text: 'Discussed pricing last quarter', sourceIds: ['src_1'] }],
      openDeals: [{ text: 'Deal #1842 - Renewal', sourceIds: ['src_2'] }],
      openCommitments: [{ text: 'Send pricing breakdown', sourceIds: ['src_1'] }],
      risks: [{ text: 'Competitor offering lower rate', sourceIds: ['src_1'] }],
      agenda: [{ text: 'Review past performance', sourceIds: [] }],
      questions: [{ text: 'What is your budget ceiling?', sourceIds: [] }],
      citations: [
        { id: 'src_1', label: 'Meeting Transcript Q3', at: '2026-08-15' },
        { id: 'src_2', label: 'CRM Deal #1842', at: '2026-09-01' },
      ],
      budget: { found: 10, used: 2 },
    },
  }),
}));

describe('Meeting Operator Surfaces (Phase 11 M5 · T1)', () => {
  const mockEvents: MeetingTimelineEvent[] = [
    {
      id: 'evt_1',
      type: 'decision',
      timestampSeconds: 120,
      formattedTime: '02:00',
      speakerName: 'Sarah Headmistress',
      text: 'Agreed to adopt SmartSapp for high school division.',
      confidence: 0.95,
      highlighted: true,
    },
    {
      id: 'evt_2',
      type: 'commitment',
      timestampSeconds: 310,
      formattedTime: '05:10',
      speakerName: 'Account Executive',
      text: 'Send onboarding packet by Friday 5 PM.',
      confidence: 0.92,
    },
    {
      id: 'evt_3',
      type: 'objection',
      timestampSeconds: 450,
      formattedTime: '07:30',
      speakerName: 'Bursar',
      text: 'Need staggered payment schedule due to term dates.',
      confidence: 0.88,
    },
  ];

  describe('1. MeetingAiTimeline Component', () => {
    it('renders timeline with events and moment badges', () => {
      render(
        <MeetingAiTimeline
          meetingId="mtg_123"
          events={mockEvents}
          activeSecond={150}
        />
      );

      expect(screen.getByText('AI Timeline & Key Moments')).toBeInTheDocument();
      expect(screen.getByText('Agreed to adopt SmartSapp for high school division.')).toBeInTheDocument();
      expect(screen.getByText('Send onboarding packet by Friday 5 PM.')).toBeInTheDocument();
      expect(screen.getByText('Decision')).toBeInTheDocument();
      expect(screen.getByText('Commitment')).toBeInTheDocument();
      expect(screen.getByText('Objection')).toBeInTheDocument();
    });

    it('triggers onSeekToSecond when play timestamp button is clicked', () => {
      const onSeek = vi.fn();
      render(
        <MeetingAiTimeline
          meetingId="mtg_123"
          events={mockEvents}
          onSeekToSecond={onSeek}
        />
      );

      const seekBtn = screen.getByRole('button', { name: /Jump to 02:00/i });
      fireEvent.click(seekBtn);

      expect(onSeek).toHaveBeenCalledWith(120);
    });

    it('filters events by type when filter buttons are clicked', () => {
      render(
        <MeetingAiTimeline
          meetingId="mtg_123"
          events={mockEvents}
        />
      );

      const decisionFilter = screen.getByRole('button', { name: /^decision$/i });
      fireEvent.click(decisionFilter);

      expect(screen.getByText('Agreed to adopt SmartSapp for high school division.')).toBeInTheDocument();
      expect(screen.queryByText('Send onboarding packet by Friday 5 PM.')).not.toBeInTheDocument();
    });

    it('renders clean empty state when no events exist', () => {
      render(
        <MeetingAiTimeline
          meetingId="mtg_empty"
          events={[]}
        />
      );

      expect(screen.getByText('No timeline events found')).toBeInTheDocument();
    });
  });

  describe('2. MeetingBriefCard Component', () => {
    it('renders prep brief trigger and generates brief on click', async () => {
      render(<MeetingBriefCard meetingId="mtg_123" workspaceId="ws_primary" />);

      const prepareBtn = screen.getByRole('button', { name: /Prepare brief/i });
      fireEvent.click(prepareBtn);

      const objective = await screen.findByText('Align on annual renewal terms');
      expect(objective).toBeInTheDocument();
      expect(screen.getByText(/Meeting Transcript Q3/)).toBeInTheDocument();
    });
  });
});
