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

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

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
      const { queryByTitle: _queryByTitle, getByAltText, container } = render(
        <VideoEmbed url="https://www.youtube.com/watch?v=dQw4w9WgXcQ" thumbnailUrl="https://example.com/thumb.jpg" />
      );
      const thumbnail = getByAltText('Video thumbnail');
      fireEvent.click(thumbnail);
      // Now it should render the iframe
      expect(container.querySelector('iframe')).not.toBeNull();
    });

    it('does not play upon click when disabled is true', () => {
      const { queryByTitle: _queryByTitle, getByAltText, container } = render(
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
      organizationId: 'org1',
      versionNumber: 1,
      createdBy: 'user1',
      isPublishedVersion: true,
      createdAt: new Date().toISOString(),
      structureJson: {
        sections: [
          {
            id: 's1',
            type: 'section',
            props: {
              backgroundType: 'video',
              backgroundVideoUrl: 'https://example.com/bg.mp4',
            },
            blocks: [],
          },
        ],
      },
    };

    it('renders background video when isThumbnail is false', async () => {
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
      // Wait for isMounted to be set to true
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(container.querySelector('video')).not.toBeNull();
    });

    it('does not render background video when isThumbnail is true', async () => {
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
      await new Promise((resolve) => setTimeout(resolve, 10));
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

  describe('Video Block Title and Description Positions', () => {
    it('renders title and description in top position above video player', () => {
      const block: PageBlock = {
        id: 'v-top',
        type: 'video',
        props: {
          videoData: {
            videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            thumbnailUrl: 'https://example.com/thumb.jpg',
            title: 'Welcome Video Overview',
            description: 'Learn how to get started in 5 minutes.',
            titlePosition: 'top',
          },
          playMode: 'inline',
        },
      };

      const { getByText } = render(
        <BlockRenderer block={block} ctx={createCtx('view')} />
      );

      const titleEl = getByText('Welcome Video Overview');
      const descEl = getByText('Learn how to get started in 5 minutes.');
      expect(titleEl).toBeInTheDocument();
      expect(descEl).toBeInTheDocument();
    });

    it('renders title and description in bottom position below video player', () => {
      const block: PageBlock = {
        id: 'v-bottom',
        type: 'video',
        props: {
          videoData: {
            videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            thumbnailUrl: 'https://example.com/thumb.jpg',
            title: 'Bottom Title Feature',
            description: 'This is displayed underneath the player.',
            titlePosition: 'bottom',
          },
          playMode: 'inline',
        },
      };

      const { getByText } = render(
        <BlockRenderer block={block} ctx={createCtx('view')} />
      );

      expect(getByText('Bottom Title Feature')).toBeInTheDocument();
      expect(getByText('This is displayed underneath the player.')).toBeInTheDocument();
    });

    it('renders title and description in overlay position on the video thumbnail', () => {
      const block: PageBlock = {
        id: 'v-overlay',
        type: 'video',
        props: {
          videoData: {
            videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            thumbnailUrl: 'https://example.com/thumb.jpg',
            title: 'In-Line Overlay Heading',
            description: 'Translucent gradient overlay at bottom of thumbnail.',
            titlePosition: 'overlay',
          },
          playMode: 'inline',
        },
      };

      const { getByText } = render(
        <BlockRenderer block={block} ctx={createCtx('edit')} />
      );

      expect(getByText('In-Line Overlay Heading')).toBeInTheDocument();
      expect(getByText('Translucent gradient overlay at bottom of thumbnail.')).toBeInTheDocument();
    });

    it('supports variable interpolation in title and description', () => {
      const block: PageBlock = {
        id: 'v-interpolated',
        type: 'video',
        props: {
          videoData: {
            videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            thumbnailUrl: 'https://example.com/thumb.jpg',
            title: 'Hello {{name}}',
            description: 'Welcome to your onboarding {{name}}',
            titlePosition: 'top',
          },
          playMode: 'inline',
        },
      };

      const customCtx = {
        ...createCtx('view'),
        interpolate: (str: string) => str.replace(/\{\{name\}\}/g, 'Ada Lovelace'),
      };

      const { getByText } = render(
        <BlockRenderer block={block} ctx={customCtx} />
      );

      expect(getByText('Hello Ada Lovelace')).toBeInTheDocument();
      expect(getByText('Welcome to your onboarding Ada Lovelace')).toBeInTheDocument();
    });
  });
});
