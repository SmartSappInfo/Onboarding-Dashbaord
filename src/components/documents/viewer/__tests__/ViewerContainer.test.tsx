import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ViewerContainer } from '../ViewerContainer';
import type { FlipbookPage } from '@/lib/types/flipbook-types';

const mockPages: FlipbookPage[] = [
  {
    id: 'p_1',
    flipbookId: 'fb_1',
    pageNumber: 1,
    imageUrl: 'https://example.com/page1.jpg',
    thumbnailUrl: 'https://example.com/thumb1.jpg',
    width: 800,
    height: 1130,
  },
  {
    id: 'p_2',
    flipbookId: 'fb_1',
    pageNumber: 2,
    imageUrl: 'https://example.com/page2.jpg',
    thumbnailUrl: 'https://example.com/thumb2.jpg',
    width: 800,
    height: 1130,
  },
];

describe('ViewerContainer Component', () => {
  it('renders page spread in flipbook mode and allows navigation', () => {
    const onNextPage = vi.fn();
    const onPrevPage = vi.fn();

    render(
      <ViewerContainer
        mode="flipbook"
        currentPage={1}
        pageCount={2}
        pages={mockPages}
        onHotspotClick={vi.fn()}
        onNextPage={onNextPage}
        onPrevPage={onPrevPage}
        onPageSelect={vi.fn()}
        zoomScale={1.0}
        panOffset={{ x: 0, y: 0 }}
        onTouchStart={vi.fn()}
        onTouchMove={vi.fn()}
        onTouchEnd={vi.fn()}
      />
    );

    expect(screen.getByAltText('Page 1')).toBeDefined();
    const nextBtn = screen.getByTitle('Next Page (ArrowRight)');
    fireEvent.click(nextBtn);
    expect(onNextPage).toHaveBeenCalled();
  });

  it('renders continuous scroll mode with all pages', () => {
    render(
      <ViewerContainer
        mode="continuous"
        currentPage={1}
        pageCount={2}
        pages={mockPages}
        onHotspotClick={vi.fn()}
        onNextPage={vi.fn()}
        onPrevPage={vi.fn()}
        onPageSelect={vi.fn()}
        zoomScale={1.0}
        panOffset={{ x: 0, y: 0 }}
        onTouchStart={vi.fn()}
        onTouchMove={vi.fn()}
        onTouchEnd={vi.fn()}
      />
    );

    expect(screen.getByText('Page 1')).toBeDefined();
    expect(screen.getByText('Page 2')).toBeDefined();
  });
});
