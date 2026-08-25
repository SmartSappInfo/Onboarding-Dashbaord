import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ViewerToolbar } from '../ViewerToolbar';

describe('ViewerToolbar Component', () => {
  it('renders title, mode buttons, zoom controls, and dispatches actions', () => {
    const onModeChange = vi.fn();
    const onZoomIn = vi.fn();
    const onToggleMute = vi.fn();
    const onOpenSearch = vi.fn();

    render(
      <ViewerToolbar
        title="2026 Admissions Prospectus"
        currentPage={1}
        pageCount={12}
        viewerMode="flipbook"
        onModeChange={onModeChange}
        zoomScale={1.0}
        onZoomIn={onZoomIn}
        onZoomOut={vi.fn()}
        onResetZoom={vi.fn()}
        isMuted={false}
        onToggleMute={onToggleMute}
        isFullscreen={false}
        onToggleFullscreen={vi.fn()}
        isHighContrast={false}
        onToggleHighContrast={vi.fn()}
        onOpenSearch={onOpenSearch}
        onOpenThumbnails={vi.fn()}
        onPageSelect={vi.fn()}
      />
    );

    expect(screen.getByText('2026 Admissions Prospectus')).toBeDefined();

    // Mode switch to Slide
    const slideBtn = screen.getByTitle('Single Slide Presentation Mode');
    fireEvent.click(slideBtn);
    expect(onModeChange).toHaveBeenCalledWith('presentation');

    // Zoom In
    const zoomInBtn = screen.getByTitle('Zoom in (+)');
    fireEvent.click(zoomInBtn);
    expect(onZoomIn).toHaveBeenCalled();

    // Search button
    const searchBtn = screen.getByTitle('Search publication (Enter keywords)');
    fireEvent.click(searchBtn);
    expect(onOpenSearch).toHaveBeenCalled();
  });
});
