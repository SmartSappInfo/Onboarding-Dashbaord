import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Stub Firebase and Genkit imports
vi.mock('@/firebase', () => ({
  useFirestore: () => ({}),
  useUser: () => ({ user: { uid: 'test-user' } }),
}));

import { ImageUploader } from '../ImageUploader';

describe('ImageUploader', () => {
  it('renders empty state when value is empty', () => {
    const onChange = vi.fn();
    render(<ImageUploader value="" onChange={onChange} />);
    expect(screen.getByText('Drag & drop image here or click to browse')).toBeInTheDocument();
  });

  it('renders uploaded state when value is a valid URL', () => {
    const onChange = vi.fn();
    render(<ImageUploader value="https://example.com/asset.png" onChange={onChange} />);
    expect(screen.getByAltText('Uploaded asset')).toBeInTheDocument();
  });

  it('triggers remove callback when remove button is clicked', () => {
    const onChange = vi.fn();
    render(<ImageUploader value="https://example.com/asset.png" onChange={onChange} />);
    fireEvent.click(screen.getByText('Remove'));
    expect(onChange).toHaveBeenCalledWith('');
  });
});
