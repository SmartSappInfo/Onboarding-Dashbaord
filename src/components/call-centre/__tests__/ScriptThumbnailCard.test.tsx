import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ScriptThumbnailCard } from '../ScriptThumbnailCard';
import type { CallCampaign, CallScript } from '@/lib/types';

describe('ScriptThumbnailCard', () => {
  const mockCampaign: CallCampaign = {
    id: 'camp_1',
    organizationId: 'org_1',
    workspaceId: 'ws_1',
    name: 'Outbound Sales Q3',
    description: 'Campaign reaching out to interested demo leads.',
    scriptId: 'script_123',
    scriptSnapshot: JSON.stringify({
      nodes: [
        {
          id: 'start-1',
          type: 'start',
          data: { label: 'Start Call', text: 'Hi, this is Alex calling from SmartSapp.' },
        },
        {
          id: 'step-2',
          type: 'dialogue',
          data: { label: 'Pitch', text: 'I am reaching out regarding your recent inquiry.' },
        },
      ],
      edges: [{ id: 'e1', source: 'start-1', target: 'step-2' }],
    }),
    audienceDefinition: { mode: 'all' },
    outcomes: ['Interested', 'Not Interested'],
    automationRules: {},
    status: 'running',
    createdAt: '2026-09-01T10:00:00Z',
    updatedAt: '2026-09-01T10:00:00Z',
    createdBy: 'user_1',
    progress: { total: 10, completed: 3, pending: 7, skipped: 0, callbacks: 0, deferred: 0 },
  };

  const mockScript: CallScript = {
    id: 'script_1',
    organizationId: 'org_1',
    workspaceId: 'ws_1',
    name: 'Demo Follow-up Script',
    description: 'Used for scheduled follow-up calls.',
    content: JSON.stringify({
      nodes: [
        {
          id: 'node_1',
          type: 'start',
          data: { text: 'Hello {{FIRST_NAME}}, thank you for taking the time today.' },
        },
      ],
      edges: [],
    }),
    variables: ['FIRST_NAME', 'COMPANY_NAME'],
    createdAt: '2026-09-01T10:00:00Z',
    updatedAt: '2026-09-01T10:00:00Z',
    createdBy: 'user_1',
  };

  describe('Selector Mode (CallNowModal)', () => {
    it('renders campaign details and extracts dialogue opener text from snapshot', () => {
      const handleSelect = vi.fn();
      render(
        <ScriptThumbnailCard
          mode="selector"
          campaign={mockCampaign}
          onSelect={handleSelect}
        />
      );

      // Verify campaign name
      expect(screen.getByText('Outbound Sales Q3')).toBeTruthy();
      // Verify extracted dialogue opener from graph
      expect(screen.getByText(/Hi, this is Alex calling from SmartSapp\./i)).toBeTruthy();
      // Verify step count badge
      expect(screen.getByText('2 steps')).toBeTruthy();
    });

    it('triggers onSelect when card is clicked', () => {
      const handleSelect = vi.fn();
      render(
        <ScriptThumbnailCard
          mode="selector"
          campaign={mockCampaign}
          onSelect={handleSelect}
        />
      );

      const card = screen.getByRole('button');
      fireEvent.click(card);

      expect(handleSelect).toHaveBeenCalledTimes(1);
      expect(handleSelect).toHaveBeenCalledWith(mockCampaign);
    });

    it('handles empty or malformed scriptSnapshot gracefully with fallback', () => {
      const brokenCampaign: CallCampaign = {
        ...mockCampaign,
        id: 'camp_broken',
        name: 'Draft Campaign',
        description: 'Fallback campaign description.',
        scriptSnapshot: '',
      };

      const handleSelect = vi.fn();
      render(
        <ScriptThumbnailCard
          mode="selector"
          campaign={brokenCampaign}
          onSelect={handleSelect}
        />
      );

      expect(screen.getByText('Draft Campaign')).toBeTruthy();
      // Falls back to description in both quote and info card
      expect(screen.getAllByText(/Fallback campaign description\./i).length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Library Mode (CallCentreClient)', () => {
    it('renders script title, description, and variable badges', () => {
      render(
        <ScriptThumbnailCard
          mode="library"
          script={mockScript}
        />
      );

      expect(screen.getByText('Demo Follow-up Script')).toBeTruthy();
      expect(screen.getByText('FIRST_NAME')).toBeTruthy();
      expect(screen.getByText('COMPANY_NAME')).toBeTruthy();
      expect(screen.getByText(/Hello {{FIRST_NAME}}, thank you for taking the time today\./i)).toBeTruthy();
    });

    it('triggers action callbacks (preview, use, edit, export, delete)', () => {
      const onPreview = vi.fn();
      const onUse = vi.fn();
      const onEdit = vi.fn();
      const onExport = vi.fn();
      const onDelete = vi.fn();

      render(
        <ScriptThumbnailCard
          mode="library"
          script={mockScript}
          onPreview={onPreview}
          onUse={onUse}
          onEdit={onEdit}
          onExport={onExport}
          onDelete={onDelete}
        />
      );

      const previewBtn = screen.getByTitle('Preview Script');
      fireEvent.click(previewBtn);
      expect(onPreview).toHaveBeenCalledWith(mockScript);

      const useBtn = screen.getByTitle('Use Script to Create Campaign');
      fireEvent.click(useBtn);
      expect(onUse).toHaveBeenCalledWith(mockScript);

      const editBtn = screen.getByTitle('Edit Script');
      fireEvent.click(editBtn);
      expect(onEdit).toHaveBeenCalledWith(mockScript);

      const exportBtn = screen.getByTitle('Export Script (.cflow)');
      fireEvent.click(exportBtn);
      expect(onExport).toHaveBeenCalledWith(mockScript);

      const deleteBtn = screen.getByTitle('Delete Script');
      fireEvent.click(deleteBtn);
      expect(onDelete).toHaveBeenCalledWith(mockScript.id);
    });
  });
});
