import { describe, it, expect } from 'vitest';
import { tokenizeDelimitedContacts } from '../contact-tokenizer';

/**
 * Unit test suite for the Dual-Mode Contact Tokenizer utility.
 *
 * Covers:
 * 1. Standard delimiters (comma, semicolon, newline, carriage return, tab).
 * 2. Dual-mode colon disambiguation:
 *    - Both sides are contacts -> split into individual items.
 *    - One side is name/label and the other is contact -> paired into 1 item with displayName and target.
 *    - Inverted label:contact vs contact:label ordering.
 * 3. Angle bracket formatting (e.g. "Name <email>" and "Name <phone>").
 * 4. Deduplication logic (canonical E.164 and lowercase email deduplication).
 * 5. Channel-specific validation and invalid target classification.
 * 6. Empty or blank input edge cases.
 */
describe('tokenizeDelimitedContacts', () => {
  describe('Standard Delimiters', () => {
    it('tokenizes comma, semicolon, newline, and tab separated phone numbers', () => {
      const input = '0244123456, 0201112222;\n0273334444\t+233242737120';
      const result = tokenizeDelimitedContacts(input, 'sms', 'GH');

      expect(result.items.length).toBe(4);
      expect(result.items[0].target).toBe('+233244123456');
      expect(result.items[0].isValid).toBe(true);
      expect(result.items[1].target).toBe('+233201112222');
      expect(result.items[1].isValid).toBe(true);
      expect(result.items[2].target).toBe('+233273334444');
      expect(result.items[2].isValid).toBe(true);
      expect(result.items[3].target).toBe('+233242737120');
      expect(result.items[3].isValid).toBe(true);
      expect(result.duplicateCount).toBe(0);
      expect(result.validCount).toBe(4);
      expect(result.invalidCount).toBe(0);
    });

    it('tokenizes mixed delimiters for email addresses', () => {
      const input = 'alice@example.com, bob@example.com;\ncarol@example.com\tdan@example.com';
      const result = tokenizeDelimitedContacts(input, 'email', 'GH');

      expect(result.items.length).toBe(4);
      expect(result.items[0].target).toBe('alice@example.com');
      expect(result.items[1].target).toBe('bob@example.com');
      expect(result.items[2].target).toBe('carol@example.com');
      expect(result.items[3].target).toBe('dan@example.com');
      expect(result.validCount).toBe(4);
      expect(result.invalidCount).toBe(0);
    });
  });

  describe('Dual-Mode Colon Disambiguation', () => {
    it('splits phone numbers when both sides of colon are contacts', () => {
      const input = '0244123456:0201112222';
      const result = tokenizeDelimitedContacts(input, 'sms', 'GH');

      expect(result.items.length).toBe(2);
      expect(result.items[0].target).toBe('+233244123456');
      expect(result.items[0].displayName).toBeUndefined();
      expect(result.items[0].isValid).toBe(true);

      expect(result.items[1].target).toBe('+233201112222');
      expect(result.items[1].displayName).toBeUndefined();
      expect(result.items[1].isValid).toBe(true);
    });

    it('splits email addresses when both sides of colon are contacts', () => {
      const input = 'support@smartsapp.com:sales@smartsapp.com';
      const result = tokenizeDelimitedContacts(input, 'email', 'GH');

      expect(result.items.length).toBe(2);
      expect(result.items[0].target).toBe('support@smartsapp.com');
      expect(result.items[1].target).toBe('sales@smartsapp.com');
    });

    it('pairs contact label with target when one side is a name and the other is a contact (SMS/WhatsApp)', () => {
      const input = 'Kwame Mensah: 0244123456, Ama: 0201112222';
      const result = tokenizeDelimitedContacts(input, 'sms', 'GH');

      expect(result.items.length).toBe(2);
      expect(result.items[0].displayName).toBe('Kwame Mensah');
      expect(result.items[0].target).toBe('+233244123456');
      expect(result.items[0].isValid).toBe(true);

      expect(result.items[1].displayName).toBe('Ama');
      expect(result.items[1].target).toBe('+233201112222');
      expect(result.items[1].isValid).toBe(true);
    });

    it('pairs contact label with target when one side is a name and the other is an email', () => {
      const input = 'Sales: sales@smartsapp.com, Billing Support: billing@smartsapp.com';
      const result = tokenizeDelimitedContacts(input, 'email', 'GH');

      expect(result.items.length).toBe(2);
      expect(result.items[0].displayName).toBe('Sales');
      expect(result.items[0].target).toBe('sales@smartsapp.com');
      expect(result.items[0].isValid).toBe(true);

      expect(result.items[1].displayName).toBe('Billing Support');
      expect(result.items[1].target).toBe('billing@smartsapp.com');
      expect(result.items[1].isValid).toBe(true);
    });

    it('handles inverted colon pairing (contact: displayName)', () => {
      const smsResult = tokenizeDelimitedContacts('0244123456: Kwame Mensah', 'sms', 'GH');
      expect(smsResult.items.length).toBe(1);
      expect(smsResult.items[0].displayName).toBe('Kwame Mensah');
      expect(smsResult.items[0].target).toBe('+233244123456');

      const emailResult = tokenizeDelimitedContacts('sales@smartsapp.com: Sales Desk', 'email', 'GH');
      expect(emailResult.items.length).toBe(1);
      expect(emailResult.items[0].displayName).toBe('Sales Desk');
      expect(emailResult.items[0].target).toBe('sales@smartsapp.com');
    });
  });

  describe('Angle Bracket Formatting', () => {
    it('handles angle bracket formatting for emails', () => {
      const input = 'Kwame Mensah <kwame@smartsapp.com>, info@school.edu.gh';
      const result = tokenizeDelimitedContacts(input, 'email', 'GH');

      expect(result.items.length).toBe(2);
      expect(result.items[0].displayName).toBe('Kwame Mensah');
      expect(result.items[0].target).toBe('kwame@smartsapp.com');
      expect(result.items[0].isValid).toBe(true);

      expect(result.items[1].displayName).toBeUndefined();
      expect(result.items[1].target).toBe('info@school.edu.gh');
      expect(result.items[1].isValid).toBe(true);
    });

    it('handles quoted names in angle bracket formatting', () => {
      const input = '"Mensah, Kwame" <kwame@smartsapp.com>';
      const result = tokenizeDelimitedContacts(input, 'email', 'GH');

      expect(result.items.length).toBe(1);
      expect(result.items[0].displayName).toBe('Mensah, Kwame');
      expect(result.items[0].target).toBe('kwame@smartsapp.com');
      expect(result.items[0].isValid).toBe(true);
    });

    it('handles angle bracket formatting for phone numbers', () => {
      const input = 'Kwame Mensah <0244123456>';
      const result = tokenizeDelimitedContacts(input, 'sms', 'GH');

      expect(result.items.length).toBe(1);
      expect(result.items[0].displayName).toBe('Kwame Mensah');
      expect(result.items[0].target).toBe('+233244123456');
      expect(result.items[0].isValid).toBe(true);
    });
  });

  describe('Deduplication and Validation', () => {
    it('deduplicates contacts and flags invalid items', () => {
      const input = '0244123456, 0244123456, 12345';
      const result = tokenizeDelimitedContacts(input, 'sms', 'GH');

      expect(result.items.length).toBe(2);
      expect(result.duplicateCount).toBe(1);
      expect(result.validCount).toBe(1);
      expect(result.invalidCount).toBe(1);

      expect(result.items[0].target).toBe('+233244123456');
      expect(result.items[0].isValid).toBe(true);

      expect(result.items[1].target).toBe('12345');
      expect(result.items[1].isValid).toBe(false);
      expect(result.items[1].validationError).toBeDefined();
    });

    it('deduplicates phone numbers across local and international formatting', () => {
      const input = '0244123456, +233244123456, 233244123456';
      const result = tokenizeDelimitedContacts(input, 'sms', 'GH');

      expect(result.items.length).toBe(1);
      expect(result.duplicateCount).toBe(2);
      expect(result.items[0].target).toBe('+233244123456');
    });

    it('normalizes email addresses to lowercase and deduplicates case-insensitively', () => {
      const input = 'Sales@SmartSapp.com, SALES@smartsapp.com, info@SmartSapp.com';
      const result = tokenizeDelimitedContacts(input, 'email', 'GH');

      expect(result.items.length).toBe(2);
      expect(result.duplicateCount).toBe(1);
      expect(result.items[0].target).toBe('sales@smartsapp.com');
      expect(result.items[1].target).toBe('info@smartsapp.com');
    });

    it('flags invalid email addresses with an error message', () => {
      const input = 'not-an-email, valid@example.com, invalid@domain';
      const result = tokenizeDelimitedContacts(input, 'email', 'GH');

      expect(result.items.length).toBe(3);
      expect(result.validCount).toBe(1);
      expect(result.invalidCount).toBe(2);
      expect(result.items[0].isValid).toBe(false);
      expect(result.items[0].validationError).toBeDefined();
      expect(result.items[1].isValid).toBe(true);
      expect(result.items[2].isValid).toBe(false);
    });

    it('correctly handles WhatsApp channel as phone normalization', () => {
      const input = '0559998888, invalid-number';
      const result = tokenizeDelimitedContacts(input, 'whatsapp', 'GH');

      expect(result.items.length).toBe(2);
      expect(result.items[0].target).toBe('+233559998888');
      expect(result.items[0].isValid).toBe(true);
      expect(result.items[1].isValid).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('returns empty result for empty, whitespace, or null string', () => {
      expect(tokenizeDelimitedContacts('', 'sms')).toEqual({
        items: [],
        duplicateCount: 0,
        validCount: 0,
        invalidCount: 0,
      });

      expect(tokenizeDelimitedContacts('   \n  \t  ', 'email')).toEqual({
        items: [],
        duplicateCount: 0,
        validCount: 0,
        invalidCount: 0,
      });
    });

    it('generates unique ids for each token item', () => {
      const input = '0244123456, 0201112222';
      const result = tokenizeDelimitedContacts(input, 'sms', 'GH');

      expect(result.items.length).toBe(2);
      expect(result.items[0].id).toBeTruthy();
      expect(result.items[1].id).toBeTruthy();
      expect(result.items[0].id).not.toBe(result.items[1].id);
    });
  });
});
