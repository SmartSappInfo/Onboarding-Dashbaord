import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { getBlock } from '@/lib/page-builder/registry';
import '@/lib/page-builder/blocks/procedure-list';
import type { ProcedureBlockProps } from '@/lib/page-builder/blocks/procedure-list';
import type { BlockRenderContext } from '@/lib/page-builder/registry';
import { resolveTheme } from '@/lib/page-builder/resolve-theme';

function createMockContext(mode: 'view' | 'edit' = 'view', onPropChange = vi.fn()): BlockRenderContext {
  return {
    mode,
    theme: resolveTheme(),
    interpolate: (str: string) => str,
    resources: {
      forms: [],
      surveys: [],
      agreements: [],
      meetings: [],
      qrCodes: [],
    },
    onPropChange,
  };
}

describe('Procedure Block Runtime Rendering', () => {
  const blockDef = getBlock('procedure_list');
  if (!blockDef) throw new Error('procedure_list block not registered');

  it('renders title and subtitle on canvas', () => {
    const props: ProcedureBlockProps = {
      title: 'Fidelity USSD Payment Guide',
      subtitle: 'Follow these 3 quick steps to settle tuition fees',
      preset: 'connected-timeline',
      steps: [
        { id: 's1', title: 'Dial *712#', description: 'Enter code on your phone dialer', badgeText: '', timeEstimate: '' },
      ],
      imageUrl: '',
      videoUrl: '',
      mediaPosition: 'hidden',
      accentColor: '#10b981',
      showStepNumbers: true,
    };

    const ctx = createMockContext('view');
    render(blockDef.render(props, { id: 'proc-1', type: 'procedure_list', props }, ctx));

    expect(screen.getByText('Fidelity USSD Payment Guide')).toBeDefined();
    expect(screen.getByText('Follow these 3 quick steps to settle tuition fees')).toBeDefined();
    expect(screen.getByText('Dial *712#')).toBeDefined();
    expect(screen.getByText('Enter code on your phone dialer')).toBeDefined();
  });

  it('renders interactive empty state in edit mode when no steps exist', () => {
    const props: ProcedureBlockProps = {
      title: 'Procedure Guide',
      subtitle: '',
      preset: 'connected-timeline',
      steps: [],
      imageUrl: '',
      videoUrl: '',
      mediaPosition: 'top',
      accentColor: '#10b981',
      showStepNumbers: true,
    };

    const onPropChange = vi.fn();
    const ctx = createMockContext('edit', onPropChange);
    render(blockDef.render(props, { id: 'proc-empty', type: 'procedure_list', props }, ctx));

    expect(screen.getByText('No procedure steps yet')).toBeDefined();
    const addFirstStepBtn = screen.getByRole('button', { name: /add first step/i });
    expect(addFirstStepBtn).toBeDefined();

    fireEvent.click(addFirstStepBtn);
    expect(onPropChange).toHaveBeenCalledTimes(1);
    expect(onPropChange.mock.calls[0][0].steps).toHaveLength(1);
  });

  it('renders connected-timeline preset with connected vertical accent line', () => {
    const props: ProcedureBlockProps = {
      title: 'Enrollment Roadmap',
      subtitle: 'Your journey from discovery to classroom',
      preset: 'connected-timeline',
      steps: [
        { id: 's1', title: 'Campus Tour', description: 'Visit classroom', badgeText: 'Step 1', timeEstimate: '45m' },
        { id: 's2', title: 'Application', description: 'Submit forms', badgeText: 'Step 2', timeEstimate: '15m' },
      ],
      imageUrl: '',
      videoUrl: '',
      mediaPosition: 'hidden',
      accentColor: '#3b82f6',
      showStepNumbers: true,
    };

    const ctx = createMockContext('view');
    const { container } = render(blockDef.render(props, { id: 'proc-timeline', type: 'procedure_list', props }, ctx));

    expect(container.querySelector('[data-preset="connected-timeline"]')).toBeDefined();
    expect(screen.getByText('Campus Tour')).toBeDefined();
    expect(screen.getByText('45m')).toBeDefined();
    expect(screen.getByText('Step 1')).toBeDefined();
    expect(screen.getByText('Application')).toBeDefined();
  });

  it('renders elevated-cards preset with distinct cards', () => {
    const props: ProcedureBlockProps = {
      title: 'SOP Process Cards',
      subtitle: '',
      preset: 'elevated-cards',
      steps: [
        { id: 's1', title: 'Verify Account', description: 'Confirm email and phone', badgeText: 'Security', timeEstimate: '2m' },
        { id: 's2', title: 'Create Workspace', description: 'Set up your first space', badgeText: 'Setup', timeEstimate: '5m' },
      ],
      imageUrl: '',
      videoUrl: '',
      mediaPosition: 'hidden',
      accentColor: '#10b981',
      showStepNumbers: true,
    };

    const ctx = createMockContext('view');
    const { container } = render(blockDef.render(props, { id: 'proc-cards', type: 'procedure_list', props }, ctx));

    expect(container.querySelector('[data-preset="elevated-cards"]')).toBeDefined();
    expect(screen.getByText('Verify Account')).toBeDefined();
    expect(screen.getByText('Confirm email and phone')).toBeDefined();
    expect(screen.getByText('Security')).toBeDefined();
  });

  it('renders split-media preset with 2-column layout when media is present', () => {
    const props: ProcedureBlockProps = {
      title: 'USSD Diagram Guide',
      subtitle: '',
      preset: 'split-media',
      imageUrl: 'https://example.com/ussd-cheat-sheet.png',
      videoUrl: '',
      mediaPosition: 'left',
      steps: [
        { id: 's1', title: 'Dial Code', description: 'Type *170#', badgeText: '', timeEstimate: '' },
      ],
      accentColor: '#10b981',
      showStepNumbers: true,
    };

    const ctx = createMockContext('view');
    const { container } = render(blockDef.render(props, { id: 'proc-split', type: 'procedure_list', props }, ctx));

    expect(container.querySelector('[data-preset="split-media"]')).toBeDefined();
    const img = container.querySelector('img');
    expect(img?.getAttribute('src')).toBe('https://example.com/ussd-cheat-sheet.png');
    expect(screen.getByText('Dial Code')).toBeDefined();
  });
});
