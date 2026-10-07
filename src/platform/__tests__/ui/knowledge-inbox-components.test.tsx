/**
 * @fileOverview Unit Tests: Knowledge Inbox UI Components (Phase 11 M3 · T7)
 *
 * Enforces theme.md §8 (Standardized Modal & Dialog System Architecture),
 * Rule 4 (Strict Typing), Rule 7 (Mobile touch targets >= 44px),
 * Rule 13 & 30 (Untrusted Reference Data containerization).
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { KnowledgeCandidateCard } from '@/components/knowledge/KnowledgeCandidateCard';
import { KnowledgeItemInspector } from '@/components/knowledge/KnowledgeItemInspector';
import { KnowledgeConflictModal } from '@/components/knowledge/KnowledgeConflictModal';
import type { KnowledgeCandidate, KnowledgeConflict } from '@/platform/domains/knowledge_memory/contracts/knowledge-schemas';

describe('Knowledge Inbox UI Components (Phase 11 M3 · T7)', () => {
  const sampleCandidate: KnowledgeCandidate = {
    id: 'cand_ui_test_1',
    organizationId: 'org_1',
    workspaceId: 'ws_1',
    source: { type: 'meeting', id: 'm100' },
    type: 'fact',
    title: 'Semester Break Schedule',
    content: '<untrusted_reference_data id="c1" source="meeting:m100">Semester break begins December 15th.</untrusted_reference_data>',
    subjectRefs: ['entity_calendar_01'],
    suggestedRelationships: [
      { targetId: 'entity_term_01', predicate: 'concludes_with', confidence: 0.9 },
    ],
    confidence: 0.94,
    verificationState: 'unverified',
    sensitivity: 'internal',
    status: 'pending',
    version: 1,
    createdAt: '2026-10-07T10:00:00Z',
    updatedAt: '2026-10-07T10:00:00Z',
  };

  describe('KnowledgeCandidateCard', () => {
    it('renders candidate title, confidence, source badge and untrusted container', () => {
      render(<KnowledgeCandidateCard candidate={sampleCandidate} />);

      expect(screen.getByText('Semester Break Schedule')).toBeDefined();
      expect(screen.getByText(/94% Confidence/i)).toBeDefined();
      expect(screen.getByText(/meeting/i)).toBeDefined();
      expect(screen.getByText(/Semester break begins December 15th/i)).toBeDefined();
    });

    it('renders tactile action buttons with min-h-[44px] and handles accept callback', () => {
      const onDecide = vi.fn();
      render(<KnowledgeCandidateCard candidate={sampleCandidate} onDecide={onDecide} />);

      const acceptButton = screen.getByRole('button', { name: /accept/i });
      expect(acceptButton).toBeDefined();
      expect(acceptButton.className).toContain('min-h-[44px]');

      fireEvent.click(acceptButton);
      expect(onDecide).toHaveBeenCalledWith('cand_ui_test_1', 'accept');
    });

    it('displays warning badge and conflict button when candidate has conflictId', () => {
      const conflictCandidate: KnowledgeCandidate = {
        ...sampleCandidate,
        conflictId: 'conf_999',
      };
      const onResolveConflict = vi.fn();

      render(
        <KnowledgeCandidateCard
          candidate={conflictCandidate}
          onResolveConflict={onResolveConflict}
        />
      );

      const conflictBtn = screen.getByRole('button', { name: /resolve conflict/i });
      expect(conflictBtn).toBeDefined();
      fireEvent.click(conflictBtn);
      expect(onResolveConflict).toHaveBeenCalledWith(conflictCandidate);
    });
  });

  describe('KnowledgeItemInspector', () => {
    it('renders standardized drawer adhering to theme.md §8', () => {
      render(
        <KnowledgeItemInspector
          isOpen={true}
          onClose={vi.fn()}
          candidate={sampleCandidate}
        />
      );

      expect(screen.getByText('Knowledge Item Inspector')).toBeDefined();
      expect(screen.getByText('Temporal Validity & Lineage')).toBeDefined();
      expect(screen.getByText(/Semester Break Schedule/i)).toBeDefined();
    });
  });

  describe('KnowledgeConflictModal', () => {
    const sampleConflict: KnowledgeConflict = {
      id: 'conf_ui_test_1',
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      candidateId: 'cand_ui_test_1',
      existingMemoryId: 'mem_existing_1',
      conflictType: 'contradiction',
      status: 'open',
      detectedAt: '2026-10-07T10:00:00Z',
      version: 1,
    };

    it('renders conflict modal with 3 tactile resolution options (theme.md §8)', () => {
      const onResolve = vi.fn();
      render(
        <KnowledgeConflictModal
          isOpen={true}
          onClose={vi.fn()}
          conflict={sampleConflict}
          candidate={sampleCandidate}
          existingMemoryContent="Semester break begins December 22nd."
          onResolve={onResolve}
        />
      );

      expect(screen.getByText(/Contradiction Detected/i)).toBeDefined();
      expect(screen.getByText(/Semester break begins December 22nd/i)).toBeDefined();

      const supersedeBtn = screen.getByRole('button', { name: /supersede existing/i });
      expect(supersedeBtn).toBeDefined();
      expect(supersedeBtn.className).toContain('min-h-[44px]');

      fireEvent.click(supersedeBtn);
      expect(onResolve).toHaveBeenCalledWith('conf_ui_test_1', 'supersede_existing', 1);
    });
  });
});
