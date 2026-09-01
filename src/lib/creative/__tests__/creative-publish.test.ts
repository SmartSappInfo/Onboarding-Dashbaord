import { describe, it, expect } from 'vitest';
import {
  normalizeTargetIdentifier,
  validatePreFlightPublishing,
  CHANNEL_SPECS,
} from '../creative-publishing-engine';
import {
  CreativeProject,
  CreativeDocument,
  PublicationRecord,
  FORMAT_PRESETS,
} from '../creative-types';

describe('Creative Publishing & Multi-Platform Distribution Engine (Phase 8)', () => {
  const mockProjectApproved: CreativeProject = {
    id: 'proj-approved',
    workspaceId: 'ws-1',
    name: 'Growth Masterclass 2026',
    type: 'youtube_thumbnail',
    objective: 'traffic',
    status: 'approved',
    createdBy: 'user-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockProjectDraft: CreativeProject = {
    id: 'proj-draft',
    workspaceId: 'ws-1',
    name: 'Draft Thumbnail',
    type: 'youtube_thumbnail',
    objective: 'traffic',
    status: 'draft',
    createdBy: 'user-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockDocument: CreativeDocument = {
    id: 'doc-1',
    projectId: 'proj-approved',
    workspaceId: 'ws-1',
    name: 'Main 16:9 Canvas',
    format: FORMAT_PRESETS.youtube_thumbnail,
    backgroundColor: '#0f172a',
    elements: [
      {
        id: 'el-text-1',
        type: 'text',
        x: 10,
        y: 20,
        width: 60,
        height: 18,
        zIndex: 1,
        text: 'GROW YOUR BUSINESS',
        fontSize: 48,
        semanticRole: 'headline',
      },
    ],
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('should normalize YouTube URLs and video IDs accurately', () => {
    expect(normalizeTargetIdentifier('youtube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(normalizeTargetIdentifier('youtube', 'https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(normalizeTargetIdentifier('youtube', 'dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('should enforce mandatory approval gate when strict mode is active', () => {
    const draftChecks = validatePreFlightPublishing(mockProjectDraft, mockDocument, 'youtube', true);
    const approvalCheck = draftChecks.find((c) => c.id === 'approval-gate');

    expect(approvalCheck?.passed).toBe(false);
    expect(approvalCheck?.severity).toBe('error');

    const approvedChecks = validatePreFlightPublishing(mockProjectApproved, mockDocument, 'youtube', true);
    const approvedCheck = approvedChecks.find((c) => c.id === 'approval-gate');
    expect(approvedCheck?.passed).toBe(true);
  });

  it('should validate format aspect ratio compatibility', () => {
    const youtubeChecks = validatePreFlightPublishing(mockProjectApproved, mockDocument, 'youtube', false);
    const formatCheck = youtubeChecks.find((c) => c.id === 'aspect-ratio');
    expect(formatCheck?.passed).toBe(true);

    const squareDocument: CreativeDocument = {
      ...mockDocument,
      format: FORMAT_PRESETS.social,
    };
    const igChecks = validatePreFlightPublishing(mockProjectApproved, squareDocument, 'instagram', false);
    const igFormatCheck = igChecks.find((c) => c.id === 'aspect-ratio');
    expect(igFormatCheck?.passed).toBe(true);
  });

  it('should validate publication record schema and channel specifications', () => {
    expect(CHANNEL_SPECS.youtube.name).toBe('YouTube');
    expect(CHANNEL_SPECS.linkedin.name).toBe('LinkedIn');

    const pubRecord: PublicationRecord = {
      id: 'pub-101',
      projectId: 'proj-approved',
      documentId: 'doc-1',
      workspaceId: 'ws-1',
      channel: 'youtube',
      targetIdentifier: 'dQw4w9WgXcQ',
      status: 'published',
      platformPostUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      authorName: 'Creative Lead',
      createdAt: new Date().toISOString(),
    };

    expect(pubRecord.channel).toBe('youtube');
    expect(pubRecord.status).toBe('published');
    expect(pubRecord.platformPostUrl).toContain('dQw4w9WgXcQ');
  });
});
