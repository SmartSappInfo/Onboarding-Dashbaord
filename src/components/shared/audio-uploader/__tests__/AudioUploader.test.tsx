import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Stub Firebase imports
vi.mock('@/firebase', () => ({
  useFirestore: () => ({}),
  useUser: () => ({ user: { uid: 'test-user' } }),
}));

import { AudioUploader } from '../AudioUploader';

describe('AudioUploader', () => {
  it('renders empty state when value is empty', () => {
    const onChange = vi.fn();
    render(<AudioUploader value="" onChange={onChange} />);
    expect(screen.getByText('Drag & drop audio here or click to browse')).toBeInTheDocument();
    expect(screen.getByText('Upload')).toBeInTheDocument();
    expect(screen.getByText('Link')).toBeInTheDocument();
  });

  it('renders uploaded state when audioUrl is populated', () => {
    const onChange = vi.fn();
    render(<AudioUploader value="https://example.com/audio.mp3" onChange={onChange} />);
    expect(screen.getByText('audio.mp3')).toBeInTheDocument();
    expect(screen.getByText('Ready for playback')).toBeInTheDocument();
  });

  it('triggers reset and clear callback when remove is clicked', () => {
    const onChange = vi.fn();
    render(<AudioUploader value="https://example.com/audio.mp3" onChange={onChange} />);
    fireEvent.click(screen.getByTitle('Remove Audio'));
    expect(onChange).toHaveBeenCalledWith('');
  });
});
