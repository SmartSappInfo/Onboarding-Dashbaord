import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TemplateVersionBar } from '../TemplateVersionBar';

describe('TemplateVersionBar', () => {
  const defaultProps = {
    documentName: 'DIS Parent Obligation Signing',
    onDocumentNameChange: vi.fn(),
    isDraft: true,
    hasUnsavedChanges: false,
    isSaving: false,
    currentStep: 1,
    onStepClick: vi.fn(),
    onOpenHistory: vi.fn(),
    onOpenPublish: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the document internal name and workflow stepper', () => {
    render(<TemplateVersionBar {...defaultProps} />);

    expect(screen.getByText('DIS Parent Obligation Signing')).toBeInTheDocument();

    // Workflow stepper steps
    expect(screen.getByText('Details')).toBeInTheDocument();
    expect(screen.getByText('Builder')).toBeInTheDocument();
    expect(screen.getByText('Publish')).toBeInTheDocument();
  });

  it('renders mobile 3-vertical-dots menu button in line with the document internal name', () => {
    render(<TemplateVersionBar {...defaultProps} />);

    const mobileMenuTrigger = screen.getByRole('button', { name: /document actions/i });
    expect(mobileMenuTrigger).toBeInTheDocument();
  });

  it('opens mobile dropdown menu when clicking 3-dots button and triggers actions', async () => {
    render(<TemplateVersionBar {...defaultProps} />);

    const mobileMenuTrigger = screen.getByRole('button', { name: /document actions/i });
    fireEvent.keyDown(mobileMenuTrigger, { key: 'ArrowDown' });

    // Dropdown items are rendered
    const historyItem = await screen.findByRole('menuitem', { name: /version history/i });
    expect(historyItem).toBeInTheDocument();

    const publishItem = await screen.findByRole('menuitem', { name: /publish version/i });
    expect(publishItem).toBeInTheDocument();

    // Trigger onOpenHistory
    fireEvent.click(historyItem);
    expect(defaultProps.onOpenHistory).toHaveBeenCalledTimes(1);

    // Reopen and trigger onOpenPublish
    fireEvent.keyDown(mobileMenuTrigger, { key: 'ArrowDown' });
    const publishItemSecond = await screen.findByRole('menuitem', { name: /publish version/i });
    fireEvent.click(publishItemSecond);
    expect(defaultProps.onOpenPublish).toHaveBeenCalledTimes(1);
  });

  it('triggers onStepClick when clicking a step in the workflow stepper', () => {
    render(<TemplateVersionBar {...defaultProps} />);

    const builderStepBtn = screen.getByRole('button', { name: /builder/i });
    fireEvent.click(builderStepBtn);

    expect(defaultProps.onStepClick).toHaveBeenCalledWith(2);
  });

  it('allows inline editing of the document name', () => {
    render(<TemplateVersionBar {...defaultProps} />);

    const renameBtn = screen.getByTitle('Rename document');
    fireEvent.click(renameBtn);

    const input = screen.getByRole('textbox', { name: /edit document name/i });
    expect(input).toHaveValue('DIS Parent Obligation Signing');

    fireEvent.change(input, { target: { value: 'Updated Agreement Name' } });
    const saveBtn = screen.getByTitle('Save name');
    fireEvent.click(saveBtn);

    expect(defaultProps.onDocumentNameChange).toHaveBeenCalledWith('Updated Agreement Name');
  });
});
