/**
 * Unit tests for import templates
 * 
 * Tests: 26.1, 26.2, 26.3
 */

import { describe, it, expect } from 'vitest';
import {
  generateImportTemplate,
  getTemplateColumns,
  validateRequiredFields,
  INSTITUTION_TEMPLATE_COLUMNS,
  FAMILY_TEMPLATE_COLUMNS,
  PERSON_TEMPLATE_COLUMNS,
} from '../import-templates';

describe('Import Templates', () => {
  describe('generateImportTemplate', () => {
    it('should generate institution template with correct columns', () => {
      const template = generateImportTemplate('institution');
      const lines = template.split('\n');
      
      expect(lines).toHaveLength(2); // Headers + example row
      expect(lines[0]).toBe(INSTITUTION_TEMPLATE_COLUMNS.join(','));
      expect(lines[1]).toContain('Example School');
    });

    it('should generate family template with correct columns', () => {
      const template = generateImportTemplate('family');
      const lines = template.split('\n');
      
      expect(lines).toHaveLength(2);
      expect(lines[0]).toBe(FAMILY_TEMPLATE_COLUMNS.join(','));
      expect(lines[1]).toContain('Smith');
    });

    it('should generate person template with correct columns', () => {
      const template = generateImportTemplate('person');
      const lines = template.split('\n');
      
      expect(lines).toHaveLength(2);
      expect(lines[0]).toBe(PERSON_TEMPLATE_COLUMNS.join(','));
      expect(lines[1]).toContain('John');
    });

    it('should escape CSV values with commas', () => {
      const template = generateImportTemplate('institution');
      const lines = template.split('\n');
      
      // Example row should have quoted address with commas
      expect(lines[1]).toContain('"123 Main St, City, Country"');
    });
  });

  describe('getTemplateColumns', () => {
    it('should return institution columns', () => {
      const columns = getTemplateColumns('institution');
      expect(columns).toEqual(INSTITUTION_TEMPLATE_COLUMNS);
    });

    it('should return family columns', () => {
      const columns = getTemplateColumns('family');
      expect(columns).toEqual(FAMILY_TEMPLATE_COLUMNS);
    });

    it('should return person columns', () => {
      const columns = getTemplateColumns('person');
      expect(columns).toEqual(PERSON_TEMPLATE_COLUMNS);
    });
  });

  describe('validateRequiredFields', () => {
    it('should validate institution required fields', () => {
      const validRow = { name: 'Test School' };
      const result = validateRequiredFields(validRow, 'institution');
      
      expect(result.valid).toBe(true);
      expect(result.missingFields).toHaveLength(0);
    });

    it('should reject institution without name', () => {
      const invalidRow = { nominalRoll: '100' };
      const result = validateRequiredFields(invalidRow, 'institution');
      
      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain('name');
    });

    it('should validate family required fields', () => {
      const validRow = { familyName: 'Smith' };
      const result = validateRequiredFields(validRow, 'family');
      
      expect(result.valid).toBe(true);
      expect(result.missingFields).toHaveLength(0);
    });

    it('should reject family without familyName', () => {
      const invalidRow = { guardian1_name: 'John Smith' };
      const result = validateRequiredFields(invalidRow, 'family');
      
      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain('familyName');
    });

    it('should validate person required fields', () => {
      const validRow = { firstName: 'John', lastName: 'Doe' };
      const result = validateRequiredFields(validRow, 'person');
      
      expect(result.valid).toBe(true);
      expect(result.missingFields).toHaveLength(0);
    });

    it('should reject person without firstName', () => {
      const invalidRow = { lastName: 'Doe' };
      const result = validateRequiredFields(invalidRow, 'person');
      
      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain('firstName');
    });

    it('should reject person without lastName', () => {
      const invalidRow = { firstName: 'John' };
      const result = validateRequiredFields(invalidRow, 'person');
      
      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain('lastName');
    });

    it('should reject empty string values as missing', () => {
      const invalidRow = { name: '   ' }; // Whitespace only
      const result = validateRequiredFields(invalidRow, 'institution');
      
      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain('name');
    });
  });
});
