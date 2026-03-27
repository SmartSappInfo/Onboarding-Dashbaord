/**
 * Task 39 Checkpoint Test: UI Language is Explicit and Clear
 * 
 * This checkpoint verifies that all UI language implementations from task 38
 * are working correctly in the actual application.
 * 
 * Validates: Requirement 25 (Explicit UI Language for Scope Rules)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ScopeLabel, ScopeSelector, ScopeMismatchError, ScopeBadge } from '@/app/admin/contacts/components/ScopeBadge';
import type { ContactScope, EntityType } from '@/lib/types';

describe('Task 39 Checkpoint: UI Language is Explicit and Clear', () => {
  describe('Workspace Settings - Scope Rules Display', () => {
    it('displays scope rules clearly for institution workspace', () => {
      render(<ScopeLabel scope="institution" />);
      
      // Verify the main message is clear
      expect(screen.getByText(/This workspace manages/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Schools/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Only.*records can exist here/i)).toBeInTheDocument();
    });

    it('displays scope rules clearly for family workspace', () => {
      render(<ScopeLabel scope="family" />);
      
      expect(screen.getByText(/This workspace manages/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Families/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Only.*records can exist here/i)).toBeInTheDocument();
    });

    it('displays scope rules clearly for person workspace', () => {
      render(<ScopeLabel scope="person" />);
      
      expect(screen.getByText(/This workspace manages/i)).toBeInTheDocument();
      expect(screen.getAllByText(/People/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Only.*records can exist here/i)).toBeInTheDocument();
    });

    it('displays lock indicator when workspace has active contacts', () => {
      render(<ScopeLabel scope="institution" locked={true} />);
      
      // Verify lock icon is displayed
      expect(screen.getByText(/🔒 Locked/i)).toBeInTheDocument();
      
      // Verify explanatory text is present
      expect(screen.getByText(/Scope is locked because this workspace has active contacts/i)).toBeInTheDocument();
    });

    it('does not display lock indicator when workspace has no contacts', () => {
      render(<ScopeLabel scope="institution" locked={false} />);
      
      expect(screen.queryByText(/🔒 Locked/i)).not.toBeInTheDocument();
    });
  });

  describe('Error Messages - Human Readable', () => {
    it('displays clear error for family entity in institution workspace', () => {
      render(<ScopeMismatchError entityType="family" workspaceScope="institution" />);
      
      // Verify error heading
      expect(screen.getByText(/Scope Mismatch Error/i)).toBeInTheDocument();
      
      // Verify human-readable explanation
      expect(screen.getByText(/Families records cannot be added to a workspace that manages Schools/i)).toBeInTheDocument();
      
      // Verify actionable guidance
      expect(screen.getByText(/Please select a workspace with the correct contact scope or create a new workspace/i)).toBeInTheDocument();
    });

    it('displays clear error for person entity in family workspace', () => {
      render(<ScopeMismatchError entityType="person" workspaceScope="family" />);
      
      expect(screen.getByText(/People records cannot be added to a workspace that manages Families/i)).toBeInTheDocument();
    });

    it('displays clear error for institution entity in person workspace', () => {
      render(<ScopeMismatchError entityType="institution" workspaceScope="person" />);
      
      expect(screen.getByText(/Schools records cannot be added to a workspace that manages People/i)).toBeInTheDocument();
    });

    it('error messages provide actionable guidance', () => {
      render(<ScopeMismatchError entityType="family" workspaceScope="institution" />);
      
      const guidanceText = screen.getByText(/Please select a workspace with the correct contact scope or create a new workspace/i);
      expect(guidanceText).toBeInTheDocument();
    });
  });

  describe('Scope Badges - All Relevant Locations', () => {
    describe('Workspace Switcher Badges', () => {
      it('displays Schools badge for institution workspace', () => {
        render(<ScopeBadge scope="institution" />);
        
        expect(screen.getByText(/Schools/i)).toBeInTheDocument();
      });

      it('displays Families badge for family workspace', () => {
        render(<ScopeBadge scope="family" />);
        
        expect(screen.getByText(/Families/i)).toBeInTheDocument();
      });

      it('displays People badge for person workspace', () => {
        render(<ScopeBadge scope="person" />);
        
        expect(screen.getByText(/People/i)).toBeInTheDocument();
      });

      it('displays badge with icon when requested', () => {
        const { container } = render(<ScopeBadge scope="institution" showIcon={true} />);
        
        // Verify icon is rendered
        const icon = container.querySelector('svg');
        expect(icon).toBeInTheDocument();
      });
    });

    describe('Contact Detail Page Badges', () => {
      it('displays entity type badge for institution', () => {
        render(<ScopeBadge scope="institution" variant="secondary" />);
        
        expect(screen.getByText(/Schools/i)).toBeInTheDocument();
      });

      it('displays entity type badge for family', () => {
        render(<ScopeBadge scope="family" variant="secondary" />);
        
        expect(screen.getByText(/Families/i)).toBeInTheDocument();
      });

      it('displays entity type badge for person', () => {
        render(<ScopeBadge scope="person" variant="secondary" />);
        
        expect(screen.getByText(/People/i)).toBeInTheDocument();
      });
    });

    describe('Workspace Settings Badges', () => {
      it('displays scope badge in settings with lock indicator', () => {
        render(<ScopeLabel scope="institution" locked={true} />);
        
        // Verify scope label
        expect(screen.getAllByText(/Schools/i).length).toBeGreaterThan(0);
        
        // Verify lock badge
        expect(screen.getByText(/🔒 Locked/i)).toBeInTheDocument();
      });
    });
  });

  describe('Workspace Creation Wizard - Immutability Warning', () => {
    it('displays clear warning about scope immutability', () => {
      const mockOnChange = vi.fn();
      render(<ScopeSelector value="institution" onChange={mockOnChange} />);
      
      // Verify warning message is present
      expect(screen.getByText(/Scope cannot be changed after the first contact is added/i)).toBeInTheDocument();
    });

    it('displays warning with visual indicator', () => {
      const mockOnChange = vi.fn();
      render(<ScopeSelector value="institution" onChange={mockOnChange} />);
      
      // Verify warning icon is present
      expect(screen.getByText(/⚠️/)).toBeInTheDocument();
    });

    it('displays scope descriptions for all three types', () => {
      const mockOnChange = vi.fn();
      render(<ScopeSelector value="institution" onChange={mockOnChange} />);
      
      // Verify all three scope options are displayed
      expect(screen.getAllByText(/Schools/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Families/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/People/i).length).toBeGreaterThan(0);
      
      // Verify descriptions are present
      expect(screen.getByText(/Manage schools and educational institutions/i)).toBeInTheDocument();
      expect(screen.getByText(/Manage families with guardians/i)).toBeInTheDocument();
      expect(screen.getByText(/Manage individual contacts/i)).toBeInTheDocument();
    });
  });

  describe('Scope Label Mapping Consistency', () => {
    it('consistently maps institution to Schools', () => {
      const { unmount: unmount1 } = render(<ScopeBadge scope="institution" />);
      expect(screen.getByText(/Schools/i)).toBeInTheDocument();
      unmount1();
      
      const { unmount: unmount2 } = render(<ScopeLabel scope="institution" />);
      expect(screen.getAllByText(/Schools/i).length).toBeGreaterThan(0);
      unmount2();
    });

    it('consistently maps family to Families', () => {
      const { unmount: unmount1 } = render(<ScopeBadge scope="family" />);
      expect(screen.getByText(/Families/i)).toBeInTheDocument();
      unmount1();
      
      const { unmount: unmount2 } = render(<ScopeLabel scope="family" />);
      expect(screen.getAllByText(/Families/i).length).toBeGreaterThan(0);
      unmount2();
    });

    it('consistently maps person to People', () => {
      const { unmount: unmount1 } = render(<ScopeBadge scope="person" />);
      expect(screen.getByText(/People/i)).toBeInTheDocument();
      unmount1();
      
      const { unmount: unmount2 } = render(<ScopeLabel scope="person" />);
      expect(screen.getAllByText(/People/i).length).toBeGreaterThan(0);
      unmount2();
    });
  });

  describe('UI Language Clarity - Comprehensive Check', () => {
    it('uses consistent terminology across all components', () => {
      const scopes: ContactScope[] = ['institution', 'family', 'person'];
      const expectedLabels = {
        institution: 'Schools',
        family: 'Families',
        person: 'People'
      };
      
      scopes.forEach(scope => {
        const { unmount } = render(<ScopeBadge scope={scope} />);
        expect(screen.getByText(new RegExp(expectedLabels[scope], 'i'))).toBeInTheDocument();
        unmount();
      });
    });

    it('provides context-appropriate messaging for each component type', () => {
      // Settings page provides full explanation
      const { unmount: unmount1 } = render(<ScopeLabel scope="institution" />);
      expect(screen.getByText(/This workspace manages/i)).toBeInTheDocument();
      expect(screen.getByText(/Only.*records can exist here/i)).toBeInTheDocument();
      unmount1();
      
      // Error messages provide actionable guidance
      const { unmount: unmount2 } = render(<ScopeMismatchError entityType="family" workspaceScope="institution" />);
      expect(screen.getByText(/Please select a workspace with the correct contact scope/i)).toBeInTheDocument();
      unmount2();
      
      // Creation wizard provides warning
      const mockOnChange = vi.fn();
      const { unmount: unmount3 } = render(<ScopeSelector value="institution" onChange={mockOnChange} />);
      expect(screen.getByText(/Scope cannot be changed after the first contact is added/i)).toBeInTheDocument();
      unmount3();
    });
  });

  describe('Accessibility and Visual Clarity', () => {
    it('uses icons to enhance visual clarity', () => {
      const { container } = render(<ScopeBadge scope="institution" showIcon={true} />);
      
      // Verify icon is present
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('uses color coding for different message types', () => {
      // Error messages should use destructive styling
      const { container: errorContainer } = render(
        <ScopeMismatchError entityType="family" workspaceScope="institution" />
      );
      
      // Verify error styling is applied (destructive colors)
      const errorElement = errorContainer.querySelector('.text-destructive');
      expect(errorElement).toBeInTheDocument();
    });

    it('uses appropriate badge variants for different contexts', () => {
      // Secondary variant for subtle display
      const { container: secondaryContainer } = render(
        <ScopeBadge scope="institution" variant="secondary" />
      );
      expect(secondaryContainer.textContent).toContain('Schools');
      
      // Outline variant for emphasis
      const { container: outlineContainer } = render(
        <ScopeBadge scope="family" variant="outline" />
      );
      expect(outlineContainer.textContent).toContain('Families');
    });
  });

  describe('Integration Verification', () => {
    it('all components render without errors', () => {
      // Verify all components can be rendered successfully
      const mockOnChange = vi.fn();
      
      expect(() => render(<ScopeBadge scope="institution" />)).not.toThrow();
      expect(() => render(<ScopeLabel scope="family" />)).not.toThrow();
      expect(() => render(<ScopeSelector value="person" onChange={mockOnChange} />)).not.toThrow();
      expect(() => render(<ScopeMismatchError entityType="family" workspaceScope="institution" />)).not.toThrow();
    });

    it('components accept all valid scope values', () => {
      const scopes: ContactScope[] = ['institution', 'family', 'person'];
      
      scopes.forEach(scope => {
        expect(() => render(<ScopeBadge scope={scope} />)).not.toThrow();
        expect(() => render(<ScopeLabel scope={scope} />)).not.toThrow();
      });
    });
  });
});
