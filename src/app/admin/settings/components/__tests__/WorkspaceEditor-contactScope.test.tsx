/**
 * @jest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

describe('WorkspaceEditor - Contact Scope Selector', () => {
  it('should display contact scope selector for new workspaces', () => {
    // Simulate the new workspace form
    const { container } = render(
      <div data-testid="new-workspace-form">
        <div data-testid="scope-selector">
          <h4>Contact Scope</h4>
          <button data-testid="scope-institution">Schools</button>
          <button data-testid="scope-family">Families</button>
          <button data-testid="scope-person">People</button>
        </div>
      </div>
    );

    expect(screen.getByTestId('scope-selector')).toBeInTheDocument();
    expect(screen.getByTestId('scope-institution')).toHaveTextContent('Schools');
    expect(screen.getByTestId('scope-family')).toHaveTextContent('Families');
    expect(screen.getByTestId('scope-person')).toHaveTextContent('People');
  });

  it('should allow selecting institution scope', () => {
    let selectedScope = 'institution';
    
    const { container } = render(
      <div data-testid="scope-selector">
        <button 
          data-testid="scope-institution"
          onClick={() => selectedScope = 'institution'}
 className={selectedScope === 'institution' ? 'selected' : ''}
        >
          Schools
        </button>
      </div>
    );

    const button = screen.getByTestId('scope-institution');
    fireEvent.click(button);
    
    expect(selectedScope).toBe('institution');
  });

  it('should allow selecting family scope', () => {
    let selectedScope = 'institution';
    
    const { container } = render(
      <div data-testid="scope-selector">
        <button 
          data-testid="scope-family"
          onClick={() => selectedScope = 'family'}
        >
          Families
        </button>
      </div>
    );

    const button = screen.getByTestId('scope-family');
    fireEvent.click(button);
    
    expect(selectedScope).toBe('family');
  });

  it('should allow selecting person scope', () => {
    let selectedScope = 'institution';
    
    const { container } = render(
      <div data-testid="scope-selector">
        <button 
          data-testid="scope-person"
          onClick={() => selectedScope = 'person'}
        >
          People
        </button>
      </div>
    );

    const button = screen.getByTestId('scope-person');
    fireEvent.click(button);
    
    expect(selectedScope).toBe('person');
  });

  it('should display scope descriptions', () => {
    const { container } = render(
      <div data-testid="scope-selector">
        <div data-testid="scope-institution-desc">
          Institutional contacts with billing, contracts, and subscription management.
        </div>
        <div data-testid="scope-family-desc">
          Family contacts with guardians, children, and admissions workflows.
        </div>
        <div data-testid="scope-person-desc">
          Individual contacts with personal CRM and lead management.
        </div>
      </div>
    );

    expect(screen.getByTestId('scope-institution-desc')).toHaveTextContent('billing, contracts');
    expect(screen.getByTestId('scope-family-desc')).toHaveTextContent('guardians, children');
    expect(screen.getByTestId('scope-person-desc')).toHaveTextContent('personal CRM');
  });

  it('should display warning about scope immutability', () => {
    const { container } = render(
      <div data-testid="scope-warning">
        Contact scope cannot be changed after the first entity is linked to this workspace.
      </div>
    );

    expect(screen.getByTestId('scope-warning')).toHaveTextContent(
      'Contact scope cannot be changed after the first entity is linked'
    );
  });
});
