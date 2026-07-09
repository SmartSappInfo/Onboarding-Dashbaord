import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import type { PageBlock, CampaignPageVersion } from '@/lib/types';
import { BlockRenderer } from '../BlockRenderer';
import { PageRenderer } from '../PageRenderer';
import VideoEmbed from '../../video-embed';
import { resolveTheme } from '@/lib/page-builder/resolve-theme';
import type { BlockRenderContext, BlockMode } from '@/lib/page-builder/registry';
import '@/lib/page-builder/blocks'; // side-effect: register all blocks

function createCtx(mode: BlockMode, isThumbnail = false): BlockRenderContext {
  return {
    mode,
    theme: resolveTheme(),
    interpolate: (t) => t,
    resources: { forms: [], surveys: [], agreements: [] },
    onPropChange: () => {},
    fireTrigger: () => {},
    isThumbnail,
  };
}

describe('Video Components and Autoplay behavior', () => {
  describe('VideoEmbed', () => {
    it('does not autoplay by default and shows the play button/thumbnail', () => {
      const { queryByTitle, getByAltText } = render(
        <VideoEmbed url="https://www.youtube.com/watch?v=dQw4w9WgXcQ" thumbnailUrl="https://example.com/thumb.jpg" />
      );
      // It should render the thumbnail image
      expect(getByAltText('Video thumbnail')).toBeInTheDocument();
      // It should NOT render the iframe yet because isPlaying is false
      expect(queryByTitle('Video player')).toBeNull();
    });

    it('renders iframe/video upon click when not disabled', () => {
      const { queryByTitle, getByAltText, container } = render(
        <VideoEmbed url="https://www.youtube.com/watch?v=dQw4w9WgXcQ" thumbnailUrl="https://example.com/thumb.jpg" />
      );
      const thumbnail = getByAltText('Video thumbnail');
      fireEvent.click(thumbnail);
      // Now it should render the iframe
      expect(container.querySelector('iframe')).not.toBeNull();
    });

    it('does not play upon click when disabled is true', () => {
      const { queryByTitle, getByAltText, container } = render(
        <VideoEmbed url="https://www.youtube.com/watch?v=dQw4w9WgXcQ" thumbnailUrl="https://example.com/thumb.jpg" disabled={true} />
      );
      const thumbnail = getByAltText('Video thumbnail');
      fireEvent.click(thumbnail);
      // It should still NOT render the iframe
      expect(container.querySelector('iframe')).toBeNull();
    });
  });

  describe('PageRenderer Background Videos', () => {
    const mockPage = {
      id: 'page1',
      organizationId: 'org1',
      workspaceIds: ['ws1'],
      settings: { customScriptsAllowed: false },
    };

    const mockVersion: CampaignPageVersion = {
      id: 'v1',
      pageId: 'page1',
      name: 'v1',
      isPublished: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      structureJson: {
        sections: [
          {
            id: 's1',
            backgroundType: 'video',
            backgroundVideoUrl: 'https://example.com/bg.mp4',
            blocks: [],
          },
        ],
      },
    };

    it('renders background video when isThumbnail is false', () => {
      const { container } = render(
        <PageRenderer
          page={mockPage as any}
          version={mockVersion}
          theme={resolveTheme()}
          interpolate={(t) => t}
          fireTrigger={() => {}}
          isThumbnail={false}
        />
      );
      expect(container.querySelector('video')).not.toBeNull();
    });

    it('does not render background video when isThumbnail is true', () => {
      const { container } = render(
        <PageRenderer
          page={mockPage as any}
          version={mockVersion}
          theme={resolveTheme()}
          interpolate={(t) => t}
          fireTrigger={() => {}}
          isThumbnail={true}
        />
      );
      expect(container.querySelector('video')).toBeNull();
    });
  });

  describe('Testimonial Block Video Playback', () => {
    it('renders VideoEmbed instead of direct iframe, respecting disabled state in edit mode', () => {
      const block: PageBlock = {
        id: 't1',
        type: 'testimonial',
        props: {
          preset: 'split-video',
          videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          thumbnailUrl: 'https://example.com/thumb.jpg',
          playMode: 'inline',
        },
      };

      const { container } = render(
        <BlockRenderer block={block} ctx={createCtx('edit')} />
      );

      // In edit mode, it should render the VideoEmbed, which should show the thumbnail and not play/allow clicking to play
      expect(container.querySelector('img')).not.toBeNull();
      expect(container.querySelector('iframe')).toBeNull();

      // Attempt click
      const img = container.querySelector('img');
      if (img) fireEvent.click(img);
      expect(container.querySelector('iframe')).toBeNull();
    });

    it('renders VideoEmbed instead of direct iframe, and allows click-to-play in view mode', () => {
      const block: PageBlock = {
        id: 't1',
        type: 'testimonial',
        props: {
          preset: 'split-video',
          videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          thumbnailUrl: 'https://example.com/thumb.jpg',
          playMode: 'inline',
        },
      };

      const { container } = render(
        <BlockRenderer block={block} ctx={createCtx('view')} />
      );

      // Initially no iframe
      expect(container.querySelector('img')).not.toBeNull();
      expect(container.querySelector('iframe')).toBeNull();

      // Click to play
      const img = container.querySelector('img');
      if (img) fireEvent.click(img);
      expect(container.querySelector('iframe')).not.toBeNull();
    });
  });

  describe('Hero Block (Video Sales) Video Playback', () => {
    it('renders VideoEmbed with disabled=true in edit mode', () => {
      const block: PageBlock = {
        id: 'h1',
        type: 'hero',
        props: {
          isVideoSales: true,
          videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          thumbnailUrl: 'https://example.com/thumb.jpg',
        },
      };

      const { container } = render(
        <BlockRenderer block={block} ctx={createCtx('edit')} />
      );

      expect(container.querySelector('img')).not.toBeNull();
      expect(container.querySelector('iframe')).toBeNull();
    });
  });
});
