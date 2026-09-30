import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import * as XLSX from 'xlsx';
import { SpreadsheetRecipientImporter } from '../SpreadsheetRecipientImporter';
import type { AdHocContactItem } from '@/lib/types/composer-audience';

function createCsvFile(content: string, fileName = 'contacts.csv'): File {
  return new File([content], fileName, { type: 'text/csv' });
}

function createExcelFile(rows: Record<string, unknown>[], fileName = 'contacts.xlsx'): File {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const arrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new File([arrayBuffer], fileName, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

function createOversizedFile(fileName = 'large.csv'): File {
  // File with reported size > 5MB
  const file = new File(['small content'], fileName, { type: 'text/csv' });
  Object.defineProperty(file, 'size', {
    value: 6 * 1024 * 1024,
    configurable: true,
  });
  return file;
}

describe('SpreadsheetRecipientImporter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('File Dropzone & Upload Rendering', () => {
    it('renders drag-and-drop dropzone with browse button and supported formats', () => {
      render(
        <SpreadsheetRecipientImporter
          channel="sms"
          onImportComplete={vi.fn()}
        />
      );

      expect(screen.getByText(/drag & drop your excel/i)).toBeInTheDocument();
      expect(screen.getByText(/supports \.xlsx, \.xls, \.csv up to 5mb/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /browse file/i })).toBeInTheDocument();
    });

    it('renders cancel button when onCancel prop is provided and triggers callback on click', () => {
      const handleCancel = vi.fn();
      render(
        <SpreadsheetRecipientImporter
          channel="sms"
          onImportComplete={vi.fn()}
          onCancel={handleCancel}
        />
      );

      const cancelBtn = screen.getByRole('button', { name: /cancel/i });
      expect(cancelBtn).toBeInTheDocument();
      fireEvent.click(cancelBtn);
      expect(handleCancel).toHaveBeenCalledTimes(1);
    });

    it('does not render cancel button when onCancel is not provided', () => {
      render(
        <SpreadsheetRecipientImporter
          channel="sms"
          onImportComplete={vi.fn()}
        />
      );

      expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
    });

    it('shows visual feedback when dragging over and clears on drag leave', () => {
      render(
        <SpreadsheetRecipientImporter
          channel="sms"
          onImportComplete={vi.fn()}
        />
      );

      const dropzone = screen.getByTestId('spreadsheet-dropzone');
      expect(dropzone).not.toHaveClass('border-primary');

      fireEvent.dragOver(dropzone);
      expect(dropzone).toHaveClass('border-primary');

      fireEvent.dragLeave(dropzone);
      expect(dropzone).not.toHaveClass('border-primary');
    });
  });

  describe('Validation & Error Handling', () => {
    it('rejects files larger than 5MB with an informative error banner', async () => {
      render(
        <SpreadsheetRecipientImporter
          channel="sms"
          onImportComplete={vi.fn()}
        />
      );

      const fileInput = screen.getByLabelText(/spreadsheet file input/i, { selector: 'input' });
      const bigFile = createOversizedFile();

      fireEvent.change(fileInput, { target: { files: [bigFile] } });

      await waitFor(() => {
        expect(screen.getByText(/file size exceeds the 5mb limit/i)).toBeInTheDocument();
      });
    });

    it('rejects unsupported file formats with error banner', async () => {
      render(
        <SpreadsheetRecipientImporter
          channel="sms"
          onImportComplete={vi.fn()}
        />
      );

      const fileInput = screen.getByLabelText(/spreadsheet file input/i, { selector: 'input' });
      const invalidFile = new File(['content'], 'document.pdf', { type: 'application/pdf' });

      fireEvent.change(fileInput, { target: { files: [invalidFile] } });

      await waitFor(() => {
        expect(screen.getByText(/unsupported file format/i)).toBeInTheDocument();
      });
    });

    it('displays error banner when file is empty', async () => {
      render(
        <SpreadsheetRecipientImporter
          channel="sms"
          onImportComplete={vi.fn()}
        />
      );

      const fileInput = screen.getByLabelText(/spreadsheet file input/i, { selector: 'input' });
      const emptyFile = createCsvFile('', 'empty.csv');

      fireEvent.change(fileInput, { target: { files: [emptyFile] } });

      await waitFor(() => {
        expect(screen.getByText(/the uploaded file is empty/i)).toBeInTheDocument();
      });
    });
  });

  describe('CSV Parsing & Smart Header Auto-Detection', () => {
    it('parses CSV, auto-detects phone target and name for SMS channel', async () => {
      const csvData = [
        'Full Name,Phone Number,City',
        'Kwame Mensah,0244123456,Accra',
        'Ama Serwaa,0201112222,Kumasi',
      ].join('\n');

      render(
        <SpreadsheetRecipientImporter
          channel="sms"
          defaultCountry="GH"
          onImportComplete={vi.fn()}
        />
      );

      const fileInput = screen.getByLabelText(/spreadsheet file input/i, { selector: 'input' });
      fireEvent.change(fileInput, { target: { files: [createCsvFile(csvData)] } });

      await waitFor(() => {
        expect(screen.getByText(/contacts\.csv/i)).toBeInTheDocument();
      });

      // Target select should auto-select "Phone Number"
      const targetSelect = screen.getByLabelText(/target column/i);
      expect((targetSelect as HTMLSelectElement).value).toBe('Phone Number');

      // Name select should auto-select "Full Name"
      const nameSelect = screen.getByLabelText(/name column/i);
      expect((nameSelect as HTMLSelectElement).value).toBe('Full Name');

      // Metrics badge: 2 total, 2 valid, 0 invalid
      expect(screen.getByText(/2 Total Rows/i)).toBeInTheDocument();
      expect(screen.getByText(/2 Valid/i)).toBeInTheDocument();
    });

    it('parses CSV, auto-detects email target and name for Email channel', async () => {
      const csvData = [
        'Contact Name,Email Address,Department',
        'Kofi Mensah,kofi@example.com,Sales',
        'Abena Appiah,abena@example.com,Support',
      ].join('\n');

      render(
        <SpreadsheetRecipientImporter
          channel="email"
          onImportComplete={vi.fn()}
        />
      );

      const fileInput = screen.getByLabelText(/spreadsheet file input/i, { selector: 'input' });
      fireEvent.change(fileInput, { target: { files: [createCsvFile(csvData)] } });

      await waitFor(() => {
        expect(screen.getByText(/contacts\.csv/i)).toBeInTheDocument();
      });

      const targetSelect = screen.getByLabelText(/target column/i);
      expect((targetSelect as HTMLSelectElement).value).toBe('Email Address');

      const nameSelect = screen.getByLabelText(/name column/i);
      expect((nameSelect as HTMLSelectElement).value).toBe('Contact Name');
    });

    it('supports drag-and-drop file upload', async () => {
      const csvData = 'Phone,Name\n0244123456,Kwame';

      render(
        <SpreadsheetRecipientImporter
          channel="sms"
          onImportComplete={vi.fn()}
        />
      );

      const dropzone = screen.getByTestId('spreadsheet-dropzone');
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [createCsvFile(csvData, 'drop_test.csv')],
        },
      });

      await waitFor(() => {
        expect(screen.getByText(/drop_test\.csv/i)).toBeInTheDocument();
      });
      expect(screen.getByText(/1 Total Row/i)).toBeInTheDocument();
    });
  });

  describe('Excel (.xlsx / .xls) Parsing', () => {
    it('parses Excel file binary using XLSX and populates preview', async () => {
      const excelRows = [
        { 'Recipient Name': 'John Doe', Mobile: '0244111222', Note: 'Test 1' },
        { 'Recipient Name': 'Jane Doe', Mobile: '0203334444', Note: 'Test 2' },
      ];
      const excelFile = createExcelFile(excelRows, 'members.xlsx');

      render(
        <SpreadsheetRecipientImporter
          channel="whatsapp"
          defaultCountry="GH"
          onImportComplete={vi.fn()}
        />
      );

      const fileInput = screen.getByLabelText(/spreadsheet file input/i, { selector: 'input' });
      fireEvent.change(fileInput, { target: { files: [excelFile] } });

      await waitFor(() => {
        expect(screen.getByText(/members\.xlsx/i)).toBeInTheDocument();
      });

      const targetSelect = screen.getByLabelText(/target column/i);
      expect((targetSelect as HTMLSelectElement).value).toBe('Mobile');

      const nameSelect = screen.getByLabelText(/name column/i);
      expect((nameSelect as HTMLSelectElement).value).toBe('Recipient Name');

      expect(screen.getByText(/2 Total Rows/i)).toBeInTheDocument();
      expect(screen.getByText(/John Doe/i)).toBeInTheDocument();
      expect(screen.getByText(/Jane Doe/i)).toBeInTheDocument();
    });
  });

  describe('Template Variable Dynamic Mapping', () => {
    it('auto-matches declared variables to discovered spreadsheet headers using fuzzy matching', async () => {
      const csvData = [
        'student_name,fee_due,Parent Contact,grade_level',
        'Kojo,500,0244123456,Grade 4',
        'Akua,350,0201112222,Grade 5',
      ].join('\n');

      render(
        <SpreadsheetRecipientImporter
          channel="sms"
          declaredVariables={['student_name', 'fee_due']}
          onImportComplete={vi.fn()}
        />
      );

      const fileInput = screen.getByLabelText(/spreadsheet file input/i, { selector: 'input' });
      fireEvent.change(fileInput, { target: { files: [createCsvFile(csvData)] } });

      await waitFor(() => {
        expect(screen.getByText(/contacts\.csv/i)).toBeInTheDocument();
      });

      // Target column auto-detected
      const targetSelect = screen.getByLabelText(/target column/i);
      expect((targetSelect as HTMLSelectElement).value).toBe('Parent Contact');

      // Check declared variables mapping dropdowns
      const studentVarSelect = screen.getByLabelText(/map variable: student_name/i);
      expect((studentVarSelect as HTMLSelectElement).value).toBe('student_name');

      const feeVarSelect = screen.getByLabelText(/map variable: fee_due/i);
      expect((feeVarSelect as HTMLSelectElement).value).toBe('fee_due');
    });

    it('allows user to manually change variable mapping via dropdown', async () => {
      const csvData = [
        'Student,Amount,Parent Phone',
        'Kojo,500,0244123456',
      ].join('\n');

      render(
        <SpreadsheetRecipientImporter
          channel="sms"
          declaredVariables={['fee_due']}
          onImportComplete={vi.fn()}
        />
      );

      const fileInput = screen.getByLabelText(/spreadsheet file input/i, { selector: 'input' });
      fireEvent.change(fileInput, { target: { files: [createCsvFile(csvData)] } });

      await waitFor(() => {
        expect(screen.getByText(/contacts\.csv/i)).toBeInTheDocument();
      });

      const feeVarSelect = screen.getByLabelText(/map variable: fee_due/i);
      // Auto-matched Amount or user changes to Amount
      fireEvent.change(feeVarSelect, { target: { value: 'Amount' } });
      expect((feeVarSelect as HTMLSelectElement).value).toBe('Amount');
    });
  });

  describe('Reactive Metrics & Deduplication', () => {
    it('correctly tracks valid, invalid, and duplicate contact counts', async () => {
      // 4 rows: 2 valid unique, 1 duplicate, 1 invalid phone
      const csvData = [
        'Name,Phone',
        'Kwame Mensah,0244123456',
        'Ama Serwaa,+233244123456', // Duplicate of 0244123456 in Ghana (+233244123456)
        'Kofi Bad,invalid-phone',   // Invalid phone
        'Yaa Valid,0201112222',     // Valid unique
      ].join('\n');

      render(
        <SpreadsheetRecipientImporter
          channel="sms"
          defaultCountry="GH"
          onImportComplete={vi.fn()}
        />
      );

      const fileInput = screen.getByLabelText(/spreadsheet file input/i, { selector: 'input' });
      fireEvent.change(fileInput, { target: { files: [createCsvFile(csvData)] } });

      await waitFor(() => {
        expect(screen.getByText(/4 Total Rows/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/2 Valid/i)).toBeInTheDocument();
      expect(screen.getByText(/1 Invalid/i)).toBeInTheDocument();
      expect(screen.getByText(/1 Duplicate/i)).toBeInTheDocument();

      // Import button shows count of valid contacts
      expect(screen.getByRole('button', { name: /import 2 contacts/i })).toBeInTheDocument();
    });

    it('updates metrics reactively when target column is changed by the user', async () => {
      const csvData = [
        'Name,ColA,ColB',
        'Kwame,0244123456,invalid',
        'Ama,0201112222,0244999888',
      ].join('\n');

      render(
        <SpreadsheetRecipientImporter
          channel="sms"
          defaultCountry="GH"
          onImportComplete={vi.fn()}
        />
      );

      const fileInput = screen.getByLabelText(/spreadsheet file input/i, { selector: 'input' });
      fireEvent.change(fileInput, { target: { files: [createCsvFile(csvData)] } });

      await waitFor(() => {
        expect(screen.getByText(/contacts\.csv/i)).toBeInTheDocument();
      });

      const targetSelect = screen.getByLabelText(/target column/i);
      // Change target column from ColA to ColB
      fireEvent.change(targetSelect, { target: { value: 'ColB' } });

      // In ColB: 1 invalid ('invalid'), 1 valid ('0244999888')
      await waitFor(() => {
        expect(screen.getByText(/1 Valid/i)).toBeInTheDocument();
        expect(screen.getByText(/1 Invalid/i)).toBeInTheDocument();
      });
    });
  });

  describe('Preview Table & Touch Ergonomics', () => {
    it('renders a 5-row preview table with column badges and responsive scroll wrapper', async () => {
      const csvRows = [
        'Name,Phone,City',
        'User 1,0244000001,Accra',
        'User 2,0244000002,Kumasi',
        'User 3,0244000003,Takoradi',
        'User 4,0244000004,Tamale',
        'User 5,0244000005,Sunyani',
        'User 6,0244000006,Cape Coast',
      ].join('\n');

      render(
        <SpreadsheetRecipientImporter
          channel="sms"
          onImportComplete={vi.fn()}
        />
      );

      const fileInput = screen.getByLabelText(/spreadsheet file input/i, { selector: 'input' });
      fireEvent.change(fileInput, { target: { files: [createCsvFile(csvRows)] } });

      await waitFor(() => {
        expect(screen.getByText(/6 Total Rows/i)).toBeInTheDocument();
      });

      // Preview table should show first 5 rows
      expect(screen.getByText('User 1')).toBeInTheDocument();
      expect(screen.getByText('User 5')).toBeInTheDocument();
      // 6th row should not be in preview table
      expect(screen.queryByText('User 6')).not.toBeInTheDocument();

      // Preview header badges
      expect(screen.getByText(/Preview \(First 5 Rows\)/i)).toBeInTheDocument();
    });
  });

  describe('Import Execution & Callbacks', () => {
    it('calls onImportComplete with normalized contacts, displayName, customVars, and columnMapping', async () => {
      const handleImportComplete = vi.fn();
      const csvData = [
        'Student Name,Parent Mobile,Fee Balance',
        'Kojo Mensah,0244123456,GH¢500',
        'Ama Darko,0201112222,GH¢350',
      ].join('\n');

      render(
        <SpreadsheetRecipientImporter
          channel="sms"
          defaultCountry="GH"
          declaredVariables={['balance']}
          onImportComplete={handleImportComplete}
        />
      );

      const fileInput = screen.getByLabelText(/spreadsheet file input/i, { selector: 'input' });
      fireEvent.change(fileInput, { target: { files: [createCsvFile(csvData)] } });

      await waitFor(() => {
        expect(screen.getByText(/2 Valid/i)).toBeInTheDocument();
      });

      // Map balance variable to Fee Balance
      const balanceSelect = screen.getByLabelText(/map variable: balance/i);
      fireEvent.change(balanceSelect, { target: { value: 'Fee Balance' } });

      const importBtn = screen.getByRole('button', { name: /import 2 contacts/i });
      expect(importBtn).toBeEnabled();
      fireEvent.click(importBtn);

      expect(handleImportComplete).toHaveBeenCalledTimes(1);
      const [items, mapping] = handleImportComplete.mock.calls[0] as [
        AdHocContactItem[],
        Record<string, string>,
      ];

      expect(items).toHaveLength(2);
      expect(items[0]).toMatchObject({
        target: '+233244123456',
        displayName: 'Kojo Mensah',
        isValid: true,
        customVars: { balance: 'GH¢500' },
      });
      expect(items[1]).toMatchObject({
        target: '+233201112222',
        displayName: 'Ama Darko',
        isValid: true,
        customVars: { balance: 'GH¢350' },
      });

      expect(mapping).toMatchObject({
        target: 'Parent Mobile',
        name: 'Student Name',
        balance: 'Fee Balance',
      });
    });

    it('disables import button when 0 valid contacts exist', async () => {
      const csvData = [
        'Name,Email',
        'Bad User 1,not-an-email',
        'Bad User 2,still-not-email',
      ].join('\n');

      render(
        <SpreadsheetRecipientImporter
          channel="email"
          onImportComplete={vi.fn()}
        />
      );

      const fileInput = screen.getByLabelText(/spreadsheet file input/i, { selector: 'input' });
      fireEvent.change(fileInput, { target: { files: [createCsvFile(csvData)] } });

      await waitFor(() => {
        expect(screen.getByText(/0 Valid/i)).toBeInTheDocument();
      });

      const importBtn = screen.getByRole('button', { name: /import 0 contacts/i });
      expect(importBtn).toBeDisabled();
    });
  });

  describe('Change File / Reset Action', () => {
    it('resets state when "Change File" is clicked, returning to dropzone', async () => {
      const csvData = 'Phone,Name\n0244123456,Kwame';

      render(
        <SpreadsheetRecipientImporter
          channel="sms"
          onImportComplete={vi.fn()}
        />
      );

      const fileInput = screen.getByLabelText(/spreadsheet file input/i, { selector: 'input' });
      fireEvent.change(fileInput, { target: { files: [createCsvFile(csvData)] } });

      await waitFor(() => {
        expect(screen.getByText(/contacts\.csv/i)).toBeInTheDocument();
      });

      const changeFileBtn = screen.getByRole('button', { name: /change file/i });
      fireEvent.click(changeFileBtn);

      // Returns to dropzone
      expect(screen.getByText(/drag & drop your excel/i)).toBeInTheDocument();
      expect(screen.queryByText(/contacts\.csv/i)).not.toBeInTheDocument();
    });
  });
});
