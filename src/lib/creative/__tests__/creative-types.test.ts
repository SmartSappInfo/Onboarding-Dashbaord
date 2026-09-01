import { describe, it, expect } from 'vitest';
import {
  thumbnailDesignToCreativeProject,
  creativeDocumentToThumbnailDesign,
  FORMAT_PRESETS,
  makeUniqueId,
} from '../creative-types';
import type { ThumbnailDesign } from '@/lib/thumbnail/thumbnail-types';

describe('Creative Types & Bidirectional Adapters', () => {
  it('should convert a legacy ThumbnailDesign to CreativeProject and CreativeDocument cleanly', () => {
    const legacy: ThumbnailDesign = {
      id: 'legacy-123',
      workspaceId: 'ws-abc',
      name: 'Legacy Masterclass Cover',
      backgroundColor: '#0f172a',
      backgroundGradient: {
        type: 'linear',
        angle: 135,
        colors: ['#0f172a', '#1e1b4b'],
      },
      elements: [
        {
          id: 'el-1',
          type: 'text',
          x: 20,
          y: 30,
          width: 60,
          height: 20,
          zIndex: 1,
          text: 'HOW TO SCALE',
          fontSize: 48,
          fontFamily: 'Impact',
          fill: '#facc15',
        },
        {
          id: 'el-2',
          type: 'image',
          x: 60,
          y: 10,
          width: 35,
          height: 80,
          zIndex: 2,
          imageSrc: 'https://example.com/face.png',
        },
      ],
      thumbnailUrl: 'https://example.com/preview.png',
      createdAt: '2026-07-01T12:00:00Z',
      updatedAt: '2026-07-01T12:00:00Z',
    };

    const { project, document } = thumbnailDesignToCreativeProject(legacy);

    expect(project.id).toBe('legacy-123');
    expect(project.workspaceId).toBe('ws-abc');
    expect(project.name).toBe('Legacy Masterclass Cover');
    expect(project.type).toBe('youtube_thumbnail');
    expect(project.thumbnailUrl).toBe('https://example.com/preview.png');

    expect(document.id).toBe('doc-legacy-123');
    expect(document.projectId).toBe('legacy-123');
    expect(document.elements).toHaveLength(2);
    expect(document.elements[0].semanticRole).toBe('headline');
    expect(document.elements[1].semanticRole).toBe('subject');
    expect(document.format.aspectRatio).toBeCloseTo(16 / 9);
  });

  it('should convert a CreativeDocument back to legacy ThumbnailDesign without data loss', () => {
    const { project, document } = thumbnailDesignToCreativeProject({
      id: 'legacy-456',
      workspaceId: 'ws-xyz',
      name: 'Reversible Test',
      backgroundColor: '#000000',
      elements: [],
      createdAt: '2026-07-01T12:00:00Z',
      updatedAt: '2026-07-01T12:00:00Z',
    });

    const convertedBack = creativeDocumentToThumbnailDesign(document);

    expect(convertedBack.id).toBe(project.id);
    expect(convertedBack.workspaceId).toBe('ws-xyz');
    expect(convertedBack.name).toBe('Reversible Test');
    expect(convertedBack.backgroundColor).toBe('#000000');
  });

  it('should have standard format presets configured', () => {
    expect(FORMAT_PRESETS.youtube_thumbnail.width).toBe(1280);
    expect(FORMAT_PRESETS.youtube_thumbnail.height).toBe(720);
    expect(FORMAT_PRESETS.social.aspectRatio).toBe(1);
    expect(FORMAT_PRESETS.ad.width).toBe(1200);
    expect(FORMAT_PRESETS.email.width).toBe(600);
  });

  it('should generate unique IDs', () => {
    const id1 = makeUniqueId();
    const id2 = makeUniqueId();
    expect(id1).not.toBe(id2);
  });
});
