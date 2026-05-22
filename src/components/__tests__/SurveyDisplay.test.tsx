import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import SurveyDisplay from '@/app/surveys/[slug]/components/survey-display';
import type { Survey } from '@/lib/types';

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: vi.fn(),
  }),
  usePathname: () => '/surveys/my-survey-slug',
}));

// Mock next-themes
const mockSetTheme = vi.fn();
vi.mock('next-themes', () => ({
  useTheme: () => ({
    resolvedTheme: 'light',
    setTheme: mockSetTheme,
  }),
}));

// Mock next/image
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: any) => <img src={src} alt={alt} {...props} data-testid="next-image" />,
}));

// Mock framer-motion to avoid JSDOM layout and animation issues
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

// Mock firebase/firestore doc function
const mockDoc = vi.fn();
vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
}));

// Mock @/firebase to verify client-side doc fetching hooks are not called
const mockUseDoc = vi.fn(() => ({ data: null, loading: false }));
const mockUseFirestore = vi.fn(() => ({}));
vi.mock('@/firebase', () => ({
  useDoc: mockUseDoc,
  useFirestore: mockUseFirestore,
}));

// Mock survey-form
vi.mock('@/app/surveys/[slug]/components/survey-form', () => ({
  default: vi.fn(({ survey, onSubmitted, resolvedLogoUrl }: any) => (
    <div data-testid="survey-form" data-logo-url={resolvedLogoUrl || 'none'}>
      Survey Form for {survey.title}
      <button onClick={onSubmitted} data-testid="submit-survey-btn">
        Submit Form
      </button>
    </div>
  )),
}));

const mockSurvey: Survey = {
  id: 'survey-123',
  organizationId: 'org-123',
  workspaceIds: ['workspace-123'],
  internalName: 'Test Survey',
  title: 'Test Survey Title',
  description: 'Test Survey Description',
  slug: 'test-survey',
  status: 'published',
  elements: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  showBranding: true,
  backgroundColor: '#F1F5F9',
  backgroundPattern: 'dots',
  patternColor: '#cccccc',
  thankYouTitle: 'Thank You Title!',
  thankYouDescription: 'Your response has been recorded.',
  allowResubmission: true,
};

describe('SurveyDisplay Component', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock window.location.href writable
    delete (window as any).location;
    (window as any).location = {
      ...originalLocation,
      href: 'http://test.com/surveys/test-survey?param=value',
      pathname: '/surveys/test-survey',
    } as any;
  });

  afterEach(() => {
    (window as any).location = originalLocation;
  });

  it('renders SurveyForm once mounted', async () => {
    render(<SurveyDisplay survey={mockSurvey} />);

    // Once mounted, it transitions to SurveyForm
    await waitFor(() => {
      expect(screen.getByTestId('survey-form')).toBeInTheDocument();
    });
  });

  it('should NOT call client-side Firestore lookups (doc, useDoc, useFirestore)', async () => {
    render(<SurveyDisplay survey={mockSurvey} />);

    await waitFor(() => {
      expect(screen.getByTestId('survey-form')).toBeInTheDocument();
    });

    // Ensure Firestore/Firebase client-side calls were never made
    expect(mockDoc).not.toHaveBeenCalled();
    expect(mockUseDoc).not.toHaveBeenCalled();
    expect(mockUseFirestore).not.toHaveBeenCalled();
  });

  it('resolves logo URL prioritizing: survey logo -> entity logo -> org logo', async () => {
    // 1. Survey logo exists
    const surveyWithLogo = { ...mockSurvey, logoUrl: 'survey-logo.png' };
    const { rerender } = render(
      <SurveyDisplay
        survey={surveyWithLogo}
        entityLogoUrl="entity-logo.png"
        organizationLogoUrl="org-logo.png"
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId('survey-form')).toBeInTheDocument();
    });
    expect(screen.getByTestId('survey-form')).toHaveAttribute('data-logo-url', 'survey-logo.png');

    // 2. Entity logo exists, no survey logo
    const surveyNoLogo = { ...mockSurvey, logoUrl: undefined };
    rerender(
      <SurveyDisplay
        survey={surveyNoLogo}
        entityLogoUrl="entity-logo.png"
        organizationLogoUrl="org-logo.png"
      />
    );
    expect(screen.getByTestId('survey-form')).toHaveAttribute('data-logo-url', 'entity-logo.png');

    // 3. Organization logo exists, no survey/entity logo
    rerender(
      <SurveyDisplay
        survey={surveyNoLogo}
        entityLogoUrl={null}
        organizationLogoUrl="org-logo.png"
      />
    );
    expect(screen.getByTestId('survey-form')).toHaveAttribute('data-logo-url', 'org-logo.png');

    // 4. No logo exists
    rerender(
      <SurveyDisplay
        survey={surveyNoLogo}
        entityLogoUrl={null}
        organizationLogoUrl={null}
      />
    );
    expect(screen.getByTestId('survey-form')).toHaveAttribute('data-logo-url', 'none');
  });

  it('sets logo URL to none when showBranding is false', async () => {
    const surveyNoBranding = { ...mockSurvey, showBranding: false, logoUrl: 'survey-logo.png' };
    render(
      <SurveyDisplay
        survey={surveyNoBranding}
        entityLogoUrl="entity-logo.png"
        organizationLogoUrl="org-logo.png"
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId('survey-form')).toBeInTheDocument();
    });
    expect(screen.getByTestId('survey-form')).toHaveAttribute('data-logo-url', 'none');
  });

  it('allows toggling theme', async () => {
    render(<SurveyDisplay survey={mockSurvey} />);
    await waitFor(() => {
      expect(screen.getByTestId('survey-form')).toBeInTheDocument();
    });

    const themeToggleBtn = screen.getByRole('button', { name: /toggle theme/i });
    await userEvent.click(themeToggleBtn);

    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('displays thank you screen when form is submitted, displaying thank you info and logo', async () => {
    const surveyWithLogo = { ...mockSurvey, logoUrl: 'survey-logo.png' };
    render(<SurveyDisplay survey={surveyWithLogo} />);
    await waitFor(() => {
      expect(screen.getByTestId('survey-form')).toBeInTheDocument();
    });

    // Click submit button in the mock form
    const submitBtn = screen.getByTestId('submit-survey-btn');
    await userEvent.click(submitBtn);

    // Verify thank you screen elements are rendered
    expect(screen.getByText('Thank You Title!')).toBeInTheDocument();
    expect(screen.getByText('Your response has been recorded.')).toBeInTheDocument();

    // Verify display logo on thank you screen
    const logoImage = screen.getByTestId('next-image');
    expect(logoImage).toHaveAttribute('src', 'survey-logo.png');
  });

  it('allows resubmission and redirects back to initial page URL to preserve params', async () => {
    render(<SurveyDisplay survey={mockSurvey} />);
    await waitFor(() => {
      expect(screen.getByTestId('survey-form')).toBeInTheDocument();
    });

    // Submit
    const submitBtn = screen.getByTestId('submit-survey-btn');
    await userEvent.click(submitBtn);

    // Verify "Submit Another Response" button exists
    const resubmitBtn = screen.getByRole('button', { name: /submit another response/i });
    expect(resubmitBtn).toBeInTheDocument();

    // Click resubmit
    await userEvent.click(resubmitBtn);

    // Verify redirected to the initial URL captured on mount (includes search params)
    expect(window.location.href).toBe('http://test.com/surveys/test-survey?param=value');
  });
});
