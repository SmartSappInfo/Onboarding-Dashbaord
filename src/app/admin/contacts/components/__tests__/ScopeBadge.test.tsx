import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScopeBadge, ScopeLabel, ScopeMismatchError, ScopeSelector } from '../ScopeBadge';
import type { ContactScope, EntityType } from '@/lib/types';

describe('ScopeBadge and Scope UI Indicators', () => {
  describe('ScopeBadge', () => {
    it('renders correct labels for each scope type', () => {
      const scopes: ContactScope[] = ['institution', 'family', 'person'];
      const expected = {
        institution: 'Institutions',
        family: 'Families',
        person: 'People',
      };

      scopes.forEach((scope) => {
        const { unmount } = render(<ScopeBadge scope={scope} />);
        expect(screen.getByText(expected[scope])).toBeInTheDocument();
        unmount();
      });
    });

    it('renders with icon when showIcon is true', () => {
      const { container } = render(<ScopeBadge scope="institution" showIcon />);
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('supports entity types including aliases', () => {
      const types: { type: EntityType; label: string }[] = [
        { type: 'institution', label: 'Institutions' },
        { type: 'family', label: 'Families' },
        { type: 'person', label: 'People' },
      ];
      types.forEach(({ type, label }) => {
        const { unmount } = render(<ScopeBadge scope={type} variant="secondary" />);
        expect(screen.getByText(label)).toBeInTheDocument();
        unmount();
      });
    });
  });

  describe('ScopeLabel', () => {
    it('displays scope management rules copy', () => {
      render(<ScopeLabel scope="institution" />);
      expect(screen.getByText(/This workspace manages/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Institutions/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Only.*records can exist here/i)).toBeInTheDocument();
    });

    it('shows lock indicator when locked is true', () => {
      render(<ScopeLabel scope="institution" locked />);
      expect(screen.getAllByText(/Locked/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/🔒 Locked/)).toBeInTheDocument();
    });

    it('hides lock indicator when locked is false', () => {
      render(<ScopeLabel scope="institution" locked={false} />);
      expect(screen.queryByText(/🔒 Locked/)).not.toBeInTheDocument();
    });
  });

  describe('ScopeMismatchError', () => {
    it('renders clear descriptive error for mismatched scope', () => {
      render(<ScopeMismatchError entityType="family" workspaceScope="institution" />);
      expect(screen.getByText(/Scope Mismatch Error/i)).toBeInTheDocument();
      expect(screen.getByText(/Families records cannot be added to a workspace that manages Institutions/i)).toBeInTheDocument();
      expect(screen.getByText(/Please select a workspace with the correct contact scope/i)).toBeInTheDocument();
    });
  });

  describe('ScopeSelector', () => {
    it('renders immutability warning and options', () => {
      const onChange = vi.fn();
      render(<ScopeSelector value="institution" onChange={onChange} />);
      expect(screen.getByText(/Scope cannot be changed after the first contact is added/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Institutions/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Families/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/People/i).length).toBeGreaterThan(0);
    });
  });
});
