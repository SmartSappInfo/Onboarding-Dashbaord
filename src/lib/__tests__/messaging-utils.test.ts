// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { resolveVariables, shouldShowBlock, renderBlocksToHtml } from '../messaging-utils';
import type { MessageBlock } from '../types';

describe('resolveVariables', () => {
  it('replaces single variables correctly', () => {
    const text = 'Hello {{contact_name}}';
    const vars = { contact_name: 'Ama' };
    expect(resolveVariables(text, vars)).toBe('Hello Ama');
  });

  it('replaces multiple variables correctly', () => {
    const text = 'Welcome to {{school_name}}, {{contact_name}}!';
    const vars = { school_name: 'GIS', contact_name: 'Kofi' };
    expect(resolveVariables(text, vars)).toBe('Welcome to GIS, Kofi!');
  });

  it('leaves missing variables untouched', () => {
    const text = 'Score: {{score}}';
    expect(resolveVariables(text, {})).toBe('Score: {{score}}');
  });

  it('handles empty text gracefully', () => {
    expect(resolveVariables('', { name: 'test' })).toBe('');
  });

  it('handles non-string inputs gracefully by coecrementing them to strings', () => {
    expect(resolveVariables(12345, {})).toBe('12345');
    expect(resolveVariables(true, {})).toBe('true');
    expect(resolveVariables(null, {})).toBe('');
    expect(resolveVariables(undefined, {})).toBe('');
    expect(resolveVariables({ foo: 'bar' }, {})).toBe('[object Object]');
  });
});

describe('shouldShowBlock', () => {
  const baseBlock: MessageBlock = {
    id: 'block_1',
    type: 'text',
    content: 'Hidden message'
  };

  it('returns true if no visibility logic is defined', () => {
    expect(shouldShowBlock(baseBlock, {})).toBe(true);
  });

  it('returns true when isEqualTo matches', () => {
    const block = {
      ...baseBlock,
      visibilityLogic: {
        matchType: 'all' as const,
        rules: [{ variableKey: 'status', operator: 'isEqualTo' as const, value: 'active' }]
      }
    };
    expect(shouldShowBlock(block, { status: 'active' })).toBe(true);
    expect(shouldShowBlock(block, { status: 'pending' })).toBe(false);
  });

  it('returns true when isGreaterThan matches', () => {
    const block = {
      ...baseBlock,
      visibilityLogic: {
        matchType: 'all' as const,
        rules: [{ variableKey: 'score', operator: 'isGreaterThan' as const, value: '50' }]
      }
    };
    expect(shouldShowBlock(block, { score: 60 })).toBe(true);
    expect(shouldShowBlock(block, { score: 40 })).toBe(false);
  });

  it('supports matchType "any"', () => {
    const block = {
      ...baseBlock,
      visibilityLogic: {
        matchType: 'any' as const,
        rules: [
          { variableKey: 'status', operator: 'isEqualTo' as const, value: 'premium' },
          { variableKey: 'score', operator: 'isGreaterThan' as const, value: '90' }
        ]
      }
    };
    expect(shouldShowBlock(block, { status: 'basic', score: 95 })).toBe(true);
    expect(shouldShowBlock(block, { status: 'premium', score: 10 })).toBe(true);
    expect(shouldShowBlock(block, { status: 'basic', score: 50 })).toBe(false);
  });
});

