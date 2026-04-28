// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { resolveTerminologyFromWorkspace } from '../terminology';
import type { IndustryVertical } from '../types';

/**
 * @fileOverview Tests for Industry-Specific Terminology Integration
 * 
 * Requirements:
 * - 13.1–13.12: Apply industry-specific terminology to UI
 * - Backward compatibility: Support legacy contactScope terminology
 */

describe('Terminology Industry Integration', () => {
  describe('Industry-based terminology (Priority 1)', () => {
    it('should use SaaS terminology when workspace has industry: SaaS', () => {
      const workspace = { industry: 'SaaS' as IndustryVertical };
      const terminology = resolveTerminologyFromWorkspace(workspace);

      expect(terminology.singular).toBe('Account');
      expect(terminology.plural).toBe('Accounts');
      expect(terminology.addNew).toBe('Add New Account');
      expect(terminology.importBulk).toBe('Bulk Import Accounts');
      expect(terminology.noFound).toContain('accounts');
      expect(terminology.deleteConfirm).toBe('Delete Account?');
      expect(terminology.updateStatus).toBe('Update Account Status');
      expect(terminology.termName).toBe('Account Name');
      expect(terminology.viewConsole).toBe('View Account Console');
      expect(terminology.editProfile).toBe('Edit Account Profile');
    });

    it('should use SchoolEnrollment terminology when workspace has industry: SchoolEnrollment', () => {
      const workspace = { industry: 'SchoolEnrollment' as IndustryVertical };
      const terminology = resolveTerminologyFromWorkspace(workspace);

      expect(terminology.singular).toBe('School');
      expect(terminology.plural).toBe('Schools');
      expect(terminology.addNew).toBe('Add New School');
      expect(terminology.importBulk).toBe('Bulk Import Schools');
      expect(terminology.noFound).toContain('schools');
      expect(terminology.deleteConfirm).toBe('Delete School?');
      expect(terminology.updateStatus).toBe('Update School Status');
    });

    it('should use Law terminology when workspace has industry: Law', () => {
      const workspace = { industry: 'Law' as IndustryVertical };
      const terminology = resolveTerminologyFromWorkspace(workspace);

      expect(terminology.singular).toBe('Client');
      expect(terminology.plural).toBe('Clients');
      expect(terminology.addNew).toBe('Add New Client');
      expect(terminology.importBulk).toBe('Bulk Import Clients');
      expect(terminology.noFound).toContain('clients');
      expect(terminology.deleteConfirm).toBe('Delete Client?');
    });

    it('should use Marketing terminology when workspace has industry: Marketing', () => {
      const workspace = { industry: 'Marketing' as IndustryVertical };
      const terminology = resolveTerminologyFromWorkspace(workspace);

      expect(terminology.singular).toBe('Client');
      expect(terminology.plural).toBe('Clients');
    });

    it('should use RealEstate terminology when workspace has industry: RealEstate', () => {
      const workspace = { industry: 'RealEstate' as IndustryVertical };
      const terminology = resolveTerminologyFromWorkspace(workspace);

      expect(terminology.singular).toBe('Client');
      expect(terminology.plural).toBe('Clients');
    });

    it('should use Consultancy terminology when workspace has industry: Consultancy', () => {
      const workspace = { industry: 'Consultancy' as IndustryVertical };
      const terminology = resolveTerminologyFromWorkspace(workspace);

      expect(terminology.singular).toBe('Client');
      expect(terminology.plural).toBe('Clients');
    });
  });

  describe('Custom workspace terminology (Priority 2)', () => {
    it('should use custom workspace terminology when provided', () => {
      const workspace = {
        contactScope: 'institution',
        terminology: { singular: 'Organization', plural: 'Organizations' }
      };
      const terminology = resolveTerminologyFromWorkspace(workspace);

      expect(terminology.singular).toBe('Organization');
      expect(terminology.plural).toBe('Organizations');
      expect(terminology.addNew).toBe('Add New Organization');
      expect(terminology.importBulk).toBe('Bulk Import Organizations');
    });

    it('should prefer industry terminology over custom workspace terminology', () => {
      const workspace = {
        industry: 'SaaS' as IndustryVertical,
        contactScope: 'institution',
        terminology: { singular: 'Organization', plural: 'Organizations' }
      };
      const terminology = resolveTerminologyFromWorkspace(workspace);

      // Industry terminology takes priority
      expect(terminology.singular).toBe('Account');
      expect(terminology.plural).toBe('Accounts');
    });
  });

  describe('Legacy contactScope terminology (Priority 3 - Fallback)', () => {
    it('should use institution terminology when contactScope is institution', () => {
      const workspace = { contactScope: 'institution' };
      const terminology = resolveTerminologyFromWorkspace(workspace);

      expect(terminology.singular).toBe('Campus');
      expect(terminology.plural).toBe('Campuses');
      expect(terminology.addNew).toBe('Add New Campus');
    });

    it('should use family terminology when contactScope is family', () => {
      const workspace = { contactScope: 'family' };
      const terminology = resolveTerminologyFromWorkspace(workspace);

      expect(terminology.singular).toBe('Family');
      expect(terminology.plural).toBe('Families');
      expect(terminology.addNew).toBe('Add New Family');
    });

    it('should use person terminology when contactScope is person', () => {
      const workspace = { contactScope: 'person' };
      const terminology = resolveTerminologyFromWorkspace(workspace);

      expect(terminology.singular).toBe('Person');
      expect(terminology.plural).toBe('People');
      expect(terminology.addNew).toBe('Add New Person');
    });

    it('should default to institution terminology when no workspace data provided', () => {
      const terminology = resolveTerminologyFromWorkspace(null);

      expect(terminology.singular).toBe('Campus');
      expect(terminology.plural).toBe('Campuses');
    });

    it('should default to institution terminology when workspace is empty object', () => {
      const terminology = resolveTerminologyFromWorkspace({});

      expect(terminology.singular).toBe('Campus');
      expect(terminology.plural).toBe('Campuses');
    });
  });

  describe('All terminology fields are populated', () => {
    it('should populate all required terminology fields for SaaS', () => {
      const workspace = { industry: 'SaaS' as IndustryVertical };
      const terminology = resolveTerminologyFromWorkspace(workspace);

      expect(terminology.singular).toBeTruthy();
      expect(terminology.plural).toBeTruthy();
      expect(terminology.focalPerson).toBeTruthy();
      expect(terminology.addNew).toBeTruthy();
      expect(terminology.importBulk).toBeTruthy();
      expect(terminology.noFound).toBeTruthy();
      expect(terminology.deleteConfirm).toBeTruthy();
      expect(terminology.deleteLabel).toBeTruthy();
      expect(terminology.updateStatus).toBeTruthy();
      expect(terminology.termName).toBeTruthy();
      expect(terminology.termStatus).toBeTruthy();
      expect(terminology.viewConsole).toBeTruthy();
      expect(terminology.editProfile).toBeTruthy();
    });

    it('should populate all required terminology fields for legacy contactScope', () => {
      const workspace = { contactScope: 'family' };
      const terminology = resolveTerminologyFromWorkspace(workspace);

      expect(terminology.singular).toBeTruthy();
      expect(terminology.plural).toBeTruthy();
      expect(terminology.focalPerson).toBeTruthy();
      expect(terminology.addNew).toBeTruthy();
      expect(terminology.importBulk).toBeTruthy();
      expect(terminology.noFound).toBeTruthy();
      expect(terminology.deleteConfirm).toBeTruthy();
      expect(terminology.deleteLabel).toBeTruthy();
      expect(terminology.updateStatus).toBeTruthy();
      expect(terminology.termName).toBeTruthy();
      expect(terminology.termStatus).toBeTruthy();
      expect(terminology.viewConsole).toBeTruthy();
      expect(terminology.editProfile).toBeTruthy();
    });
  });

  describe('Terminology consistency across all industries', () => {
    const industries: IndustryVertical[] = ['SaaS', 'SchoolEnrollment', 'Law', 'Marketing', 'RealEstate', 'Consultancy'];

    it('should provide consistent terminology structure for all industries', () => {
      industries.forEach(industry => {
        const workspace = { industry };
        const terminology = resolveTerminologyFromWorkspace(workspace);

        expect(terminology.singular).toBeTruthy();
        expect(terminology.plural).toBeTruthy();
        expect(terminology.addNew).toContain(terminology.singular);
        expect(terminology.importBulk).toContain(terminology.plural);
        expect(terminology.deleteConfirm).toContain(terminology.singular);
        expect(terminology.updateStatus).toContain(terminology.singular);
        expect(terminology.termName).toContain(terminology.singular);
        expect(terminology.viewConsole).toContain(terminology.singular);
        expect(terminology.editProfile).toContain(terminology.singular);
      });
    });

    it('should use lowercase in noFound message for all industries', () => {
      industries.forEach(industry => {
        const workspace = { industry };
        const terminology = resolveTerminologyFromWorkspace(workspace);

        expect(terminology.noFound).toMatch(/no .+ found/i);
        expect(terminology.noFound).not.toContain(terminology.plural); // Should be lowercase
      });
    });
  });

  describe('Backward compatibility', () => {
    it('should maintain backward compatibility with existing workspaces without industry field', () => {
      const legacyWorkspace = {
        contactScope: 'institution',
        // No industry field
      };
      const terminology = resolveTerminologyFromWorkspace(legacyWorkspace);

      expect(terminology.singular).toBe('Campus');
      expect(terminology.plural).toBe('Campuses');
    });

    it('should handle undefined workspace gracefully', () => {
      const terminology = resolveTerminologyFromWorkspace(undefined);

      expect(terminology.singular).toBe('Campus');
      expect(terminology.plural).toBe('Campuses');
    });

    it('should handle null workspace gracefully', () => {
      const terminology = resolveTerminologyFromWorkspace(null);

      expect(terminology.singular).toBe('Campus');
      expect(terminology.plural).toBe('Campuses');
    });
  });
});
