import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as React from 'react';
import ShareEmbedDialog from '@/components/share-embed-dialog';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
      <div {...props}>{children}</div>
    ),
    span: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
      <span {...props}>{children}</span>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock toast
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock TenantContext
vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({
    activeOrganizationId: 'org_123',
    activeWorkspaceId: 'ws_456',
    activeOrganization: {
      id: 'org_123',
      name: 'Acme Academy',
      brandPrimaryColor: '#4F46E5',
    },
    activeWorkspace: {
      id: 'ws_456',
      name: 'Main Workspace',
    },
  }),
}));

// Mock useUser
vi.mock('@/firebase', () => ({
  useUser: () => ({
    user: {
      uid: 'user_789',
      displayName: 'Test Admin',
      email: 'admin@acme.edu',
    },
  }),
}));

// Mock qr-actions
const mockGetQRCodeByUrl = vi.fn();
const mockCreateQRCode = vi.fn();
const mockUpdateQRShortPath = vi.fn();
vi.mock('@/lib/qr-actions', () => ({
  getQRCodeByUrl: (...args: unknown[]) => mockGetQRCodeByUrl(...args),
  createQRCode: (...args: unknown[]) => mockCreateQRCode(...args),
  updateQRShortPath: (...args: unknown[]) => mockUpdateQRShortPath(...args),
}));

// Mock qr-preview
const mockDownloadQR = vi.fn();
vi.mock('@/app/admin/qr-studio/components/qr-preview', () => ({
  default: vi.fn(({ data }: { data: string }) => (
    <div data-testid="qr-preview-mock" data-encoded-url={data}>
      QR Preview Mock
    </div>
  )),
  downloadQR: (...args: unknown[]) => mockDownloadQR(...args),
}));

// Mock unified-qr-sheet
vi.mock('@/components/qr-studio/unified-qr-sheet', () => ({
  default: vi.fn(({ open }: { open: boolean }) => (
    open ? <div data-testid="unified-qr-sheet-mock">Unified QR Sheet Mock</div> : null
  )),
}));

