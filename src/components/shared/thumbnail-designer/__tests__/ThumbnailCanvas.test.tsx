import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { expect, test, describe, vi } from 'vitest';
import ThumbnailCanvas from '../ThumbnailCanvas';

// Mock ResizeObserver which doesn't exist in jsdom environment by default
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', MockResizeObserver);

describe('ThumbnailCanvas Component', () => {
  const elements = [
    { id: 'el-1', type: 'text' as const, x: 10, y: 10, width: 30, height: 10, text: 'Test Hook Text', zIndex: 1 }
  ];

  test('renders text layer content correctly', () => {
    render(
      <ThumbnailCanvas
        backgroundColor="#000000"
        elements={elements}
        selectedId={null}
        onSelectElement={() => {}}
        onUpdateElement={() => {}}
      />
    );
    
    expect(screen.getByText('Test Hook Text')).toBeDefined();
  });
});
