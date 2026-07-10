import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Stub Firebase imports
vi.mock('@/firebase', () => ({
  useFirestore: () => ({}),
  useUser: () => ({ user: { uid: 'test-user' } }),
}));

import { VideoUploader, VideoUploaderValue } from '../VideoUploader';

describe('VideoUploader', () => {
  const emptyValue: VideoUploaderValue = {
    videoUrl: '',
    thumbnailUrl: '',
    title: '',
    description: '',
  };

  const filledValue: VideoUploaderValue = {
    videoUrl: 'https://example.com/video.mp4',
    thumbnailUrl: 'https://example.com/cover.png',
    title: 'Sunflower Debtor Solution',
    description: 'A detailed workflow guide.',
  };

  it('renders empty state when value has empty videoUrl', () => {
    const onChange = vi.fn();
    render(<VideoUploader value={emptyValue} onChange={onChange} />);
    expect(screen.getByText('Drag & drop video here or click to browse')).toBeInTheDocument();
  });

  it('renders uploaded state when videoUrl is populated', () => {
    const onChange = vi.fn();
    render(<VideoUploader value={filledValue} onChange={onChange} />);
    expect(screen.getByDisplayValue('Sunflower Debtor Solution')).toBeInTheDocument();
    expect(screen.getByAltText('Thumbnail preview')).toBeInTheDocument();
  });

  it('triggers reset and clear callback when remove is clicked', () => {
    const onChange = vi.fn();
    render(<VideoUploader value={filledValue} onChange={onChange} />);
    fireEvent.click(screen.getByText('Remove'));
    expect(onChange).toHaveBeenCalledWith({
      videoUrl: '',
      thumbnailUrl: '',
      title: '',
      description: '',
      fileName: undefined,
      fileSize: undefined,
    });
  });

  it('updates metadata on title input blur', () => {
    const onChange = vi.fn();
    render(<VideoUploader value={filledValue} onChange={onChange} />);
    
    // Toggle metadata accordion section
    const checkbox = screen.getByLabelText('Add Title & Description (Optional)');
    expect(checkbox).toBeInTheDocument();

    const titleInput = screen.getByPlaceholderText('Enter video title...');
    fireEvent.change(titleInput, { target: { value: 'Sunflower Debtor Solution - Updated' } });
    fireEvent.blur(titleInput);

    expect(onChange).toHaveBeenCalledWith({
      ...filledValue,
      title: 'Sunflower Debtor Solution - Updated',
    });
  });
});
