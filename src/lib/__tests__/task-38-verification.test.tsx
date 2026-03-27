/**
 * Task 38 Verification Test
 * Verifies all sub-tasks for explicit UI language for scope rules (Requirement 25)
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScopeLabel, ScopeSelector, ScopeMismatchError, ScopeBadge } from '@/app/admin/contacts/components/ScopeBadge';
import type { ContactScope, EntityType } from '@/lib/types';

describe('Task 38: Explicit UI Language for Scope Rules', () => {
  describe('38.1: Workspace settings page copy', () => {
    it('displays "This workspace manages [scope label]. Only [scope label] records can exist here." for institution', () => {
      render(<ScopeLabel scope="institution" />);
      
      expect(screen.getByText(/This workspace manages/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Schools/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Only.*records can exist here/i)).toBeInTheDocument();
    });

    it('displays correct copy for family scope', () => {
      render(<ScopeLabel scope="family" />);
      
      expect(screen.getByText(/This workspace manages/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Families/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Only.*records can exist here/i)).toBeInTheDocument();
    });

    it('displays correct copy for person scope', () => {
      render(<ScopeLabel scope="person" />);
      
      expect(screen.getByText(/This workspace manages/i)).toBeInTheDocument();
      expect(screen.getAllByText(/People/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Only.*records can exist here/i)).toBeInTheDocument();
    });
  });

  describe('38.2: Workspace creation wizard copy', () => {
    it('displays "Scope cannot be changed after the first contact is added."', () => {
      const mockOnChange = () => {};
      render(<ScopeSelector value="institution" onChange={mockOnChange} />);
      
      expect(screen.getByText(/Scope cannot be changed after the first contact is added/i)).toBeInTheDocument();
    });
  });

  describe('38.3: Clear error messages for scope violations', () => {
    it('displays human-readable error for family -> institution mismatch', () => {
      render(<ScopeMismatchError entityType="family" workspaceScope="institution" />);
      
      expect(screen.getByText(/Scope Mismatch Error/i)).toBeInTheDocument();
      expect(screen.getByText(/Families records cannot be added to a workspace that manages Schools/i)).toBeInTheDocument();
    });

    it('displays human-readable error for person -> family mismatch', () => {
      render(<ScopeMismatchError entityType="person" workspaceScope="family" />);
      
      expect(screen.getByText(/People records cannot be added to a workspace that manages Families/i)).toBeInTheDocument();
    });

    it('displays human-readable error for institution -> person mismatch', () => {
      render(<ScopeMismatchError entityType="institution" workspaceScope="person" />);
      
      expect(screen.getByText(/Schools records cannot be added to a workspace that manages People/i)).toBeInTheDocument();
    });

    it('provides guidance to select correct workspace', () => {
      render(<ScopeMismatchError entityType="family" workspaceScope="institution" />);
      
      expect(screen.getByText(/Please select a workspace with the correct contact scope or create a new workspace/i)).toBeInTheDocument();
    });
  });

  describe('38.4: Scope type badge in workspace switcher', () => {
    it('displays "Schools" badge for institution scope', () => {
      render(<ScopeBadge scope="institution" />);
      
      expect(screen.getByText(/Schools/i)).toBeInTheDocument();
    });

    it('displays "Families" badge for family scope', () => {
      render(<ScopeBadge scope="family" />);
      
      expect(screen.getByText(/Families/i)).toBeInTheDocument();
    });

    it('displays "People" badge for person scope', () => {
      render(<ScopeBadge scope="person" />);
      
      expect(screen.getByText(/People/i)).toBeInTheDocument();
    });

    it('displays badge with icon when showIcon is true', () => {
      const { container } = render(<ScopeBadge scope="institution" showIcon={true} />);
      
      // Check that an SVG icon is rendered
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('38.5: Entity type badge on contact detail page', () => {
    it('verifies ScopeBadge component can display entity types', () => {
      // Test that the badge component works with entity types
      const entityTypes: EntityType[] = ['institution', 'family', 'person'];
      
      entityTypes.forEach(type => {
        const { unmount } = render(<ScopeBadge scope={type} />);
        
        const expectedLabel = type === 'institution' ? /Schools/i : 
                             type === 'family' ? /Families/i : /People/i;
        
        expect(screen.getByText(expectedLabel)).toBeInTheDocument();
        unmount();
      });
    });
  });

  describe('38.6: Scope lock indicator in workspace settings', () => {
    it('displays lock icon when scope is locked', () => {
      render(<ScopeLabel scope="institution" locked={true} />);
      
      expect(screen.getByText(/🔒 Locked/i)).toBeInTheDocument();
    });

    it('displays tooltip text when scope is locked', () => {
      render(<ScopeLabel scope="institution" locked={true} />);
      
      expect(screen.getByText(/Scope is locked because this workspace has active contacts/i)).toBeInTheDocument();
    });

    it('does not display lock indicator when scope is not locked', () => {
      render(<ScopeLabel scope="institution" locked={false} />);
      
      expect(screen.queryByText(/🔒 Locked/i)).not.toBeInTheDocument();
    });
  });

  describe('Scope label mapping', () => {
    it('maps institution to Schools', () => {
      render(<ScopeBadge scope="institution" />);
      expect(screen.getByText(/Schools/i)).toBeInTheDocument();
    });

    it('maps family to Families', () => {
      render(<ScopeBadge scope="family" />);
      expect(screen.getByText(/Families/i)).toBeInTheDocument();
    });

    it('maps person to People', () => {
      render(<ScopeBadge scope="person" />);
      expect(screen.getByText(/People/i)).toBeInTheDocument();
    });
  });
});
