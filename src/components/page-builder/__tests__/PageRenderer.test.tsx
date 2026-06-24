import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { CampaignPageVersion } from '@/lib/types';
import { PageRenderer, type PageRendererPage } from '../PageRenderer';
import { resolveTheme } from '@/lib/page-builder/resolve-theme';

const page: PageRendererPage = {
  id: 'p1',
  organizationId: 'o1',
  workspaceIds: ['w1'],
  settings: { customScriptsAllowed: false },
};

function version(): CampaignPageVersion {
  return {
    id: 'v1',
    pageId: 'p1',
    organizationId: 'o1',
    versionNumber: 1,
    createdBy: 'u1',
    createdAt: '2026-06-24',
    isPublishedVersion: true,
    structureJson: {
      sections: [
        {
          id: 's1',
          type: 'section',
          props: { heading: 'Welcome' },
          blocks: [
            { id: 't1', type: 'text', props: { content: '<p>Body copy</p>' } },
            { id: 'c1', type: 'cta', props: { label: 'Go now', url: '' } },
          ],
        },
      ],
    },
  };
}

describe('PageRenderer', () => {
  it('renders section headings and block content', () => {
    render(
      <PageRenderer page={page} version={version()} theme={resolveTheme()} interpolate={(t) => t} fireTrigger={() => {}} />,
    );
    expect(screen.getByText('Welcome')).toBeInTheDocument();
    expect(screen.getByText('Body copy')).toBeInTheDocument();
    expect(screen.getByText('Go now')).toBeInTheDocument();
  });

  it('fires a block_click trigger when a CTA is clicked', () => {
    const fireTrigger = vi.fn();
    render(
      <PageRenderer page={page} version={version()} theme={resolveTheme()} interpolate={(t) => t} fireTrigger={fireTrigger} />,
    );
    fireEvent.click(screen.getByText('Go now'));
    expect(fireTrigger).toHaveBeenCalledWith('block_click', 'c1');
  });

  it('interpolates tokens in headings and content', () => {
    const v = version();
    v.structureJson.sections[0].props.heading = 'Hi {{name}}';
    render(
      <PageRenderer page={page} version={v} theme={resolveTheme()} interpolate={(t) => t.replace('{{name}}', 'Ada')} fireTrigger={() => {}} />,
    );
    expect(screen.getByText('Hi Ada')).toBeInTheDocument();
  });
});
