import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InteractiveLayerModal } from '../InteractiveLayerModal';
import type { FlipbookHotspot } from '@/lib/types/flipbook-types';

// Mock Toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

describe('InteractiveLayerModal Component', () => {
  it('renders video modal with embedded player iframe', () => {
    const videoHotspot: FlipbookHotspot = {
      id: 'hs_video_1',
      pageNumber: 1,
      x: 10,
      y: 10,
      width: 40,
      height: 20,
      type: 'video',
      title: 'School Introduction Video',
      targetUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    };

    render(
      <InteractiveLayerModal
        hotspot={videoHotspot}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('School Introduction Video')).toBeDefined();
    const iframe = screen.getByTitle('School Introduction Video');
    expect(iframe.getAttribute('src')).toContain('youtube.com/embed/dQw4w9WgXcQ');
  });

  it('renders WhatsApp connect prompt and triggers chat link', () => {
    const whatsappHotspot: FlipbookHotspot = {
      id: 'hs_wa_1',
      pageNumber: 1,
      x: 10,
      y: 10,
      width: 40,
      height: 20,
      type: 'whatsapp',
      title: 'Chat with Admissions',
      targetUrl: '+1234567890',
    };

    render(
      <InteractiveLayerModal
        hotspot={whatsappHotspot}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/Connect on WhatsApp/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Start WhatsApp Chat/i })).toBeDefined();
  });

  it('handles lead form submission', async () => {
    const formHotspot: FlipbookHotspot = {
      id: 'hs_form_1',
      pageNumber: 2,
      x: 10,
      y: 10,
      width: 40,
      height: 20,
      type: 'form',
      title: 'Request Information',
    };

    const onSubmitLead = vi.fn().mockResolvedValue(true);
    const onClose = vi.fn();

    render(
      <InteractiveLayerModal
        hotspot={formHotspot}
        onClose={onClose}
        onSubmitLead={onSubmitLead}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Full Name'), {
      target: { value: 'Jane Doe' },
    });
    fireEvent.change(screen.getByPlaceholderText('Email Address'), {
      target: { value: 'jane@example.com' },
    });

    const submitBtn = screen.getByRole('button', { name: /Submit Inquiry/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onSubmitLead).toHaveBeenCalledWith({
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: undefined,
      });
      expect(onClose).toHaveBeenCalled();
    });
  });
});
