import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { AdHocContactPillsInput } from '../AdHocContactPillsInput';
import type { AdHocContactItem } from '@/lib/types/composer-audience';

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe('AdHocContactPillsInput', () => {
  const mockValidEmail: AdHocContactItem = {
    id: 'c1',
    rawInput: 'kwame@domain.com',
    target: 'kwame@domain.com',
    displayName: 'Kwame Mensah',
    isValid: true,
  };

  const mockValidEmailNoName: AdHocContactItem = {
    id: 'c2',
    rawInput: 'ama@domain.com',
    target: 'ama@domain.com',
    isValid: true,
  };

  const mockInvalidEmail: AdHocContactItem = {
    id: 'c3',
    rawInput: 'invalid-email',
    target: 'invalid-email',
    isValid: false,
    validationError: 'Invalid email address format',
  };

  const mockValidPhone: AdHocContactItem = {
    id: 'p1',
    rawInput: '0244123456',
    target: '+233244123456',
    displayName: 'Kofi',
    isValid: true,
  };

  const mockInvalidPhone: AdHocContactItem = {
    id: 'p2',
    rawInput: 'abc1234',
    target: 'abc1234',
    isValid: false,
    validationError: 'Phone number cannot contain letters',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  describe('Placeholders & Channel Context', () => {
    it('renders email placeholder when channel is email', () => {
      render(
        <AdHocContactPillsInput
          channel="email"
          items={[]}
          onChange={vi.fn()}
        />
      );

      const textarea = screen.getByPlaceholderText(
        'Type or paste emails separated by commas, colons, or newlines (e.g. name@domain.com, Kwame <kwame@domain.com>)...'
      );
      expect(textarea).toBeInTheDocument();
    });

    it('renders phone placeholder when channel is sms', () => {
      render(
        <AdHocContactPillsInput
          channel="sms"
          items={[]}
          onChange={vi.fn()}
        />
      );

      const textarea = screen.getByPlaceholderText(
        'Type or paste phone numbers separated by commas, colons, or newlines (e.g. 0244123456, Kwame: 0201112222)...'
      );
      expect(textarea).toBeInTheDocument();
    });

    it('renders phone placeholder when channel is whatsapp', () => {
      render(
        <AdHocContactPillsInput
          channel="whatsapp"
          items={[]}
          onChange={vi.fn()}
        />
      );

      const textarea = screen.getByPlaceholderText(
        'Type or paste phone numbers separated by commas, colons, or newlines (e.g. 0244123456, Kwame: 0201112222)...'
      );
      expect(textarea).toBeInTheDocument();
    });

    it('renders empty state guidance when no items are present', () => {
      render(
        <AdHocContactPillsInput
          channel="email"
          items={[]}
          onChange={vi.fn()}
        />
      );

      expect(screen.getByText(/no contacts added yet/i)).toBeInTheDocument();
    });

    it('disables input when disabled prop is true', () => {
      render(
        <AdHocContactPillsInput
          channel="email"
          items={[mockValidEmail]}
          onChange={vi.fn()}
          disabled={true}
        />
      );

      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeDisabled();

      const removeBtn = screen.getByRole('button', { name: /remove kwame mensah/i });
      expect(removeBtn).toBeDisabled();
    });
  });

  describe('Auto-tokenization & Delimiters', () => {
    it('tokenizes on Enter key and appends parsed items', () => {
      const handleChange = vi.fn();
      render(
        <AdHocContactPillsInput
          channel="email"
          items={[mockValidEmail]}
          onChange={handleChange}
        />
      );

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'ama@domain.com' } });
      fireEvent.keyDown(textarea, { key: 'Enter' });

      expect(handleChange).toHaveBeenCalledTimes(1);
      const calledItems = handleChange.mock.calls[0][0] as AdHocContactItem[];
      expect(calledItems).toHaveLength(2);
      expect(calledItems[0]).toEqual(mockValidEmail);
      expect(calledItems[1].target).toBe('ama@domain.com');
      expect(calledItems[1].isValid).toBe(true);
      expect(textarea).toHaveValue('');
    });

    it('tokenizes on comma input and clears textarea', () => {
      const handleChange = vi.fn();
      render(
        <AdHocContactPillsInput
          channel="sms"
          defaultCountry="GH"
          items={[]}
          onChange={handleChange}
        />
      );

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: '0244123456,' } });

      expect(handleChange).toHaveBeenCalledTimes(1);
      const calledItems = handleChange.mock.calls[0][0] as AdHocContactItem[];
      expect(calledItems).toHaveLength(1);
      expect(calledItems[0].target).toBe('+233244123456');
      expect(calledItems[0].isValid).toBe(true);
      expect(textarea).toHaveValue('');
    });

    it('tokenizes on semicolon input', () => {
      const handleChange = vi.fn();
      render(
        <AdHocContactPillsInput
          channel="email"
          items={[]}
          onChange={handleChange}
        />
      );

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'test@example.com;' } });

      expect(handleChange).toHaveBeenCalledTimes(1);
      const calledItems = handleChange.mock.calls[0][0] as AdHocContactItem[];
      expect(calledItems).toHaveLength(1);
      expect(calledItems[0].target).toBe('test@example.com');
      expect(textarea).toHaveValue('');
    });

    it('tokenizes on onBlur event', () => {
      const handleChange = vi.fn();
      render(
        <AdHocContactPillsInput
          channel="email"
          items={[]}
          onChange={handleChange}
        />
      );

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'user@example.com' } });
      fireEvent.blur(textarea);

      expect(handleChange).toHaveBeenCalledTimes(1);
      const calledItems = handleChange.mock.calls[0][0] as AdHocContactItem[];
      expect(calledItems).toHaveLength(1);
      expect(calledItems[0].target).toBe('user@example.com');
      expect(textarea).toHaveValue('');
    });

    it('tokenizes colon-formatted contacts extracting displayName and target', () => {
      const handleChange = vi.fn();
      render(
        <AdHocContactPillsInput
          channel="sms"
          defaultCountry="GH"
          items={[]}
          onChange={handleChange}
        />
      );

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'Kwame: 0244123456' } });
      fireEvent.keyDown(textarea, { key: 'Enter' });

      expect(handleChange).toHaveBeenCalledTimes(1);
      const calledItems = handleChange.mock.calls[0][0] as AdHocContactItem[];
      expect(calledItems).toHaveLength(1);
      expect(calledItems[0].displayName).toBe('Kwame');
      expect(calledItems[0].target).toBe('+233244123456');
    });

    it('deduplicates items against already existing contacts and updates duplicate count', () => {
      const handleChange = vi.fn();
      render(
        <AdHocContactPillsInput
          channel="email"
          items={[mockValidEmail]} // target: kwame@domain.com
          onChange={handleChange}
        />
      );

      const textarea = screen.getByRole('textbox');
      // Enter the same email again
      fireEvent.change(textarea, { target: { value: 'kwame@domain.com' } });
      fireEvent.keyDown(textarea, { key: 'Enter' });

      // Should not call onChange with duplicates
      expect(handleChange).not.toHaveBeenCalled();
      // Should show duplicate badge
      expect(screen.getByText(/1 duplicate/i)).toBeInTheDocument();
    });
  });

  describe('Interactive Contact Pills & Mobile Ergonomics', () => {
    it('renders valid pill with emerald indicator, bold displayName, and target', () => {
      render(
        <AdHocContactPillsInput
          channel="email"
          items={[mockValidEmail, mockValidEmailNoName]}
          onChange={vi.fn()}
        />
      );

      // Kwame Mensah with display name
      const displayNameEl = screen.getByText('Kwame Mensah');
      expect(displayNameEl).toBeInTheDocument();
      expect(displayNameEl.tagName.toLowerCase()).toBe('span');
      expect(screen.getByText('kwame@domain.com')).toBeInTheDocument();

      // Pill without display name
      expect(screen.getByText('ama@domain.com')).toBeInTheDocument();

      // Check remove buttons have 44px touch zone and aria-label
      const removeBtns = screen.getAllByRole('button', { name: /remove/i });
      expect(removeBtns.length).toBeGreaterThanOrEqual(2);
      expect(removeBtns[0].className).toContain('min-h-[44px]');
    });

    it('renders invalid pill with warning icon, rose styling, and validation error', () => {
      render(
        <AdHocContactPillsInput
          channel="email"
          items={[mockInvalidEmail]}
          onChange={vi.fn()}
        />
      );

      expect(screen.getByText('invalid-email')).toBeInTheDocument();
      expect(screen.getByText(/invalid email address format/i)).toBeInTheDocument();

      const removeBtn = screen.getByRole('button', { name: /remove invalid-email/i });
      expect(removeBtn.className).toContain('min-h-[44px]');
    });

    it('calls onChange with item removed when delete button is clicked', () => {
      const handleChange = vi.fn();
      render(
        <AdHocContactPillsInput
          channel="email"
          items={[mockValidEmail, mockValidEmailNoName]}
          onChange={handleChange}
        />
      );

      const removeBtn = screen.getByRole('button', { name: /remove kwame mensah/i });
      fireEvent.click(removeBtn);

      expect(handleChange).toHaveBeenCalledTimes(1);
      expect(handleChange).toHaveBeenCalledWith([mockValidEmailNoName]);
    });

    it('implements performance guard when items exceed 100', () => {
      // Create 105 mock contacts
      const manyItems: AdHocContactItem[] = Array.from({ length: 105 }, (_, i) => ({
        id: `item-${i}`,
        rawInput: `user${i}@example.com`,
        target: `user${i}@example.com`,
        isValid: true,
      }));

      render(
        <AdHocContactPillsInput
          channel="email"
          items={manyItems}
          onChange={vi.fn()}
        />
      );

      // Should show toggle notice
      expect(screen.getByText(/showing first 100 of 105 contacts/i)).toBeInTheDocument();
      const toggleBtn = screen.getByRole('button', { name: /show all/i });
      expect(toggleBtn).toBeInTheDocument();

      // Initial render: user0 should be present, user104 should NOT be in the DOM
      expect(screen.getByText('user0@example.com')).toBeInTheDocument();
      expect(screen.queryByText('user104@example.com')).not.toBeInTheDocument();

      // Click "Show All"
      fireEvent.click(toggleBtn);
      expect(screen.getByText('user104@example.com')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /show less/i })).toBeInTheDocument();

      // Click "Show Less"
      fireEvent.click(screen.getByRole('button', { name: /show less/i }));
      expect(screen.queryByText('user104@example.com')).not.toBeInTheDocument();
    });
  });

  describe('Batch Actions Toolbar', () => {
    it('displays valid count badge with emerald styling', () => {
      render(
        <AdHocContactPillsInput
          channel="email"
          items={[mockValidEmail, mockValidEmailNoName]}
          onChange={vi.fn()}
        />
      );

      const validBadge = screen.getByText('2 Valid');
      expect(validBadge).toBeInTheDocument();
      expect(validBadge.className).toContain('emerald');
    });

    it('displays invalid count badge when invalid contacts exist', () => {
      render(
        <AdHocContactPillsInput
          channel="email"
          items={[mockValidEmail, mockInvalidEmail]}
          onChange={vi.fn()}
        />
      );

      const invalidBadge = screen.getByText('1 Invalid');
      expect(invalidBadge).toBeInTheDocument();
      expect(invalidBadge.className).toContain('rose');
    });

    it('displays duplicate count badge when duplicateCount > 0 prop is passed', () => {
      render(
        <AdHocContactPillsInput
          channel="email"
          items={[mockValidEmail]}
          duplicateCount={4}
          onChange={vi.fn()}
        />
      );

      expect(screen.getByText('4 Duplicates')).toBeInTheDocument();
    });

    it('renders "Remove Invalid" button only when invalid items exist and removes them on click', () => {
      const handleChange = vi.fn();
      const { rerender } = render(
        <AdHocContactPillsInput
          channel="email"
          items={[mockValidEmail, mockInvalidEmail]}
          onChange={handleChange}
        />
      );

      const removeInvalidBtn = screen.getByRole('button', { name: /remove invalid contacts/i });
      expect(removeInvalidBtn).toBeInTheDocument();
      expect(removeInvalidBtn.className).toContain('min-h-[44px]');

      fireEvent.click(removeInvalidBtn);
      expect(handleChange).toHaveBeenCalledTimes(1);
      expect(handleChange).toHaveBeenCalledWith([mockValidEmail]);

      // Rerender with only valid items -> "Remove Invalid" should disappear
      rerender(
        <AdHocContactPillsInput
          channel="email"
          items={[mockValidEmail]}
          onChange={handleChange}
        />
      );
      expect(screen.queryByRole('button', { name: /remove invalid contacts/i })).not.toBeInTheDocument();
    });

    it('clears all items when "Clear All" is clicked', () => {
      const handleChange = vi.fn();
      render(
        <AdHocContactPillsInput
          channel="email"
          items={[mockValidEmail, mockValidEmailNoName]}
          onChange={handleChange}
        />
      );

      const clearAllBtn = screen.getByRole('button', { name: /clear all/i });
      expect(clearAllBtn.className).toContain('min-h-[44px]');

      fireEvent.click(clearAllBtn);
      expect(handleChange).toHaveBeenCalledTimes(1);
      expect(handleChange).toHaveBeenCalledWith([]);
    });

    it('copies valid targets to clipboard on "Copy Valid" click', async () => {
      render(
        <AdHocContactPillsInput
          channel="email"
          items={[mockValidEmail, mockValidEmailNoName, mockInvalidEmail]}
          onChange={vi.fn()}
        />
      );

      const copyBtn = screen.getByRole('button', { name: /copy valid/i });
      expect(copyBtn.className).toContain('min-h-[44px]');

      fireEvent.click(copyBtn);

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'kwame@domain.com, ama@domain.com'
      );
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: expect.stringMatching(/copied/i),
          })
        );
      });
    });
  });
});
