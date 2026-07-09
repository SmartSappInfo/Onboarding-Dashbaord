import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { CampaignPageVersion } from '@/lib/types';

vi.mock('@/ai/genkit', () => ({
  ai: {
    definePrompt: () => vi.fn(),
    defineFlow: () => vi.fn(),
    defineTool: () => vi.fn(),
    generate: vi.fn(),
  },
  getModel: vi.fn(),
}));
vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: () => ({
      doc: () => ({
        get: () => Promise.resolve({ exists: false }),
        set: () => Promise.resolve(),
      }),
    }),
  },
  adminAuth: {},
}));

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

  it('evaluates section visibility conditions correctly', () => {
    const v = version();
    // Add conditional rules to hide the section
    v.structureJson.sections[0].props.visibilityRuleField = 'contact_role';
    v.structureJson.sections[0].props.visibilityRuleOperator = 'equals';
    v.structureJson.sections[0].props.visibilityRuleValue = 'admin';

    // Renders nothing since variablesMap has wrong value or is empty
    const { rerender } = render(
      <PageRenderer
        page={page}
        version={v}
        theme={resolveTheme()}
        interpolate={(t) => t}
        fireTrigger={() => {}}
        variablesMap={{ contact_role: 'member' }}
      />
    );
    expect(screen.queryByText('Welcome')).not.toBeInTheDocument();

    // Rerender with matching rule value
    rerender(
      <PageRenderer
        page={page}
        version={v}
        theme={resolveTheme()}
        interpolate={(t) => t}
        fireTrigger={() => {}}
        variablesMap={{ contact_role: 'admin' }}
      />
    );
    expect(screen.getByText('Welcome')).toBeInTheDocument();
  });

  it('evaluates block level visibility conditions correctly', () => {
    const v = version();
    // Keep section visible, but hide the CTA block
    v.structureJson.sections[0].blocks[1].props = {
      ...v.structureJson.sections[0].blocks[1].props,
      visibilityRuleField: 'has_credits',
      visibilityRuleOperator: 'equals',
      visibilityRuleValue: 'true'
    };

    const { rerender } = render(
      <PageRenderer
        page={page}
        version={v}
        theme={resolveTheme()}
        interpolate={(t) => t}
        fireTrigger={() => {}}
        variablesMap={{ has_credits: 'false' }}
      />
    );
    expect(screen.getByText('Welcome')).toBeInTheDocument();
    expect(screen.queryByText('Go now')).not.toBeInTheDocument();

    rerender(
      <PageRenderer
        page={page}
        version={v}
        theme={resolveTheme()}
        interpolate={(t) => t}
        fireTrigger={() => {}}
        variablesMap={{ has_credits: 'true' }}
      />
    );
    expect(screen.getByText('Go now')).toBeInTheDocument();
  });
});
