import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Stub Firebase and Genkit imports
vi.mock('@/firebase', () => ({
  useFirestore: () => ({}),
  useUser: () => ({ user: { uid: 'test-user' } }),
}));

vi.mock('@/components/ui/dropdown-menu', () => {
  return {
    DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DropdownMenuItem: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
      <div onClick={onClick}>{children}</div>
    ),
  };
});

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
    fireEvent.click(screen.getByLabelText('Image actions'));
    fireEvent.click(screen.getByText('Delete Image'));
    expect(onChange).toHaveBeenCalledWith('');
  });
});
