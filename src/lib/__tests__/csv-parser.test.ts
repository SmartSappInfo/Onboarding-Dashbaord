/**
 * Unit tests for CSV parser and validator
 * 
 * Tests: 26.4, 26.5, 26.6
 */

import { describe, it, expect } from 'vitest';
import { parseCSV, inferEntityType, validateImport } from '../csv-parser';

describe('CSV Parser', () => {
  describe('parseCSV', () => {
    it('should parse simple CSV', () => {
      const csv = 'name,email\nJohn,john@example.com\nJane,jane@example.com';
      const rows = parseCSV(csv);
      
      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({ name: 'John', email: 'john@example.com' });
      expect(rows[1]).toEqual({ name: 'Jane', email: 'jane@example.com' });
    });

    it('should handle quoted values with commas', () => {
      const csv = 'name,address\nJohn,"123 Main St, City, Country"';
      const rows = parseCSV(csv);
      
      expect(rows).toHaveLength(1);
      expect(rows[0].address).toBe('123 Main St, City, Country');
    });

    it('should handle escaped quotes', () => {
      const csv = 'name,description\nJohn,"He said ""Hello"""';
      const rows = parseCSV(csv);
      
      expect(rows).toHaveLength(1);
      expect(rows[0].description).toBe('He said "Hello"');
    });

    it('should skip empty rows', () => {
      const csv = 'name,email\nJohn,john@example.com\n\n\nJane,jane@example.com';
      const rows = parseCSV(csv);
      
      expect(rows).toHaveLength(2);
    });

    it('should handle empty CSV', () => {
      const csv = '';
      const rows = parseCSV(csv);
      
      expect(rows).toHaveLength(0);
    });

    it('should trim whitespace from headers and values', () => {
      const csv = ' name , email \n John , john@example.com ';
      const rows = parseCSV(csv);
      
      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual({ name: 'John', email: 'john@example.com' });
    });
  });

  describe('inferEntityType', () => {
    it('should infer institution from nominalRoll', () => {
      const headers = ['name', 'nominalRoll', 'billingAddress'];
      const type = inferEntityType(headers);
      
      expect(type).toBe('institution');
    });

    it('should infer institution from subscriptionPackageId', () => {
      const headers = ['name', 'subscriptionPackageId'];
      const type = inferEntityType(headers);
      
      expect(type).toBe('institution');
    });

    it('should infer family from familyName', () => {
      const headers = ['familyName', 'guardian1_name'];
      const type = inferEntityType(headers);
      
      expect(type).toBe('family');
    });

    it('should infer family from guardian fields', () => {
      const headers = ['name', 'guardian1_name', 'guardian1_email'];
      const type = inferEntityType(headers);
      
      expect(type).toBe('family');
    });

    it('should infer family from child fields', () => {
      const headers = ['name', 'child1_firstName', 'child1_lastName'];
      const type = inferEntityType(headers);
      
      expect(type).toBe('family');
    });

    it('should infer person from firstName and lastName', () => {
      const headers = ['firstName', 'lastName', 'company'];
      const type = inferEntityType(headers);
      
      expect(type).toBe('person');
    });

    it('should not infer person without lastName', () => {
      const headers = ['firstName', 'company'];
      const type = inferEntityType(headers);
      
      expect(type).toBeNull();
    });

    it('should be case-insensitive', () => {
      const headers = ['FIRSTNAME', 'LASTNAME'];
      const type = inferEntityType(headers);
      
      expect(type).toBe('person');
    });

    it('should return null for ambiguous headers', () => {
      const headers = ['name', 'email'];
      const type = inferEntityType(headers);
      
      expect(type).toBeNull();
    });
  });

  describe('validateImport', () => {
    it('should validate institution CSV against institution scope', () => {
      const csv = 'name,nominalRoll\nTest School,100';
      const result = validateImport(csv, 'institution');
      
      expect(result.detectedScope).toBe('institution');
      expect(result.totalRows).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject institution CSV against family scope (ScopeGuard)', () => {
      const csv = 'name,nominalRoll\nTest School,100';
      const result = validateImport(csv, 'family');
      
      expect(result.detectedScope).toBe('institution');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].reason).toContain('institution');
      expect(result.errors[0].reason).toContain('family');
    });

    it('should validate family CSV against family scope', () => {
      const csv = 'familyName,guardian1_name\nSmith,John Smith';
      const result = validateImport(csv, 'family');
      
      expect(result.detectedScope).toBe('family');
      expect(result.totalRows).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate person CSV against person scope', () => {
      const csv = 'firstName,lastName,company\nJohn,Doe,Acme Corp';
      const result = validateImport(csv, 'person');
      
      expect(result.detectedScope).toBe('person');
      expect(result.totalRows).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should report missing required fields', () => {
      const csv = 'name,nominalRoll\n,100\nTest School,200';
      const result = validateImport(csv, 'institution');
      
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].row).toBe(2); // First data row
      expect(result.errors[0].reason).toContain('name');
    });

    it('should validate nominalRoll is a positive integer', () => {
      const csv = 'name,nominalRoll\nSchool A,-50\nSchool B,abc';
      const result = validateImport(csv, 'institution');
      
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.field === 'nominalRoll')).toBe(true);
    });

    it('should validate email format', () => {
      const csv = 'firstName,lastName,email\nJohn,Doe,invalid-email';
      const result = validateImport(csv, 'person');
      
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].field).toBe('email');
      expect(result.errors[0].reason).toContain('email');
    });

    it('should validate family has at least one guardian or child', () => {
      const csv = 'familyName\nSmith';
      const result = validateImport(csv, 'family');
      
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].reason).toContain('guardian or child');
    });

    it('should return preview of first 10 rows', () => {
      const rows = Array.from({ length: 20 }, (_, i) => `School ${i},100`).join('\n');
      const csv = `name,nominalRoll\n${rows}`;
      const result = validateImport(csv, 'institution');
      
      expect(result.totalRows).toBe(20);
      expect(result.previewRows).toHaveLength(10);
    });

    it('should handle empty CSV', () => {
      const csv = '';
      const result = validateImport(csv, 'institution');
      
      expect(result.totalRows).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].reason).toContain('empty');
    });

    it('should handle CSV with only headers', () => {
      const csv = 'name,nominalRoll';
      const result = validateImport(csv, 'institution');
      
      expect(result.totalRows).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should report errors without aborting (continue processing all rows)', () => {
      const csv = 'name,nominalRoll\n,100\nValid School,200\n,300';
      const result = validateImport(csv, 'institution');
      
      expect(result.totalRows).toBe(3);
      expect(result.errors).toHaveLength(2); // Two rows with missing name
      expect(result.errors[0].row).toBe(2);
      expect(result.errors[1].row).toBe(4);
    });
  });
});
