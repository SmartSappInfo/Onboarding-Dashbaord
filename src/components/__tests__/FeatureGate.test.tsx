/**
 * @fileOverview Unit tests for FeatureGate component
 * 
 * Tests Requirements:
 * - 15.7: Hide features not applicable to Workspace Industry_Vertical
 * - 15.8: Validate feature access based on Workspace Industry_Vertical
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FeatureGate, FeatureGateMultiple, withFeatureGate } from '@/components/FeatureGate';
import * as IndustryContext from '@/context/IndustryContext';

// Mock the useFeatureGate hook
vi.mock('@/context/IndustryContext', async () => {
  const actual = await vi.importActual('@/context/IndustryContext');
  return {
    ...actual,
    useFeatureGate: vi.fn(),
  };
});

describe('FeatureGate', () => {
  describe('basic rendering', () => {
    it('should render children when feature is enabled', () => {
      vi.mocked(IndustryContext.useFeatureGate).mockReturnValue((feature) => {
        return feature === 'trials';
      });

      render(
        <FeatureGate feature="trials">
          <div>Trials Panel</div>
        </FeatureGate>
      );

      expect(screen.getByText('Trials Panel')).toBeInTheDocument();
    });

    it('should render null when feature is disabled and no fallback', () => {
      vi.mocked(IndustryContext.useFeatureGate).mockReturnValue(() => false);

      const { container } = render(
        <FeatureGate feature="trials">
          <div>Trials Panel</div>
        </FeatureGate>
      );

      expect(container.firstChild).toBeNull();
    });

    it('should render fallback when feature is disabled', () => {
      vi.mocked(IndustryContext.useFeatureGate).mockReturnValue(() => false);

      render(
        <FeatureGate feature="trials" fallback={<div>Feature not available</div>}>
          <div>Trials Panel</div>
        </FeatureGate>
      );

      expect(screen.getByText('Feature not available')).toBeInTheDocument();
      expect(screen.queryByText('Trials Panel')).not.toBeInTheDocument();
    });

    it('should call onDisabled callback when feature is disabled', () => {
      const onDisabled = vi.fn();
      vi.mocked(IndustryContext.useFeatureGate).mockReturnValue(() => false);

      render(
        <FeatureGate feature="trials" onDisabled={onDisabled}>
          <div>Trials Panel</div>
        </FeatureGate>
      );

      expect(onDisabled).toHaveBeenCalledTimes(1);
    });

    it('should not call onDisabled callback when feature is enabled', () => {
      const onDisabled = vi.fn();
      vi.mocked(IndustryContext.useFeatureGate).mockReturnValue(() => true);

      render(
        <FeatureGate feature="trials" onDisabled={onDisabled}>
          <div>Trials Panel</div>
        </FeatureGate>
      );

      expect(onDisabled).not.toHaveBeenCalled();
    });
  });

  describe('industry-specific features', () => {
    it('should show SaaS features for SaaS industry', () => {
      vi.mocked(IndustryContext.useFeatureGate).mockReturnValue((feature) => {
        const saasFeatures = ['trials', 'onboarding', 'subscriptions', 'healthScores', 'supportTickets'];
        return saasFeatures.includes(feature as string);
      });

      render(
        <>
          <FeatureGate feature="trials">
            <div>Trials</div>
          </FeatureGate>
          <FeatureGate feature="subscriptions">
            <div>Subscriptions</div>
          </FeatureGate>
          <FeatureGate feature="matters">
            <div>Matters</div>
          </FeatureGate>
        </>
      );

      expect(screen.getByText('Trials')).toBeInTheDocument();
      expect(screen.getByText('Subscriptions')).toBeInTheDocument();
      expect(screen.queryByText('Matters')).not.toBeInTheDocument();
    });

    it('should show SchoolEnrollment features for SchoolEnrollment industry', () => {
      vi.mocked(IndustryContext.useFeatureGate).mockReturnValue((feature) => {
        const schoolFeatures = ['applications', 'enrollments', 'schoolVisits'];
        return schoolFeatures.includes(feature as string);
      });

      render(
        <>
          <FeatureGate feature="applications">
            <div>Applications</div>
          </FeatureGate>
          <FeatureGate feature="enrollments">
            <div>Enrollments</div>
          </FeatureGate>
          <FeatureGate feature="trials">
            <div>Trials</div>
          </FeatureGate>
        </>
      );

      expect(screen.getByText('Applications')).toBeInTheDocument();
      expect(screen.getByText('Enrollments')).toBeInTheDocument();
      expect(screen.queryByText('Trials')).not.toBeInTheDocument();
    });
  });
});

describe('FeatureGateMultiple', () => {
  describe('all mode', () => {
    it('should render when all features are enabled', () => {
      vi.mocked(IndustryContext.useFeatureGate).mockReturnValue(() => true);

      render(
        <FeatureGateMultiple features={['trials', 'subscriptions']} mode="all">
          <div>Content</div>
        </FeatureGateMultiple>
      );

      expect(screen.getByText('Content')).toBeInTheDocument();
    });

    it('should not render when any feature is disabled', () => {
      vi.mocked(IndustryContext.useFeatureGate).mockReturnValue((feature) => {
        return feature === 'trials'; // Only trials enabled
      });

      const { container } = render(
        <FeatureGateMultiple features={['trials', 'subscriptions']} mode="all">
          <div>Content</div>
        </FeatureGateMultiple>
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('any mode', () => {
    it('should render when at least one feature is enabled', () => {
      vi.mocked(IndustryContext.useFeatureGate).mockReturnValue((feature) => {
        return feature === 'trials'; // Only trials enabled
      });

      render(
        <FeatureGateMultiple features={['trials', 'matters']} mode="any">
          <div>Content</div>
        </FeatureGateMultiple>
      );

      expect(screen.getByText('Content')).toBeInTheDocument();
    });

    it('should not render when all features are disabled', () => {
      vi.mocked(IndustryContext.useFeatureGate).mockReturnValue(() => false);

      const { container } = render(
        <FeatureGateMultiple features={['trials', 'matters']} mode="any">
          <div>Content</div>
        </FeatureGateMultiple>
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('fallback', () => {
    it('should render fallback when condition is not met', () => {
      vi.mocked(IndustryContext.useFeatureGate).mockReturnValue(() => false);

      render(
        <FeatureGateMultiple
          features={['trials', 'subscriptions']}
          mode="all"
          fallback={<div>Not available</div>}
        >
          <div>Content</div>
        </FeatureGateMultiple>
      );

      expect(screen.getByText('Not available')).toBeInTheDocument();
      expect(screen.queryByText('Content')).not.toBeInTheDocument();
    });
  });
});

describe('withFeatureGate', () => {
  it('should wrap component with feature gating', () => {
    vi.mocked(IndustryContext.useFeatureGate).mockReturnValue(() => true);

    const TestComponent = ({ message }: { message: string }) => <div>{message}</div>;
    const GatedComponent = withFeatureGate('trials', TestComponent);

    render(<GatedComponent message="Test Message" />);

    expect(screen.getByText('Test Message')).toBeInTheDocument();
  });

  it('should not render component when feature is disabled', () => {
    vi.mocked(IndustryContext.useFeatureGate).mockReturnValue(() => false);

    const TestComponent = ({ message }: { message: string }) => <div>{message}</div>;
    const GatedComponent = withFeatureGate('trials', TestComponent);

    const { container } = render(<GatedComponent message="Test Message" />);

    expect(container.firstChild).toBeNull();
  });

  it('should render fallback when feature is disabled', () => {
    vi.mocked(IndustryContext.useFeatureGate).mockReturnValue(() => false);

    const TestComponent = ({ message }: { message: string }) => <div>{message}</div>;
    const GatedComponent = withFeatureGate('trials', TestComponent, <div>Fallback</div>);

    render(<GatedComponent message="Test Message" />);

    expect(screen.getByText('Fallback')).toBeInTheDocument();
    expect(screen.queryByText('Test Message')).not.toBeInTheDocument();
  });

  it('should set correct displayName', () => {
    const TestComponent = ({ message }: { message: string }) => <div>{message}</div>;
    TestComponent.displayName = 'TestComponent';
    
    const GatedComponent = withFeatureGate('trials', TestComponent);

    expect(GatedComponent.displayName).toBe('withFeatureGate(TestComponent)');
  });
});
