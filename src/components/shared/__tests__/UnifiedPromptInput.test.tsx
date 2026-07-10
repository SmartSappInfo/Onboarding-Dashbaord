import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import UnifiedPromptInput from '../UnifiedPromptInput';

// Mock hook and component imports that are used inside UnifiedPromptInput
vi.mock('@/hooks/use-live-ai-model', () => ({
  useLiveAiModel: () => ({
    modelId: 'gemini-3.5-flash',
  }),
}));

vi.mock('@/components/ai/AiModelSelector', () => {
  return {
    __esModule: true,
    default: function MockAiModelSelector() {
      return <div data-testid="mock-ai-model-selector">Mock AI Model Selector</div>;
    },
  };
});

// Mock Popover components since we don't want to test Radix UI internals directly
vi.mock('@/components/ui/popover', () => {
  return {
    Popover: ({ children }: { children: React.ReactNode }) => <div data-testid="popover-root">{children}</div>,
    PopoverTrigger: ({ children }: { children: React.ReactNode }) => <div data-testid="popover-trigger">{children}</div>,
    PopoverContent: ({ children }: { children: React.ReactNode }) => <div data-testid="popover-content">{children}</div>,
  };
});

describe('UnifiedPromptInput', () => {
  it('renders textarea and buttons correctly', () => {
    const mockSubmit = vi.fn();
    render(
      <UnifiedPromptInput
        value=""
        onChange={() => {}}
        onSubmit={mockSubmit}
        placeholder="Type a message"
      />
    );
    expect(screen.getByPlaceholderText('Type a message')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });
});
