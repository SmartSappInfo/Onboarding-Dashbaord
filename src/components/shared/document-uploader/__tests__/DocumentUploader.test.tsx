import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyState } from '../EmptyState';
import { UploadedState } from '../UploadedState';
import { UrlDialog } from '../UrlDialog';
import { DocumentUploader } from '../DocumentUploader';

// Mock contexts and Firebase
vi.mock('@/firebase', () => ({
  useFirestore: vi.fn(() => ({})),
  useUser: vi.fn(() => ({ user: { uid: 'user_123' } })),
}));

vi.mock('@/context/WorkspaceContext', () => ({
  useWorkspace: vi.fn(() => ({ activeWorkspaceId: 'ws_test' })),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}));

vi.mock('@/lib/page-builder/upload', () => ({
  uploadPageMedia: vi.fn().mockResolvedValue('https://firebasestorage.googleapis.com/v0/b/app/o/sample.xlsx'),
}));

vi.mock('@/app/admin/media/components/media-selector-dialog', () => ({
  default: vi.fn(() => <div data-testid="media-selector-dialog" />),
}));

describe('DocumentUploader Submodules', () => {
  describe('EmptyState', () => {
    it('renders drag-and-drop prompt and all 3 action triggers', () => {
      const onTriggerUpload = vi.fn();
      const onOpenMedia = vi.fn();
      const onOpenLink = vi.fn();
      const onDropFiles = vi.fn();

      render(
        <EmptyState
          onTriggerUpload={onTriggerUpload}
          onOpenMedia={onOpenMedia}
          onOpenLink={onOpenLink}
          onDropFiles={onDropFiles}
          maxSizeMB={50}
        />
      );

      expect(screen.getByText(/Drag & drop document or choose below/i)).toBeInTheDocument();
      expect(screen.getByText(/Upload File/i)).toBeInTheDocument();
      expect(screen.getByText(/Media Documents/i)).toBeInTheDocument();
      expect(screen.getByText(/Cloud Link/i)).toBeInTheDocument();

      fireEvent.click(screen.getByText(/Upload File/i));
      expect(onTriggerUpload).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByText(/Media Documents/i));
      expect(onOpenMedia).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByText(/Cloud Link/i));
      expect(onOpenLink).toHaveBeenCalledTimes(1);
    });
  });

  describe('UploadedState', () => {
    it('renders file details and action controls', () => {
      const onTriggerUpload = vi.fn();
      const onOpenMedia = vi.fn();
      const onOpenLink = vi.fn();
      const onRemove = vi.fn();

      render(
        <UploadedState
          url="https://firebasestorage.googleapis.com/v0/b/app/o/1740000000000-Staff_Roster.xlsx"
          fileName="Staff_Roster.xlsx"
          onTriggerUpload={onTriggerUpload}
          onOpenMedia={onOpenMedia}
          onOpenLink={onOpenLink}
          onRemove={onRemove}
        />
      );

      expect(screen.getByText('Staff_Roster.xlsx')).toBeInTheDocument();
      expect(screen.getByText('XLSX')).toBeInTheDocument();

      // Click remove button
      const removeBtn = screen.getByTitle(/Remove Document/i);
      fireEvent.click(removeBtn);
      expect(onRemove).toHaveBeenCalledTimes(1);

      // Click change button to reveal replace options
      const changeBtn = screen.getByTitle(/Change Document Source/i);
      fireEvent.click(changeBtn);
      expect(screen.getByText(/Replace with:/i)).toBeInTheDocument();
    });
  });

  describe('UrlDialog', () => {
    it('validates URLs and calls onConfirm with clean filename', () => {
      const onConfirm = vi.fn();
      const onOpenChange = vi.fn();

      render(
        <UrlDialog
          open={true}
          onOpenChange={onOpenChange}
          onConfirm={onConfirm}
        />
      );

      const urlInput = screen.getByPlaceholderText(/https:\/\/docs\.google\.com/i);
      const submitBtn = screen.getByText('Attach Document');

      // Invalid / untrusted URL
      fireEvent.change(urlInput, { target: { value: 'https://evil.test/payload.exe' } });
      expect(submitBtn).toBeDisabled();

      // Valid cloud provider URL
      fireEvent.change(urlInput, {
        target: { value: 'https://docs.google.com/spreadsheets/d/12345/export' },
      });
      expect(submitBtn).not.toBeDisabled();

      fireEvent.click(submitBtn);
      expect(onConfirm).toHaveBeenCalledWith(
        'https://docs.google.com/spreadsheets/d/12345/export',
        expect.any(String)
      );
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('DocumentUploader', () => {
    it('renders EmptyState when value is empty', () => {
      render(<DocumentUploader value="" />);
      expect(screen.getByText(/Drag & drop document or choose below/i)).toBeInTheDocument();
    });

    it('renders UploadedState when value is present', () => {
      render(
        <DocumentUploader
          value="https://firebasestorage.googleapis.com/v0/b/app/o/Staff_Roster.xlsx"
          fileName="Staff_Roster.xlsx"
        />
      );
      expect(screen.getByText('Staff_Roster.xlsx')).toBeInTheDocument();
    });
  });
});
