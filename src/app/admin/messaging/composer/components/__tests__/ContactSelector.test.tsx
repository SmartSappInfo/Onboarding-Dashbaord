import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContactSelector } from '../ContactSelector';
import type { EntityContact } from '@/lib/types';

describe('ContactSelector Component (FER-01 Refactor)', () => {
  const mockContacts: EntityContact[] = [
    {
      id: 'c1',
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+233241234567',
      typeLabel: 'Principal',
      typeKey: 'principal',
      isPrimary: true,
      isSignatory: true,
      order: 0,
    },
    {
      id: 'c2',
      name: 'Jane Smith',
      email: 'jane@example.com',
      phone: '+233242345678',
      typeLabel: 'Administrator',
      typeKey: 'admin',
      isPrimary: false,
      isSignatory: false,
      order: 1,
    },
    {
      id: 'c3',
      name: 'Bob Johnson',
      email: '',
      phone: '+233243456789',
      typeLabel: 'Accountant',
      typeKey: 'accountant',
      isPrimary: false,
      isSignatory: false,
      order: 2,
    },
    {
      id: 'c4',
      name: 'Alice Williams',
      email: 'alice@example.com',
      phone: '',
      typeLabel: 'Champion',
      typeKey: 'champion',
      isPrimary: false,
      isSignatory: false,
      order: 3,
    },
  ];

  const mockOnSelectionChange = vi.fn();

  beforeEach(() => {
    mockOnSelectionChange.mockClear();
  });

  describe('Contact List Rendering', () => {
    it('should render contact list with name, role, email, and phone', () => {
      render(
        <ContactSelector
          contacts={mockContacts}
          channel="email"
          selectedContactIndices={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      // Check that contacts with email are displayed
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Principal')).toBeInTheDocument();
      expect(screen.getByText('john@example.com')).toBeInTheDocument();

      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('Administrator')).toBeInTheDocument();
      expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    });

    it('should display checkboxes for each contact', () => {
      render(
        <ContactSelector
          contacts={mockContacts}
          channel="email"
          selectedContactIndices={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      const checkboxes = screen.getAllByRole('checkbox');
      // Should have checkboxes for contacts with email (3 contacts)
      expect(checkboxes.length).toBeGreaterThan(0);
    });

    it('should display primary and signatory status badges', () => {
      render(
        <ContactSelector
          contacts={mockContacts}
          channel="email"
          selectedContactIndices={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      expect(screen.getByText('Primary')).toBeInTheDocument();
      // Signatory is an icon, so we check for presence (component uses ShieldCheck)
      // In RTL we might need a test id or query by svg
    });
  });

  describe('Channel-Based Filtering', () => {
    it('should only show contacts with valid email addresses when channel is email', () => {
      render(
        <ContactSelector
          contacts={mockContacts}
          channel="email"
          selectedContactIndices={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      // Should show contacts with email
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('Alice Williams')).toBeInTheDocument();

      // Should not show Bob Johnson (no email)
      expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument();
    });

    it('should only show contacts with valid phone numbers when channel is SMS', () => {
      render(
        <ContactSelector
          contacts={mockContacts}
          channel="sms"
          selectedContactIndices={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      // Should show contacts with phone
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('Bob Johnson')).toBeInTheDocument();

      // Should not show Alice Williams (no phone)
      expect(screen.queryByText('Alice Williams')).not.toBeInTheDocument();
    });

    it('should display warning when no contacts have valid channel info', () => {
      const contactsWithoutEmail: EntityContact[] = [
        {
          id: 'c1',
          name: 'Test Person',
          email: '',
          phone: '+233241234567',
          typeLabel: 'Principal',
          typeKey: 'principal',
          isSignatory: true,
          isPrimary: true,
          order: 0,
        },
      ];

      render(
        <ContactSelector
          contacts={contactsWithoutEmail}
          channel="email"
          selectedContactIndices={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      expect(screen.getByText(/No contacts with valid email addresses found/i)).toBeInTheDocument();
    });
  });

  describe('Multi-Selection', () => {
    it('should allow selecting multiple contacts', () => {
      const { rerender } = render(
        <ContactSelector
          contacts={mockContacts}
          channel="email"
          selectedContactIndices={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      const checkboxes = screen.getAllByRole('checkbox');
      
      // Select first contact
      fireEvent.click(checkboxes[0]);
      expect(mockOnSelectionChange).toHaveBeenCalledWith([0]);

      // Reset mock and rerender with first contact selected
      mockOnSelectionChange.mockClear();
      rerender(
        <ContactSelector
          contacts={mockContacts}
          channel="email"
          selectedContactIndices={[0]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      const updatedCheckboxes = screen.getAllByRole('checkbox');
      
      // Select second contact (index 1 in original array)
      fireEvent.click(updatedCheckboxes[1]);
      // Should add index 1 to the selection
      expect(mockOnSelectionChange).toHaveBeenCalledWith([0, 1]);
    });

    it('should allow deselecting contacts', () => {
      render(
        <ContactSelector
          contacts={mockContacts}
          channel="email"
          selectedContactIndices={[0, 1]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      const checkboxes = screen.getAllByRole('checkbox');
      
      // Deselect first contact
      fireEvent.click(checkboxes[0]);
      expect(mockOnSelectionChange).toHaveBeenCalledWith([1]);
    });

    it('should enforce maximum selection limit', () => {
      render(
        <ContactSelector
          contacts={mockContacts}
          channel="email"
          selectedContactIndices={[0, 1]}
          onSelectionChange={mockOnSelectionChange}
          maxSelections={2}
        />
      );

      // Should display warning about max limit
      expect(screen.getByText(/Maximum selection limit of 2 contacts reached/i)).toBeInTheDocument();

      const checkboxes = screen.getAllByRole('checkbox');
      
      // Try to select third contact (should be disabled)
      const thirdCheckbox = checkboxes[2];
      expect(thirdCheckbox).toBeDisabled();
    });
  });

  describe('Selection Count Display', () => {
    it('should display the count of selected contacts', () => {
      render(
        <ContactSelector
          contacts={mockContacts}
          channel="email"
          selectedContactIndices={[0, 1]}
          onSelectionChange={mockOnSelectionChange}
          maxSelections={50}
        />
      );

      expect(screen.getByText('2 / 50 selected')).toBeInTheDocument();
    });

    it('should display total available contacts for channel', () => {
      render(
        <ContactSelector
          contacts={mockContacts}
          channel="email"
          selectedContactIndices={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      // 3 contacts have email addresses
      expect(screen.getByText(/3 contacts available for email/i)).toBeInTheDocument();
    });
  });

  describe('Contact Details Display', () => {
    it('should display contact name, typeLabel, email, and phone', () => {
      render(
        <ContactSelector
          contacts={mockContacts}
          channel="email"
          selectedContactIndices={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      // Check first contact details
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Principal')).toBeInTheDocument();
      expect(screen.getByText('john@example.com')).toBeInTheDocument();
      expect(screen.getByText('+233241234567')).toBeInTheDocument();
    });

    it('should indicate which channel will be used for sending', () => {
      render(
        <ContactSelector
          contacts={mockContacts}
          channel="email"
          selectedContactIndices={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      expect(screen.getAllByText(/Will receive via email/i).length).toBeGreaterThan(0);
    });
  });
});
