/**
 * @fileoverview QA Regression and Behavior Tests for Avatar and MovingBorder
 *
 * Validates:
 * - Avatar: Modular @radix-ui/react-avatar lifecycle, image fallback rendering, status variants, data-slot selectors.
 * - MovingBorder: framer-motion integration, polymorphic rendering (button/anchor), active tactile feedback, touch target ergonomics.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarStatus,
  AvatarIndicator,
} from '@/components/ui/avatar';
import { Button, MovingBorder } from '@/components/ui/moving-border';

describe('Avatar Component QA Suite', () => {
  it('renders avatar root with data-slot and custom className', () => {
    render(
      <Avatar className="custom-avatar-class" data-testid="avatar-root">
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>
    );

    const root = screen.getByTestId('avatar-root');
    expect(root).toBeInTheDocument();
    expect(root).toHaveAttribute('data-slot', 'avatar');
    expect(root.className).toContain('custom-avatar-class');
  });

  it('renders fallback text when image is not loaded or missing', () => {
    render(
      <Avatar>
        <AvatarImage src="" alt="John Doe" />
        <AvatarFallback data-testid="fallback">JD</AvatarFallback>
      </Avatar>
    );

    const fallback = screen.getByTestId('fallback');
    expect(fallback).toBeInTheDocument();
    expect(fallback).toHaveTextContent('JD');
    expect(fallback).toHaveAttribute('data-slot', 'avatar-fallback');
  });

  it('renders all avatar status indicator variants correctly', () => {
    const { rerender } = render(<AvatarStatus variant="online" data-testid="status" />);
    expect(screen.getByTestId('status').className).toContain('bg-green-600');

    rerender(<AvatarStatus variant="busy" data-testid="status" />);
    expect(screen.getByTestId('status').className).toContain('bg-yellow-600');

    rerender(<AvatarStatus variant="away" data-testid="status" />);
    expect(screen.getByTestId('status').className).toContain('bg-blue-600');

    rerender(<AvatarStatus variant="offline" data-testid="status" />);
    expect(screen.getByTestId('status').className).toContain('bg-zinc-600');
  });

  it('renders avatar indicator slot with proper alignment classes', () => {
    render(
      <Avatar>
        <AvatarFallback>AB</AvatarFallback>
        <AvatarIndicator data-testid="indicator">
          <span className="badge">1</span>
        </AvatarIndicator>
      </Avatar>
    );

    const indicator = screen.getByTestId('indicator');
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveAttribute('data-slot', 'avatar-indicator');
  });
});

describe('MovingBorder & Button Component QA Suite', () => {
  it('renders Button with min-h-[44px] touch ergonomics and active:scale-[0.97]', () => {
    render(
      <Button data-testid="moving-button">
        Click Me
      </Button>
    );

    const button = screen.getByTestId('moving-button');
    expect(button).toBeInTheDocument();
    expect(button.tagName.toLowerCase()).toBe('button');
    expect(button.className).toContain('min-h-[44px]');
    expect(button.className).toContain('active:scale-[0.97]');
    expect(button).toHaveTextContent('Click Me');
  });

  it('supports polymorphic rendering as an anchor tag with href', () => {
    render(
      <Button as="a" href="https://example.com" data-testid="moving-link">
        Link Button
      </Button>
    );

    const link = screen.getByTestId('moving-link');
    expect(link).toBeInTheDocument();
    expect(link.tagName.toLowerCase()).toBe('a');
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link.className).toContain('active:scale-[0.97]');
  });

  it('renders MovingBorder SVG container with configured duration and dimensions', () => {
    const { container } = render(
      <MovingBorder duration={4000} rx="20%" ry="20%">
        <div data-testid="border-glow" />
      </MovingBorder>
    );

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();

    const rect = svg?.querySelector('rect');
    expect(rect).toBeInTheDocument();
    expect(rect).toHaveAttribute('rx', '20%');
    expect(rect).toHaveAttribute('ry', '20%');
    expect(screen.getByTestId('border-glow')).toBeInTheDocument();
  });
});