describe('renderBlocksToHtml with styles', () => {
  it('applies custom style colors and fonts', () => {
    const blocks: MessageBlock[] = [
      { id: '1', type: 'text', content: 'Testing custom styles' },
      { id: '2', type: 'button', title: 'Click Me', link: 'https://example.com' }
    ];
    const style = {
      backgroundColor: '#ff0000',
      cardBackgroundColor: '#00ff00',
      textColor: '#0000ff',
      fontFamily: 'Roboto',
      primaryColor: '#ffff00',
      secondaryColor: '#ff00ff',
      borderRadius: '30px',
      htmlWrapper: '{{content}}'
    };
    const html = renderBlocksToHtml(blocks, {}, { style });

    expect(html).toContain('background-color:#ff0000');
    expect(html).toContain('background-color: #00ff00');
    expect(html).toContain('color: #0000ff');
    expect(html).toContain('font-family: \'Roboto\', Helvetica, Arial, sans-serif');
    expect(html).toContain('background-color: #ffff00'); // btnBg should use primaryColor
    expect(html).toContain('box-shadow: 0 10px 15px -3px #ffff004D'); // shadowColor should use primaryColor with alpha
    expect(html).toContain('border-radius: 30px');
    expect(html).toContain('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;800;900');
  });

  it('renders heading variants correctly', () => {
    const headingBlocks = [
      {
        id: 'h1',
        type: 'heading',
        variant: 'h1',
        title: 'Left Accent Card Title',
        content: 'Left Accent Card Content',
        pillText: 'MEETING_ACCENT',
        rsvpDate: 'Thursday, Oct 26',
        rsvpTime: '10:00 AM',
        url: 'clock',
        style: {
          variant: 'left_accent'
        }
      },
      {
        id: 'h2',
        type: 'heading',
        variant: 'h1',
        title: 'Dark Slate Title',
        content: 'Dark Slate Content',
        pillText: 'SUMMIT_OCT',
        style: {
          variant: 'dark_slate'
        }
      },
      {
        id: 'h3',
        type: 'heading',
        variant: 'h1',
        title: 'Envelope Badge Title',
        content: 'Envelope Badge Content',
        pillText: 'INVITATION_ENV',
        url: 'envelope',
        style: {
          variant: 'envelope_badge'
        }
      },
      {
        id: 'h4',
        type: 'heading',
        variant: 'h1',
        title: 'Nested Card Title',
        content: 'Nested Card Content',
        pillText: 'MEETING_NESTED',
        style: {
          variant: 'nested_card'
        }
      },
      {
        id: 'h5',
        type: 'heading',
        variant: 'h1',
        title: 'Simple Wide Title',
        pillText: 'MEETING_WIDE',
        style: {
          variant: 'simple_wide'
        }
      }
    ];

    const html = renderBlocksToHtml(headingBlocks, {}, { style: { htmlWrapper: '{{content}}' } });

    // Left Accent Checks
    expect(html).toContain('border-left: 4px solid #2563eb !important;');
    expect(html).toContain('MEETING_ACCENT');
    expect(html).toContain('Left Accent Card Title');
    expect(html).toContain('Left Accent Card Content');
    expect(html).toContain('Thursday, Oct 26');
    expect(html).toContain('10:00 AM');
    expect(html).toContain('viewBox="0 0 24 24"'); // clock SVG icon check

    // Dark Slate Checks
    expect(html).toContain('color: #ffffff');
    expect(html).toContain('SUMMIT_OCT');
    expect(html).toContain('Dark Slate Title');
    expect(html).toContain('Dark Slate Content');

    // Envelope Badge Checks
    expect(html).toContain('INVITATION_ENV');
    expect(html).toContain('Envelope Badge Title');
    expect(html).toContain('Envelope Badge Content');

    // Nested Card Checks
    expect(html).toContain('Nested Card Title');
    expect(html).toContain('Nested Card Content');
    expect(html).toContain('background-color: #f8fafc'); // nested table background

    // Simple Wide Checks
    expect(html).toContain('MEETING_WIDE');
    expect(html).toContain('Simple Wide Title');
  });

  describe('audio and video action blocks', () => {
    it('compiles audio block with play_inline action and toggle styling', () => {
      const blocks: MessageBlock[] = [
        {
          id: 'test_audio_1',
          type: 'audio',
          url: 'https://example.com/audio.mp3',
          audioAction: 'play_inline',
          audioRedirectUrl: 'https://example.com/redirect-audio',
          audioTitle: 'Listen to this welcome note',
          audioDuration: '3:00'
        }
      ];

      const html = renderBlocksToHtml(blocks, {});
      expect(html).toContain('class="audio-native-test_audio_1"');
      expect(html).toContain('class="audio-card-test_audio_1"');
      expect(html).toContain('<audio src="https://example.com/audio.mp3"');
      expect(html).toContain('href="https://example.com/redirect-audio"');
      expect(html).toContain('audio-native-test_audio_1 {');
    });

    it('compiles video block with play_inline action and toggle styling', () => {
      const blocks: MessageBlock[] = [
        {
          id: 'test_video_1',
          type: 'video',
          url: 'https://example.com/video.mp4',
          videoAction: 'play_inline',
          videoRedirectUrl: 'https://example.com/redirect-video',
          videoThumbnailUrl: 'https://example.com/thumbnail.jpg'
        }
      ];

      const html = renderBlocksToHtml(blocks, {});
      expect(html).toContain('class="video-native-test_video_1"');
      expect(html).toContain('class="video-card-test_video_1"');
      expect(html).toContain('<video src="https://example.com/video.mp4"');
      expect(html).toContain('href="https://example.com/redirect-video"');
      expect(html).toContain('video-native-test_video_1 {');
    });

    it('compiles video block with redirect action without native elements', () => {
      const blocks: MessageBlock[] = [
        {
          id: 'test_video_2',
          type: 'video',
          url: 'https://example.com/video.mp4',
          videoAction: 'redirect',
          videoRedirectUrl: 'https://example.com/redirect-only'
        }
      ];

      const html = renderBlocksToHtml(blocks, {});
      expect(html).not.toContain('video-native-test_video_2');
      expect(html).toContain('href="https://example.com/redirect-only"');
    });
  });
});

