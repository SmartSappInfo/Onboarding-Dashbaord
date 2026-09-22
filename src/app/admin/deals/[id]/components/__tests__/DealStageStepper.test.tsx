/**
 * @fileoverview Unit tests for DealStageStepper component
 */

import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DealStageStepper } from '../DealStageStepper';
import type { OnboardingStage } from '@/lib/types';

describe('DealStageStepper Component', () => {
  const mockStages: OnboardingStage[] = [
    { id: 'stage-1', name: 'Discovery', order: 0, pipelineId: 'pipe-1' },
    { id: 'stage-2', name: 'Demo Scheduled', order: 1, pipelineId: 'pipe-1' },
    { id: 'stage-3', name: 'Proposal Sent', order: 2, pipelineId: 'pipe-1' },
    { id: 'stage-4', name: 'Negotiation', order: 3, pipelineId: 'pipe-1' },
  ];

  it('renders all pipeline stages in order', () => {
    render(
      <DealStageStepper
        stages={mockStages}
        currentStageId="stage-2"
        status="open"
      />
    );

    expect(screen.getByText('Discovery')).toBeInTheDocument();
    expect(screen.getByText('Demo Scheduled')).toBeInTheDocument();
    expect(screen.getByText('Proposal Sent')).toBeInTheDocument();
    expect(screen.getByText('Negotiation')).toBeInTheDocument();
  });

  it('marks current stage with aria-current="step"', () => {
    render(
      <DealStageStepper
        stages={mockStages}
        currentStageId="stage-2"
        status="open"
      />
    );

    const activeBtn = screen.getByRole('button', { name: /Advance to Demo Scheduled/i });
    expect(activeBtn).toHaveAttribute('aria-current', 'step');
  });

  it('calls onSelectStage when an upcoming stage is clicked', () => {
    const handleSelectStage = vi.fn();

    render(
      <DealStageStepper
        stages={mockStages}
        currentStageId="stage-2"
        status="open"
        onSelectStage={handleSelectStage}
      />
    );

    const proposalBtn = screen.getByRole('button', { name: /Advance to Proposal Sent/i });
    fireEvent.click(proposalBtn);

    expect(handleSelectStage).toHaveBeenCalledTimes(1);
    expect(handleSelectStage).toHaveBeenCalledWith('stage-3');
  });

  it('does not call onSelectStage when current stage is clicked', () => {
    const handleSelectStage = vi.fn();

    render(
      <DealStageStepper
        stages={mockStages}
        currentStageId="stage-2"
        status="open"
        onSelectStage={handleSelectStage}
      />
    );

    const currentBtn = screen.getByRole('button', { name: /Advance to Demo Scheduled/i });
    fireEvent.click(currentBtn);

    expect(handleSelectStage).not.toHaveBeenCalled();
  });

  it('disables stage buttons when disabled=true', () => {
    const handleSelectStage = vi.fn();

    render(
      <DealStageStepper
        stages={mockStages}
        currentStageId="stage-2"
        status="open"
        disabled={true}
        onSelectStage={handleSelectStage}
      />
    );

    const proposalBtn = screen.getByRole('button', { name: /Advance to Proposal Sent/i });
    expect(proposalBtn).toBeDisabled();
    fireEvent.click(proposalBtn);
    expect(handleSelectStage).not.toHaveBeenCalled();
  });

  it('renders status trigger button with correct label', () => {
    const { rerender } = render(
      <DealStageStepper
        stages={mockStages}
        currentStageId="stage-2"
        status="open"
        onSelectStatus={vi.fn()}
      />
    );

    expect(screen.getByText('Open Deal')).toBeInTheDocument();

    rerender(
      <DealStageStepper
        stages={mockStages}
        currentStageId="stage-2"
        status="won"
        onSelectStatus={vi.fn()}
      />
    );

    expect(screen.getByText('Closed Won')).toBeInTheDocument();

    rerender(
      <DealStageStepper
        stages={mockStages}
        currentStageId="stage-2"
        status="lost"
        onSelectStatus={vi.fn()}
      />
    );

    expect(screen.getByText('Closed Lost')).toBeInTheDocument();
  });
});