describe('ShareEmbedDialog with Shortcode & QR Code Tabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetQRCodeByUrl.mockResolvedValue(null);
    mockCreateQRCode.mockResolvedValue({ id: 'qr_abc', shortPath: 'test-short' });
    mockUpdateQRShortPath.mockResolvedValue({ success: true });
  });

  it('renders all 5 tabs: Direct Link, Shortcode, QR Code, Iframe, Code Embed', () => {
    render(
      <ShareEmbedDialog
        isOpen={true}
        onOpenChange={vi.fn()}
        title="Share & Embed Survey"
        resourceName="Survey"
        publicUrl="https://smartsapp.com/surveys/onboarding-survey"
        embedUrl="https://smartsapp.com/surveys/onboarding-survey?embed=true"
      />
    );

    expect(screen.getByRole('tab', { name: /direct link|link/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /shortcode|short/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /qr code|qr/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /iframe/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /code embed|widget/i })).toBeDefined();
  });

  it('fetches existing QR/shortcode on open and populates shortcode info', async () => {
    mockGetQRCodeByUrl.mockResolvedValueOnce({
      id: 'qr_existing',
      shortPath: 'fast-onboard',
      redirectUrl: '/q/fast-onboard',
      stats: { totalScans: 42 },
      design: { foregroundColor: '#10B981' },
    });

    render(
      <ShareEmbedDialog
        isOpen={true}
        onOpenChange={vi.fn()}
        title="Share Survey"
        resourceName="Survey"
        publicUrl="https://smartsapp.com/surveys/onboarding-survey"
        embedUrl="https://smartsapp.com/surveys/onboarding-survey?embed=true"
        workspaceId="ws_456"
        organizationId="org_123"
        initialTab="shortcode"
      />
    );

    await waitFor(() => {
      expect(mockGetQRCodeByUrl).toHaveBeenCalledWith(
        'org_123',
        'ws_456',
        'https://smartsapp.com/surveys/onboarding-survey'
      );
    });

    // Should display existing shortcode link
    await waitFor(() => {
      const input = screen.getByDisplayValue(/fast-onboard/);
      expect(input).toBeDefined();
    });
  });

  it('allows creating a shortcode if none exists', async () => {
    mockGetQRCodeByUrl.mockResolvedValue(null);

    render(
      <ShareEmbedDialog
        isOpen={true}
        onOpenChange={vi.fn()}
        title="Share Survey"
        resourceName="Survey"
        publicUrl="https://smartsapp.com/surveys/onboarding-survey"
        embedUrl="https://smartsapp.com/surveys/onboarding-survey?embed=true"
        workspaceId="ws_456"
        organizationId="org_123"
        initialTab="shortcode"
      />
    );

    // Click "Generate Shortcode" button
    const createBtn = await screen.findByRole('button', { name: /generate shortcode|create shortlink/i });
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(mockCreateQRCode).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org_123',
          workspaceId: 'ws_456',
          mode: 'dynamic',
          destination: { url: 'https://smartsapp.com/surveys/onboarding-survey' },
        })
      );
    });
  });

  it('renders QR code tab with preview and triggers download', async () => {
    mockGetQRCodeByUrl.mockResolvedValueOnce({
      id: 'qr_existing',
      shortPath: 'fast-onboard',
      redirectUrl: '/q/fast-onboard',
      stats: { totalScans: 10 },
      design: { foregroundColor: '#4F46E5' },
    });

    render(
      <ShareEmbedDialog
        isOpen={true}
        onOpenChange={vi.fn()}
        title="Share Survey"
        resourceName="Survey"
        publicUrl="https://smartsapp.com/surveys/onboarding-survey"
        embedUrl="https://smartsapp.com/surveys/onboarding-survey?embed=true"
        workspaceId="ws_456"
        organizationId="org_123"
        initialTab="qr"
      />
    );

    // Should display QR Preview component
    const preview = await screen.findByTestId('qr-preview-mock');
    expect(preview).toBeDefined();

    // Trigger PNG download button
    const downloadPngBtn = screen.getByRole('button', { name: /download png|png/i });
    fireEvent.click(downloadPngBtn);

    await waitFor(() => {
      expect(mockDownloadQR).toHaveBeenCalled();
    });
  });

  it('allows updating an existing shortcode slug', async () => {
    mockGetQRCodeByUrl.mockResolvedValueOnce({
      id: 'qr_existing',
      shortPath: 'old-slug',
      redirectUrl: '/q/old-slug',
      stats: { totalScans: 5 },
      design: { foregroundColor: '#4F46E5' },
    });

    render(
      <ShareEmbedDialog
        isOpen={true}
        onOpenChange={vi.fn()}
        title="Share Survey"
        resourceName="Survey"
        publicUrl="https://smartsapp.com/surveys/onboarding-survey"
        embedUrl="https://smartsapp.com/surveys/onboarding-survey?embed=true"
        workspaceId="ws_456"
        organizationId="org_123"
        initialTab="shortcode"
      />
    );

    // Wait for existing shortcode to load
    const editBtn = await screen.findByRole('button', { name: /customize slug/i });
    fireEvent.click(editBtn);

    // Enter new slug
    const slugInput = screen.getByPlaceholderText(/my-custom-slug/i);
    fireEvent.change(slugInput, { target: { value: 'brand-new-slug' } });

    // Save
    const saveBtn = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockUpdateQRShortPath).toHaveBeenCalledWith(
        'org_123',
        'ws_456',
        'qr_existing',
        'brand-new-slug'
      );
    });
  });

  it('opens UnifiedQRSheet when QR Studio Designer button is clicked', async () => {
    render(
      <ShareEmbedDialog
        isOpen={true}
        onOpenChange={vi.fn()}
        title="Share Survey"
        resourceName="Survey"
        publicUrl="https://smartsapp.com/surveys/onboarding-survey"
        embedUrl="https://smartsapp.com/surveys/onboarding-survey?embed=true"
        workspaceId="ws_456"
        organizationId="org_123"
        initialTab="qr"
      />
    );

    const studioBtn = await screen.findByRole('button', { name: /qr studio designer/i });
    fireEvent.click(studioBtn);

    const sheet = await screen.findByTestId('unified-qr-sheet-mock');
    expect(sheet).toBeDefined();
  });
});
