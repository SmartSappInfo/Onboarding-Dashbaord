import { describe, it, expect } from 'vitest';
import { getIndustryErrorMessage, getIndustrySuccessMessage, getIndustryConfirmMessage } from '../industry-monitoring';
import type { IndustryVertical } from '../types';

/**
 * @fileOverview Tests for Industry-Specific Error Messaging
 * 
 * Requirements:
 * - 13.1–13.12: Apply industry-specific terminology to error messages
 * - 44.1–44.10: Display industry-appropriate error messages
 */

describe('Industry-Specific Error Messaging', () => {
  describe('getIndustryErrorMessage', () => {
    it('should return SaaS-specific error message for entity_not_found', () => {
      const message = getIndustryErrorMessage('entity_not_found', 'SaaS');
      expect(message).toBe('Account not found');
    });

    it('should return SchoolEnrollment-specific error message for entity_not_found', () => {
      const message = getIndustryErrorMessage('entity_not_found', 'SchoolEnrollment');
      expect(message).toBe('School not found');
    });

    it('should return Law-specific error message for entity_not_found', () => {
      const message = getIndustryErrorMessage('entity_not_found', 'Law');
      expect(message).toBe('Client not found');
    });

    it('should return Marketing-specific error message for entity_not_found', () => {
      const message = getIndustryErrorMessage('entity_not_found', 'Marketing');
      expect(message).toBe('Client not found');
    });

    it('should return RealEstate-specific error message for entity_not_found', () => {
      const message = getIndustryErrorMessage('entity_not_found', 'RealEstate');
      expect(message).toBe('Client not found');
    });

    it('should return Consultancy-specific error message for entity_not_found', () => {
      const message = getIndustryErrorMessage('entity_not_found', 'Consultancy');
      expect(message).toBe('Client not found');
    });

    it('should include entity name when provided', () => {
      const message = getIndustryErrorMessage('entity_not_found', 'SaaS', { entityName: 'Acme Corp' });
      expect(message).toBe('Account not found: Acme Corp');
    });

    it('should return industry-specific create failed message', () => {
      const message = getIndustryErrorMessage('entity_create_failed', 'SaaS');
      expect(message).toBe('Failed to create account');
    });

    it('should return industry-specific update failed message with details', () => {
      const message = getIndustryErrorMessage('entity_update_failed', 'Law', { 
        entityName: 'Smith & Associates', 
        details: 'Network error' 
      });
      expect(message).toBe('Failed to update client "Smith & Associates": Network error');
    });

    it('should return industry-specific workspace scope locked message', () => {
      const saasMessage = getIndustryErrorMessage('workspace_scope_locked', 'SaaS');
      expect(saasMessage).toContain('Accounts');

      const lawMessage = getIndustryErrorMessage('workspace_scope_locked', 'Law');
      expect(lawMessage).toContain('Clients');
    });

    it('should return industry-specific permission denied message', () => {
      const message = getIndustryErrorMessage('permission_denied', 'SchoolEnrollment');
      expect(message).toContain('schools');
    });
  });

  describe('getIndustrySuccessMessage', () => {
    it('should return SaaS-specific success message for create', () => {
      const message = getIndustrySuccessMessage('create', 'SaaS', 'Acme Corp');
      expect(message).toBe('Account created successfully: Acme Corp');
    });

    it('should return SchoolEnrollment-specific success message for update', () => {
      const message = getIndustrySuccessMessage('update', 'SchoolEnrollment', 'Lincoln High');
      expect(message).toBe('School updated successfully: Lincoln High');
    });

    it('should return Law-specific success message for delete', () => {
      const message = getIndustrySuccessMessage('delete', 'Law', 'Smith & Associates');
      expect(message).toBe('Client deleted successfully: Smith & Associates');
    });

    it('should return Marketing-specific success message for archive', () => {
      const message = getIndustrySuccessMessage('archive', 'Marketing', 'Creative Agency');
      expect(message).toBe('Client archived successfully: Creative Agency');
    });

    it('should work without entity name', () => {
      const message = getIndustrySuccessMessage('create', 'RealEstate');
      expect(message).toBe('Client created successfully');
    });
  });

  describe('getIndustryConfirmMessage', () => {
    it('should return SaaS-specific confirmation message for delete', () => {
      const message = getIndustryConfirmMessage('delete', 'SaaS', 'Acme Corp');
      expect(message).toBe('Are you sure you want to delete this account? Acme Corp');
    });

    it('should return SchoolEnrollment-specific confirmation message for archive', () => {
      const message = getIndustryConfirmMessage('archive', 'SchoolEnrollment', 'Lincoln High');
      expect(message).toBe('Are you sure you want to archive this school? Lincoln High');
    });

    it('should return Law-specific confirmation message for transfer', () => {
      const message = getIndustryConfirmMessage('transfer', 'Law', 'Smith & Associates');
      expect(message).toBe('Are you sure you want to transfer this client? Smith & Associates');
    });

    it('should work without entity name', () => {
      const message = getIndustryConfirmMessage('delete', 'Consultancy');
      expect(message).toBe('Are you sure you want to delete this client?');
    });
  });

  describe('All Industries Coverage', () => {
    const industries: IndustryVertical[] = ['SaaS', 'SchoolEnrollment', 'Law', 'Marketing', 'RealEstate', 'Consultancy'];
    
    it('should provide error messages for all industries', () => {
      industries.forEach(industry => {
        const message = getIndustryErrorMessage('entity_not_found', industry);
        expect(message).toBeTruthy();
        expect(message.length).toBeGreaterThan(0);
      });
    });

    it('should provide success messages for all industries', () => {
      industries.forEach(industry => {
        const message = getIndustrySuccessMessage('create', industry);
        expect(message).toBeTruthy();
        expect(message.length).toBeGreaterThan(0);
      });
    });

    it('should provide confirmation messages for all industries', () => {
      industries.forEach(industry => {
        const message = getIndustryConfirmMessage('delete', industry);
        expect(message).toBeTruthy();
        expect(message.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Terminology Consistency', () => {
    it('should use "Account" for SaaS industry', () => {
      const errorMsg = getIndustryErrorMessage('entity_not_found', 'SaaS');
      const successMsg = getIndustrySuccessMessage('create', 'SaaS');
      const confirmMsg = getIndustryConfirmMessage('delete', 'SaaS');

      expect(errorMsg).toContain('Account');
      expect(successMsg).toContain('Account');
      expect(confirmMsg).toContain('account');
    });

    it('should use "School" for SchoolEnrollment industry', () => {
      const errorMsg = getIndustryErrorMessage('entity_not_found', 'SchoolEnrollment');
      const successMsg = getIndustrySuccessMessage('create', 'SchoolEnrollment');
      const confirmMsg = getIndustryConfirmMessage('delete', 'SchoolEnrollment');

      expect(errorMsg).toContain('School');
      expect(successMsg).toContain('School');
      expect(confirmMsg).toContain('school');
    });

    it('should use "Client" for Law, Marketing, RealEstate, and Consultancy industries', () => {
      const clientIndustries: IndustryVertical[] = ['Law', 'Marketing', 'RealEstate', 'Consultancy'];
      
      clientIndustries.forEach(industry => {
        const errorMsg = getIndustryErrorMessage('entity_not_found', industry);
        const successMsg = getIndustrySuccessMessage('create', industry);
        const confirmMsg = getIndustryConfirmMessage('delete', industry);

        expect(errorMsg).toContain('Client');
        expect(successMsg).toContain('Client');
        expect(confirmMsg).toContain('client');
      });
    });
  });
});
