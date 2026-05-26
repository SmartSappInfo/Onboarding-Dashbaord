import { describe, it, expect } from 'vitest';
import { cleanRow, cleanBatch, toTitleCase, cleanValueByKey } from '../import-data-cleaner';

describe('Import Data Cleaner - Title Case Transformation', () => {
  describe('toTitleCase utility', () => {
    it('should convert ALL CAPS text to Title Case', () => {
      expect(toTitleCase('JOHN DOE')).toBe('John Doe');
      expect(toTitleCase('123 MAIN STREET, ACCRA')).toBe('123 Main Street, Accra');
    });

    it('should convert all lowercase text to Title Case', () => {
      expect(toTitleCase('jane doe')).toBe('Jane Doe');
      expect(toTitleCase('456 high street')).toBe('456 High Street');
    });

    it('should leave mixed-case or already Title Cased text untouched', () => {
      expect(toTitleCase('John Doe')).toBe('John Doe');
      expect(toTitleCase('123 Main Street')).toBe('123 Main Street');
      expect(toTitleCase('CEO of smartsapp')).toBe('CEO of smartsapp');
    });
  });

  describe('cleanRow with enableTitleCase options', () => {
    const mapping = {
      name: 'Entity Name',
      locationString: 'Address',
      contact_0_name: 'Primary Contact',
    };

    it('should always convert name fields to Title Case by default if ALL CAPS or lowercase', () => {
      const row = {
        'Entity Name': 'ACCRA GIRLS SHS',
        'Address': '123 DUSTY ROAD',
        'Primary Contact': 'focal person name',
      };

      const { row: cleaned } = cleanRow(row, mapping, 'GH', false);

      // Name fields always cleaned
      expect(cleaned['Entity Name']).toBe('Accra Girls SHS');
      expect(cleaned['Primary Contact']).toBe('Focal Person Name');
      
      // Address is category 'text' - stays untouched when enableTitleCase = false
      expect(cleaned['Address']).toBe('123 DUSTY ROAD');
    });

    it('should convert other text fields to Title Case when enableTitleCase is true', () => {
      const row = {
        'Entity Name': 'ACCRA GIRLS SHS',
        'Address': '123 DUSTY ROAD',
        'Primary Contact': 'focal person name',
      };

      const { row: cleaned } = cleanRow(row, mapping, 'GH', true);

      // All fields converted properly
      expect(cleaned['Entity Name']).toBe('Accra Girls SHS');
      expect(cleaned['Primary Contact']).toBe('Focal Person Name');
      expect(cleaned['Address']).toBe('123 Dusty Road');
    });
  });

  describe('cleanBatch', () => {
    it('should process a batch of rows and apply enableTitleCase flag appropriately', () => {
      const rows = [
        { 'Entity Name': 'SCHOOL A', 'Address': 'STREET ONE' },
        { 'Entity Name': 'school b', 'Address': 'street two' },
      ];
      const mapping = { name: 'Entity Name', locationString: 'Address' };

      const { rows: cleaned } = cleanBatch(rows, mapping, 'GH', true);

      expect(cleaned[0]['Entity Name']).toBe('School A');
      expect(cleaned[0]['Address']).toBe('Street One');
      expect(cleaned[1]['Entity Name']).toBe('School B');
      expect(cleaned[1]['Address']).toBe('Street Two');
    });
  });

  describe('cleanValueByKey', () => {
    it('should clean name fields with Title Case', () => {
      expect(cleanValueByKey('name', 'ACCRA GIRLS SHS')).toBe('Accra Girls SHS');
      expect(cleanValueByKey('contact_0_name', 'focal person')).toBe('Focal Person');
    });

    it('should clean phone fields with normalization', () => {
      // Strips spaces and dashes, normalizes to E.164 if valid GH number
      expect(cleanValueByKey('contact_0_phone', '024 123 4567')).toBe('+233241234567');
      expect(cleanValueByKey('primaryPhone', '  +233 24-123-4567 ')).toBe('+233241234567');
    });

    it('should clean email fields with lowercase and trim', () => {
      expect(cleanValueByKey('contact_0_email', ' <JOHN@example.com> ')).toBe('john@example.com');
    });

    it('should clean date fields to ISO format', () => {
      expect(cleanValueByKey('dateofbirth', '25/12/1990')).toBe('1990-12-25');
    });

    it('should clean numeric fields', () => {
      expect(cleanValueByKey('subscriptionRate', ' $1,250.50 ')).toBe('1250.50');
    });
  });
});
